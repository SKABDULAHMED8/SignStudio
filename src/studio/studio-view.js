import { DEFAULT_PROCESSING_SETTINGS } from '../signature/processing/constants.js';
import { WorkerClient } from '../platform/worker-client.js';
import { decodeImageFile, savePng } from '../platform/file-io.js';
import { validateImageFile } from '../signature/validate.js';
import { StrokeHistory } from '../signature/draw/strokes.js';
import { processSignature, processTransparentSignature } from '../signature/processing/pipeline.js';
import { askForText, askForChoice } from '../ui/dialogs.js';
import { findSimilarSignature } from '../library/duplicate-check.js';

const INK_HEX = { blue: '#2459d3', black: '#17191f', red: '#c93636', green: '#198452' };

export class StudioView {
  constructor({ library, sessionStore, notify, onSaved }) {
    this.library = library; this.sessionStore = sessionStore; this.notify = notify; this.onSaved = onSaved;
    this.settings = { ...DEFAULT_PROCESSING_SETTINGS }; this.source = null; this.result = null; this.previewUrl = null;
    this.worker = null; this.history = new StrokeHistory(50); this.drawing = false; this.activeInput = 'photo';
    this.canvas = document.querySelector('#drawing-canvas'); this.context = this.canvas.getContext('2d');
    this.#bind(); this.#setupCanvas();
  }
  #bind() {
    const $ = selector => document.querySelector(selector);
    $('#choose-image').addEventListener('click', () => $('#image-picker').click());
    $('#take-photo').addEventListener('click', () => $('#camera-picker').click());
    $('#replace-image').addEventListener('click', () => $('#image-picker').click());
    $('#image-picker').addEventListener('change', event => this.loadFile(event.target.files?.[0]));
    $('#camera-picker').addEventListener('change', event => this.loadFile(event.target.files?.[0]));
    const dropzone = $('#dropzone');
    for (const name of ['dragenter', 'dragover']) dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('is-dragover'); });
    for (const name of ['dragleave', 'drop']) dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('is-dragover'); });
    dropzone.addEventListener('drop', event => this.loadFile(event.dataTransfer.files?.[0]));
    dropzone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('#image-picker').click(); } });
    document.querySelectorAll('[data-input]').forEach(button => button.addEventListener('click', () => this.setInput(button.dataset.input)));
    document.querySelectorAll('[data-ink]').forEach(button => button.addEventListener('click', () => this.setSetting('ink', button.dataset.ink)));
    document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => this.setSetting('outputSize', button.dataset.size === 'original' ? 'original' : Number(button.dataset.size))));
    const rangeBindings = [['sensitivity', 'sensitivity', v => v / 100, 'sensitivity-value', v => `${v}%`], ['noise', 'noiseRemoval', v => v / 100, 'noise-value', v => `${v}%`], ['margin', 'cropMargin', Number, 'margin-value', v => `${v} px`], ['thickness', 'strokeThickness', Number, 'thickness-value', v => `${v}`]];
    rangeBindings.forEach(([selector, key, parse, output, format]) => $(`#${selector}`).addEventListener('input', event => { const value = parse(event.target.value); this.settings[key] = value; $(`#${output}`).value = format(event.target.value); if (key !== 'strokeThickness' && this.#canProcess()) this.process(false); }));
    $('#process-button').addEventListener('click', () => this.process());
    $('#export-button').addEventListener('click', () => this.export());
    $('#save-library-button').addEventListener('click', () => this.save());
    $('#save-session-button').addEventListener('click', () => this.saveSession());
    document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => this.setPreview(button.dataset.preview)));
    $('#undo-stroke').addEventListener('click', () => { this.history.undo(); this.redraw(); });
    $('#redo-stroke').addEventListener('click', () => { this.history.redo(); this.redraw(); });
    $('#clear-strokes').addEventListener('click', () => { this.history.clear(); this.redraw(); this.source = null; this.result = null; this.#updateActions(); });
  }
  #setupCanvas() {
    const canvas = this.canvas;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const snapshot = this.history.current;
      canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.context.lineCap = 'round'; this.context.lineJoin = 'round'; this.redraw(snapshot);
    };
    this.resizeCanvas = resize;
    new ResizeObserver(resize).observe(canvas); resize();
    canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); this.drawing = true; this.currentStroke = [this.#point(event)]; this.#drawStroke(this.currentStroke); });
    canvas.addEventListener('pointermove', event => { if (!this.drawing) return; this.currentStroke.push(this.#point(event)); this.#drawStroke(this.currentStroke); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { if (!this.drawing) return; this.drawing = false; this.history.add(this.currentStroke); this.currentStroke = null; this.source = this.#drawingImageData(); this.result = null; this.#updateActions(); });
  }
  #point(event) { const rect = this.canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top, pressure: event.pressure || 0.5, width: Number(document.querySelector('#stroke-width').value) }; }
  #drawStroke(points) {
    if (points.length < 1) return;
    const ctx = this.context, point = points.at(-1); ctx.strokeStyle = INK_HEX[this.settings.ink]; ctx.lineWidth = point.width * (0.65 + point.pressure * 0.7);
    if (points.length === 1) { ctx.beginPath(); ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); return; }
    ctx.beginPath(); ctx.moveTo(points.at(-2).x, points.at(-2).y); ctx.lineTo(point.x, point.y); ctx.stroke();
  }
  redraw(strokes = this.history.current) {
    const rect = this.canvas.getBoundingClientRect(), ctx = this.context;
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const stroke of strokes) { for (let i = 0; i < stroke.length; i++) this.#drawStroke(stroke.slice(0, i + 1)); }
    document.querySelector('#undo-stroke').disabled = !this.history.canUndo;
    document.querySelector('#redo-stroke').disabled = !this.history.canRedo;
  }
  #drawingImageData() {
    const rect = this.canvas.getBoundingClientRect(), source = this.canvas;
    const target = document.createElement('canvas'); target.width = Math.max(1, Math.round(rect.width)); target.height = Math.max(1, Math.round(rect.height));
    const ctx = target.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, target.width, target.height);
    return ctx.getImageData(0, 0, target.width, target.height);
  }
  async loadFile(file) {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) return this.notify(validation.message, 'error', validation.code);
    try {
      const decoded = await decodeImageFile(file);
      this.#revokePreview(); this.previewUrl = decoded.previewUrl; this.source = decoded.imageData; this.result = null;
      document.querySelector('#source-image').src = this.previewUrl;
      document.querySelector('#source-name').textContent = file.name || 'Camera photo';
      document.querySelector('#dropzone').classList.add('is-hidden'); document.querySelector('#source-preview').classList.remove('is-hidden');
      document.querySelector('#preview-empty').classList.remove('is-hidden'); document.querySelector('#result-canvas').classList.add('is-hidden');
      this.#updateActions(); this.process(false);
    } catch (error) { this.notify('This photo could not be opened. Try a JPG or PNG image.', 'error', 'SS-IMG-202'); }
  }
  loadSavedRecord(record) {
    if (!record?.image) return;
    this.#revokePreview();
    this.history.clear();
    this.redraw([]);
    this.source = record.image;
    this.settings = { ...this.settings, ...(record.settings ?? {}), ink: record.ink ?? this.settings.ink };
    this.result = { image: record.image, settings: this.settings };
    this.setInput('draw', { preserveSource: true });
    this.#renderResult();
    this.#updateActions();
    this.notify('Saved signature reopened. You can export it or make a new adjustment.', 'success');
  }
  setInput(mode, { preserveSource = false } = {}) {
    if (mode !== this.activeInput && !preserveSource) {
      this.source = null; this.result = null;
      if (mode === 'draw') this.history.clear();
      if (mode === 'photo') {
        this.#revokePreview();
        document.querySelector('#source-preview').classList.add('is-hidden');
        document.querySelector('#dropzone').classList.remove('is-hidden');
      }
    }
    this.activeInput = mode;
    document.querySelector('#photo-stage').classList.toggle('is-hidden', mode !== 'photo');
    document.querySelector('#draw-stage').classList.toggle('is-hidden', mode !== 'draw');
    document.querySelectorAll('[data-input]').forEach(button => { const selected = button.dataset.input === mode; button.classList.toggle('is-active', selected); button.setAttribute('aria-selected', String(selected)); });
    if (mode === 'draw') {
      this.resizeCanvas?.();
      if (!this.source) this.source = this.#drawingImageData();
    }
    this.#updateActions();
  }
  setSetting(key, value) {
    this.settings[key] = value;
    document.querySelectorAll(`[data-${key === 'outputSize' ? 'size' : 'ink'}]`).forEach(button => button.classList.toggle('is-selected', String(button.dataset[key === 'outputSize' ? 'size' : 'ink']) === String(value)));
    if (key === 'ink' && this.result) this.process(false);
    if (key === 'outputSize') { document.querySelector('#size-note').textContent = value === 'original' ? 'Original detail · longest side capped at 4096 px · no upscaling' : `Longest side up to ${value} px · no upscaling`; if (this.#canProcess()) this.process(false); }
  }
  async process(showToast = true) {
    if (!this.#canProcess()) return;
    const button = document.querySelector('#process-button'); button.disabled = true; button.textContent = 'Processing…';
    try {
      if (this.worker) { this.worker.terminate(); this.worker = null; }
      // Worker creation is preferred. A synchronous pure-function fallback keeps unsupported browsers usable.
      if (this.activeInput === 'draw') {
        this.result = processTransparentSignature(this.source, this.settings);
      } else {
        try { this.worker = new WorkerClient(); this.result = await this.worker.process(this.source, this.settings); }
        catch { this.result = processSignature(this.source, this.settings); }
      }
      this.#renderResult(); this.#updateActions();
      if (showToast) this.notify('Your transparent signature is ready.', 'success');
    } catch (error) { this.notify(error.message || 'We could not detect a signature. Try a clearer, brighter photo.', 'error', 'SS-IMG-201'); }
    finally { button.disabled = !this.source; button.innerHTML = `<svg aria-hidden="true"><use href="${import.meta.env.BASE_URL}icons/ui.svg#sparkles"/></svg>Remove background`; }
  }
  #renderResult() {
    const canvas = document.querySelector('#result-canvas'); canvas.width = this.result.image.width; canvas.height = this.result.image.height;
    canvas.getContext('2d').putImageData(new ImageData(this.result.image.data, canvas.width, canvas.height), 0, 0);
    document.querySelector('#preview-empty').classList.add('is-hidden'); canvas.classList.remove('is-hidden');
    document.querySelector('#output-dimensions').textContent = `${canvas.width} × ${canvas.height} px`;
    document.querySelector('#transparency-state').textContent = 'Transparent PNG';
    document.querySelector('#before-image').src = this.previewUrl || canvas.toDataURL();
  }
  setPreview(mode) {
    document.querySelectorAll('[data-preview]').forEach(button => button.classList.toggle('is-active', button.dataset.preview === mode));
    document.querySelector('#result-canvas').classList.toggle('is-hidden', mode !== 'after' || !this.result);
    document.querySelector('#before-image').classList.toggle('is-hidden', mode !== 'before' || !this.result);
  }
  #canProcess() { return Boolean(this.source) && (this.activeInput !== 'draw' || this.history.current.length > 0 || Boolean(this.result)); }
  #updateActions() {
    const ready = this.#canProcess(), done = Boolean(this.result);
    document.querySelector('#process-button').disabled = !ready;
    document.querySelector('#export-button').disabled = !done;
    document.querySelector('#save-library-button').disabled = !done;
    document.querySelector('#save-session-button').disabled = !done;
  }
  async export() {
    if (!this.result) return;
    try { const outcome = await savePng(this.result.image); this.notify(outcome.message, outcome.method === 'cancelled' ? 'info' : 'success'); }
    catch { this.notify('The file could not be saved. Try downloading it instead.', 'error', 'SS-SAV-401'); }
  }
  async save() {
    if (!this.result) return;
    try {
      const existing = await this.library.list();
      const duplicate = findSimilarSignature(existing, this.result.image);
      let replaceId = null, defaultName = 'My signature';
      if (duplicate) {
        const choice = await askForChoice({ title: 'Similar signature found', description: `This looks similar to “${duplicate.record.name}”. Choose how to save the new result.`, choices: [
          { label: 'Replace existing', value: 'replace', variant: 'primary' },
          { label: 'Keep both', value: 'keep' },
          { label: 'Cancel', value: 'cancel' }
        ] });
        if (!choice || choice === 'cancel') return;
        if (choice === 'replace') { replaceId = duplicate.record.id; defaultName = duplicate.record.name; }
      }
      const name = await askForText({ title: replaceId ? 'Replace saved signature' : 'Save signature', description: replaceId ? 'This replaces the current version. The previous version stays in History.' : 'Give this signature a name so you can find it later.', label: 'Signature name', value: defaultName });
      if (name === null) return;
      const record = await this.library.save({ name, image: this.result.image, thumbnail: null, ink: this.settings.ink, settings: this.settings, replaceId });
      this.notify(replaceId ? 'Signature replaced. The previous version is available in History.' : 'Signature saved to this device.', 'success'); this.onSaved?.(record);
    } catch (error) { this.notify(error.message, 'error', 'SS-STO-301'); }
  }

  async saveSession() {
    if (!this.result) return;
    const name = await askForText({ title: 'Keep for this session', description: 'This signature stays in memory and is cleared when this tab closes.', label: 'Signature name', value: 'Temporary signature' });
    if (name === null) return;
    this.sessionStore.save({ name: String(name).slice(0, 80), image: this.result.image, ink: this.settings.ink, settings: { ...this.settings } });
    this.notify('Saved for this session only. It will be cleared when this tab closes.', 'success');
    this.onSaved?.();
  }

  #revokePreview() { if (this.previewUrl) URL.revokeObjectURL(this.previewUrl); this.previewUrl = null; }
  destroy() { this.#revokePreview(); this.worker?.terminate(); }
}
