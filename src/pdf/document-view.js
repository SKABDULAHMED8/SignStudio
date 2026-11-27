import { loadPdfLibraries } from './pdf-module.js';
import { listAcroFormFields } from './forms.js';
import { exportPdf } from './pdf-export.js';
import { toPdfTextPlacement } from './placement.js';
import { detectFormGeometry } from './form-detection.js';
import { distributeCharacters } from './editor-model.js';
import { mapProfileFields } from '../library/personal-profiles.js';

const MAX_PDF_BYTES = 40 * 1024 * 1024;

export class PdfWorkspace {
  constructor({ canvas, overlay, pagesContainer, toolsContainer, getSignatures, getSignature, getPersonalProfiles = async () => [], notify }) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.pagesContainer = pagesContainer;
    this.toolsContainer = toolsContainer;
    this.getSignatures = getSignatures;
    this.getSignature = getSignature;
    this.getPersonalProfiles = getPersonalProfiles;
    this.notify = notify;
    this.pdfjs = null;
    this.PDFDocument = null;
    this.pdfJsDocument = null;
    this.pdfBytes = null;
    this.pdfDocument = null;
    this.pageIndex = 0;
    this.scale = 1.25;
    this.fields = [];
    this.fieldValues = {};
    this.placements = [];
    this.textPlacements = [];
    this.overlayPlacements = [];
    this.detectionRegions = [];
    this.undoStack = [];
    this.redoStack = [];
    this.activeTool = 'select';
    this.activeSignature = null;
    this.dragging = false;
    this.currentPlacement = null;
    this.overlay.tabIndex = 0; this.overlay.setAttribute('role', 'group'); this.overlay.setAttribute('aria-label', 'Signature placement area. Select a saved signature, then click or press Enter to place it. Use arrow keys to move the selected signature.');
    this.#bindOverlay();
  }

  async open(file) {
    if (!file || (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf'))) throw new TypeError('Choose a PDF document.');
    if (file.size > MAX_PDF_BYTES) throw new RangeError('This PDF is larger than the 40 MB limit.');
    const libraries = await loadPdfLibraries();
    this.pdfjs = libraries.pdfjs;
    this.PDFDocument = libraries.PDFDocument;
    this.pdfBytes = await file.arrayBuffer();
    this.pdfJsDocument = await this.pdfjs.getDocument({ data: this.pdfBytes.slice(0) }).promise;
    this.pdfDocument = await this.PDFDocument.load(this.pdfBytes.slice(0), { updateMetadata: false });
    this.pageIndex = 0;
    this.placements = [];
    this.textPlacements = [];
    this.overlayPlacements = [];
    this.detectionRegions = [];
    this.activeTool = 'select';
    this.fields = listAcroFormFields(this.pdfDocument);
    this.fieldValues = Object.fromEntries(this.fields.filter(field => field.supported).map(field => [field.name, field.value]));
    this.#renderPageList();
    await this.#renderFormFields();
    await this.renderPage(0);
    return { pageCount: this.pdfJsDocument.numPages, fieldCount: this.fields.filter(field => field.supported).length };
  }

  async renderPage(index) {
    if (!this.pdfJsDocument || index < 0 || index >= this.pdfJsDocument.numPages) return;
    this.pageIndex = index;
    if (this.currentPlacement && this.currentPlacement.pageIndex !== index) this.currentPlacement = null;
    const page = await this.pdfJsDocument.getPage(index + 1);
    const viewport = page.getViewport({ scale: this.scale });
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.ceil(viewport.width * dpr);
    this.canvas.height = Math.ceil(viewport.height * dpr);
    this.canvas.style.width = `${viewport.width}px`;
    this.canvas.style.height = `${viewport.height}px`;
    this.overlay.width = this.canvas.width;
    this.overlay.height = this.canvas.height;
    this.overlay.style.width = `${viewport.width}px`;
    this.overlay.style.height = `${viewport.height}px`;
    for (const placement of [...this.placements, ...this.textPlacements, ...this.overlayPlacements].filter(item => item.pageIndex === index)) {
      const scaleX = viewport.width / placement.viewportWidth;
      const scaleY = viewport.height / placement.viewportHeight;
      placement.x *= scaleX; placement.y *= scaleY; placement.width *= scaleX; placement.height *= scaleY;
      if (placement.type === 'character-grid') for (const cell of placement.cells) {
        cell.bounds.x *= scaleX; cell.bounds.y *= scaleY; cell.bounds.width *= scaleX; cell.bounds.height *= scaleY;
      }
      placement.viewportWidth = viewport.width; placement.viewportHeight = viewport.height;
    }
    for (const region of this.detectionRegions.filter(item => item.pageIndex === index)) {
      const scaleX = viewport.width / (region.viewportWidth || viewport.width);
      const scaleY = viewport.height / (region.viewportHeight || viewport.height);
      region.bounds.x *= scaleX; region.bounds.y *= scaleY; region.bounds.width *= scaleX; region.bounds.height *= scaleY;
      region.viewportWidth = viewport.width; region.viewportHeight = viewport.height;
    }
    const context = this.canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: context, viewport, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] }).promise;
    this.#drawPlacements();
    this.#updatePageControls();
    this.pagesContainer.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('is-active', Number(button.dataset.page) === index));
  }

  #renderPageList() {
    this.pagesContainer.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < this.pdfJsDocument.numPages; index++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pdf-page-button'; button.dataset.page = String(index);
      button.textContent = `Page ${index + 1}`;
      button.addEventListener('click', () => this.renderPage(index));
      fragment.append(button);
    }
    this.pagesContainer.append(fragment);
  }

  async #renderFormFields() {
    this.toolsContainer.replaceChildren();
    const heading = document.createElement('h2'); heading.textContent = 'Fill in your PDF';
    const nav = document.createElement('div'); nav.className = 'pdf-page-controls';
    const previous = makeButton('Previous page', 'Previous'); previous.id = 'pdf-previous';
    const pageLabel = document.createElement('span'); pageLabel.id = 'pdf-page-label';
    const next = makeButton('Next page', 'Next'); next.id = 'pdf-next';
    previous.addEventListener('click', () => this.renderPage(this.pageIndex - 1));
    next.addEventListener('click', () => this.renderPage(this.pageIndex + 1));
    const undoButton = makeButton('Undo last change', 'Undo', 'undo'); undoButton.id='pdf-undo';
    const redoButton = makeButton('Redo last change', 'Redo', 'redo'); redoButton.id='pdf-redo';
    undoButton.addEventListener('click',()=>this.undo());
    redoButton.addEventListener('click',()=>this.redo());
    nav.append(previous, pageLabel, next, undoButton, redoButton);
    const zoom = document.createElement('div'); zoom.className = 'pdf-page-controls';
    const zoomOut = makeButton('Zoom out', '', 'minus'); const zoomIn = makeButton('Zoom in', '', 'plus');
    zoomOut.addEventListener('click', () => { this.scale = Math.max(0.75, this.scale - 0.15); this.renderPage(this.pageIndex); });
    zoomIn.addEventListener('click', () => { this.scale = Math.min(2.5, this.scale + 0.15); this.renderPage(this.pageIndex); });
    zoom.append(zoomOut, zoomIn);
    const textHeading = document.createElement('h3'); textHeading.textContent = 'Add words';
    const textLabel = document.createElement('label'); textLabel.className = 'pdf-field'; textLabel.textContent = 'What should the PDF say?';
    const textInput = document.createElement('textarea'); textInput.id = 'pdf-text-value'; textInput.rows = 2; textInput.maxLength = 500;
    textInput.placeholder = 'Type your name or other details'; textInput.setAttribute('aria-label', 'Text to place on PDF'); textLabel.append(textInput);
    const textSizeLabel = document.createElement('label'); textSizeLabel.className = 'pdf-size-label'; textSizeLabel.htmlFor = 'pdf-text-size'; textSizeLabel.textContent = 'Text size';
    const textSize = document.createElement('input'); textSize.type = 'range'; textSize.id = 'pdf-text-size'; textSize.min = '7'; textSize.max = '28'; textSize.value = '12';
    const addText = makeButton('Place text on PDF', 'Click page to place text', 'type'); addText.id = 'pdf-add-text'; addText.setAttribute('aria-pressed', 'false');
    addText.addEventListener('click', () => {
      if (!textInput.value.trim()) { this.notify('Enter text before placing it on the PDF.', 'error'); textInput.focus(); return; }
      this.activeTool = this.activeTool === 'text' ? 'select' : 'text';
      addText.setAttribute('aria-pressed', String(this.activeTool === 'text'));
      addText.classList.toggle('button-primary', this.activeTool === 'text'); addText.classList.toggle('button-secondary', this.activeTool !== 'text');
      this.overlay.style.cursor = this.activeTool === 'text' ? 'text' : 'default';
      this.notify(this.activeTool === 'text' ? 'Click the PDF where the text should appear.' : 'Text placement cancelled.', 'info');
    });
    const textHint = document.createElement('p'); textHint.className = 'muted tiny'; textHint.textContent = 'Choose Add words, then click the page. Drag the words to move them.';
    const toolHeading = document.createElement('h3'); toolHeading.textContent = 'Add marks to the page';
    const toolDock = document.createElement('div'); toolDock.className = 'pdf-tool-dock'; toolDock.setAttribute('role','group'); toolDock.setAttribute('aria-label','Tools for filling in your PDF');
    const setTool = (tool, button) => {
      this.activeTool = this.activeTool === tool ? 'select' : tool;
      toolDock.querySelectorAll('button').forEach(item => { item.setAttribute('aria-pressed', String(item === button && this.activeTool === tool)); item.classList.toggle('button-primary', item === button && this.activeTool === tool); });
      this.overlay.style.cursor = this.activeTool === 'select' ? 'default' : 'crosshair';
      this.notify(this.activeTool === 'select' ? 'Ready.' : `${label}: click the place on the PDF where it should go.`, 'info');
    };
    for (const [tool,label,icon] of [['tick','Add a tick','check'],['cross','Add a cross','x-square'],['date','Add a date','calendar'],['grid','Text in boxes','type']]) {
      const button = makeButton(label, label, icon);
      button.setAttribute('aria-pressed','false');
      button.addEventListener('click', () => setTool(tool,button));
      toolDock.append(button);
    }
    const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.id = 'pdf-date-value'; dateInput.setAttribute('aria-label','Choose the date');
    const dateFormat=document.createElement('select');dateFormat.id='pdf-date-format';dateFormat.setAttribute('aria-label','Choose how the date should look');
    for(const [value,label] of [['dd/mm/yyyy','DD/MM/YYYY'],['dd-mm-yyyy','DD-MM-YYYY'],['mm/dd/yyyy','MM/DD/YYYY'],['yyyy-mm-dd','YYYY-MM-DD']]){const option=document.createElement('option');option.value=value;option.textContent=label;dateFormat.append(option);}
    const gridInput = document.createElement('input'); gridInput.type = 'text'; gridInput.id = 'pdf-grid-value'; gridInput.maxLength = 80; gridInput.placeholder = 'Type letters or numbers'; gridInput.setAttribute('aria-label','Letters or numbers for boxes');
    const detectButton = makeButton('Find boxes on this page', 'Find boxes', 'scan-search');
    detectButton.id = 'pdf-detect-boxes';
    detectButton.addEventListener('click', () => this.detectCurrentPage());
    const photoInput = document.createElement('input'); photoInput.type = 'file'; photoInput.accept = 'image/png,image/jpeg'; photoInput.id = 'pdf-photo-picker'; photoInput.setAttribute('aria-label','Choose a photo to add');
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0]; if (!file) return;
      if (file.size > 8*1024*1024) { this.notify('Choose a photo smaller than 8 MB.','error'); photoInput.value=''; return; }
      try {
        const bitmap = await createImageBitmap(file);
        if (bitmap.width*bitmap.height > 16_777_216) throw new RangeError('This photo has too many pixels.');
        const imageCanvas = document.createElement('canvas'); imageCanvas.width=bitmap.width; imageCanvas.height=bitmap.height;
        imageCanvas.getContext('2d').drawImage(bitmap,0,0); bitmap.close?.();
        this.pendingPhoto = { imageCanvas, mimeType:'image/png' };
        this.activeTool = 'photo'; this.notify('Photo ready. Click the PDF where it should appear.','info');
      } catch (error) { this.notify(error.message || 'The photo could not be opened.','error'); }
      photoInput.value='';
    });
    const photoLabel = document.createElement('label'); photoLabel.className='pdf-field'; photoLabel.textContent='Add a photo'; photoLabel.append(photoInput);
    const placementWidthLabel=document.createElement('label');placementWidthLabel.className='pdf-size-label';placementWidthLabel.htmlFor='pdf-placement-width';placementWidthLabel.textContent='Change size';
    const placementWidth=document.createElement('input');placementWidth.type='range';placementWidth.id='pdf-placement-width';placementWidth.min='12';placementWidth.max='360';placementWidth.value='120';placementWidth.disabled=true;
    placementWidth.addEventListener('input',()=>this.resizeCurrentPlacement(Number(placementWidth.value)));
    
    const formHeading = document.createElement('h3'); formHeading.textContent = 'Fill in form boxes';
    const formArea = document.createElement('div'); formArea.className = 'pdf-form-fields';
    const supported = this.fields.filter(field => field.supported);
    if (!supported.length) { const note = document.createElement('p'); note.className = 'muted tiny'; note.textContent = 'No interactive fields were detected. Use Add text to fill printed or scanned boxes.'; formArea.append(note); }
    for (const field of supported) formArea.append(this.#makeFieldControl(field));
    const profileHeading = document.createElement('h3'); profileHeading.textContent = 'Add your saved details';
    const profileArea = document.createElement('div'); profileArea.className='pdf-profile-apply';
    const profileSelect = document.createElement('select'); profileSelect.id='pdf-profile-select'; profileSelect.setAttribute('aria-label','Choose a personal profile');
    const profilePlaceholder=document.createElement('option'); profilePlaceholder.value=''; profilePlaceholder.textContent='Choose a saved profile'; profileSelect.append(profilePlaceholder);
    const profiles=await this.getPersonalProfiles();
    for(const profile of profiles){const option=document.createElement('option');option.value=profile.id;option.textContent=profile.name;profileSelect.append(option);}
    const applyProfile=makeButton('Add saved details to matching boxes','Add my details','user'); applyProfile.id='pdf-apply-profile'; applyProfile.disabled=!profiles.length;
    applyProfile.addEventListener('click',async()=>{
      const profile=profiles.find(item=>item.id===profileSelect.value);
      if(!profile){this.notify('Choose your saved details first.','error');return;}
      const mapped=mapProfileFields(profile,this.fields);
      if(!Object.keys(mapped).length){this.notify('No matching text fields were found. Check the PDF field names and your profile.','info');return;}
      Object.assign(this.fieldValues,mapped);
      for(const [name,value] of Object.entries(mapped)){const control=this.toolsContainer.querySelector(`[aria-label="${CSS.escape(name)}"]`);if(control)control.value=value;}
      this.notify(`Added your details to ${Object.keys(mapped).length} boxes. Check them before saving.`,'success');
    });
    profileArea.append(profileSelect,applyProfile);
    
    const signatureHeading = document.createElement('h3'); signatureHeading.textContent = 'Add your signature';
    const signatureSelect = document.createElement('select'); signatureSelect.id = 'pdf-signature-select'; signatureSelect.setAttribute('aria-label', 'Choose a saved signature');
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose from your library'; signatureSelect.append(placeholder);
    const signatures = await this.getSignatures();
    for (const signature of signatures) { const option = document.createElement('option'); option.value = signature.id; option.textContent = signature.name; signatureSelect.append(option); }
    signatureSelect.addEventListener('change', async () => {
      const id = signatureSelect.value; this.activeSignature = null; this.currentPlacement = null; this.overlay.dataset.signatureReady = 'false'; this.#drawPlacements(); this.#updatePageControls();
      if (!id) return;
      try { this.activeSignature = await this.getSignature(id); this.overlay.dataset.signatureReady = String(Boolean(this.activeSignature?.image?.data)); this.#drawPlacements(); this.#updatePageControls(); }
      catch (error) { this.notify(error.message || 'The selected signature could not be loaded.', 'error'); }
    });
    const sizeLabel = document.createElement('label'); sizeLabel.className = 'pdf-size-label'; sizeLabel.textContent = 'Change signature size';
    const sizeInput = document.createElement('input'); sizeInput.type = 'range'; sizeInput.id = 'pdf-signature-width'; sizeInput.min = '70'; sizeInput.max = '300'; sizeInput.value = '170';
    sizeInput.addEventListener('input', () => {
      if (this.currentPlacement?.type !== 'signature') return;
      const before=this.#captureState();
      this.currentPlacement.width = Number(sizeInput.value);
      this.currentPlacement.height = this.currentPlacement.width * (this.currentPlacement.image.height / this.currentPlacement.image.width);
      this.#recordHistory(before); this.#drawPlacements();
    });
    const remove = makeButton('Remove the selected item', 'Remove item', 'trash-2'); remove.id = 'pdf-remove-signature'; remove.disabled = true;
    remove.addEventListener('click', () => { if (!this.currentPlacement) return; const before=this.#captureState(); this.placements = this.placements.filter(item => item !== this.currentPlacement); this.textPlacements = this.textPlacements.filter(item => item !== this.currentPlacement); this.overlayPlacements = this.overlayPlacements.filter(item => item !== this.currentPlacement); this.currentPlacement = null; this.#recordHistory(before); this.#drawPlacements(); this.#updatePageControls(); });
    const hint = document.createElement('p'); hint.className = 'muted tiny'; hint.textContent = signatures.length ? 'Choose a signature, then tap or click the PDF page to place it. Drag it to adjust its position.' : 'Save a signature in Signature Studio first. Then return here to place it on this PDF.';
    const flattenLabel = document.createElement('label'); flattenLabel.className = 'pdf-check-label';
    const flatten = document.createElement('input'); flatten.type = 'checkbox'; flatten.id = 'pdf-flatten';
    flattenLabel.append(flatten, document.createTextNode(' Make form boxes uneditable in the saved PDF'));
    const exportButton = makeButton('Save the finished PDF', 'Save finished PDF', 'download'); exportButton.className = 'button button-primary button-wide';
    exportButton.addEventListener('click', () => this.export());
    this.toolsContainer.append(heading, nav, zoom, toolHeading, toolDock, dateInput, dateFormat, gridInput, detectButton, photoLabel, placementWidthLabel, placementWidth, textHeading, textLabel, textSizeLabel, textSize, addText, textHint, formHeading, formArea, profileHeading, profileArea, signatureHeading, signatureSelect, sizeLabel, sizeInput, remove, hint, flattenLabel, exportButton);
  }

  #makeFieldControl(field) {
    const wrapper = document.createElement('label'); wrapper.className = 'pdf-field';
    const title = document.createElement('span'); title.textContent = humanFieldName(field.name); wrapper.append(title);
    let control;
    if (field.kind === 'checkbox') {
      control = document.createElement('input'); control.type = 'checkbox'; control.checked = Boolean(this.fieldValues[field.name]);
      control.addEventListener('change', () => { this.fieldValues[field.name] = control.checked; });
    } else if (field.kind === 'dropdown' || field.kind === 'radio' || field.kind === 'option-list') {
      control = document.createElement('select');
      if (field.kind === 'option-list') control.multiple = true;
      if (field.kind !== 'option-list') { const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Select…'; control.append(empty); }
      for (const value of field.options) { const option = document.createElement('option'); option.value = value; option.textContent = value; option.selected = Array.isArray(this.fieldValues[field.name]) ? this.fieldValues[field.name].includes(value) : this.fieldValues[field.name] === value; control.append(option); }
      control.addEventListener('change', () => { this.fieldValues[field.name] = field.kind === 'option-list' ? [...control.selectedOptions].map(option => option.value) : control.value; });
    } else {
      control = document.createElement('input'); control.type = 'text'; control.value = this.fieldValues[field.name] ?? '';
      control.addEventListener('input', () => { this.fieldValues[field.name] = control.value; });
    }
    control.setAttribute('aria-label', field.name); wrapper.append(control); return wrapper;
  }

  #bindOverlay() {
    this.overlay.addEventListener('pointerdown', event => {
      this.dragStartSnapshot = this.#captureState();
      const point = this.#overlayPoint(event);
      const existing = [...this.placements, ...this.textPlacements, ...this.overlayPlacements].reverse().find(item => item.pageIndex === this.pageIndex && this.#hitPlacement(point, item));
      if (existing) {
        this.currentPlacement = existing;
        this.dragging = true; this.dragOffset = { x: point.x - existing.x, y: point.y - existing.y };
      } else if (this.activeTool === 'text') {
        const text = document.querySelector('#pdf-text-value')?.value?.trim();
        if (!text) { this.notify('Enter text before placing it on the PDF.', 'error'); return; }
        const fontSize = Number(document.querySelector('#pdf-text-size')?.value || 12);
        const width = Math.min(Math.max(120, text.length * fontSize * 0.65), this.overlay.clientWidth);
        const height = fontSize * 1.6;
        const x = clamp(point.x, 0, Math.max(0, this.overlay.clientWidth - width));
        const y = clamp(point.y - height / 2, 0, Math.max(0, this.overlay.clientHeight - height));
        this.currentPlacement = { type: 'text', text, fontSize, pageIndex: this.pageIndex, viewportWidth: this.overlay.clientWidth, viewportHeight: this.overlay.clientHeight, x, y, width, height };
        this.textPlacements.push(this.currentPlacement); this.activeTool = 'select';
        const addTextButton = this.toolsContainer.querySelector('#pdf-add-text');
        addTextButton?.setAttribute('aria-pressed', 'false'); addTextButton?.classList.remove('button-primary'); addTextButton?.classList.add('button-secondary');
        this.overlay.style.cursor = 'default';
        this.dragging = true; this.dragOffset = { x: point.x - x, y: point.y - y };
      } else if (['tick','cross','date','grid','photo'].includes(this.activeTool)) {
        const detected = this.activeTool === 'grid' ? this.detectionRegions.filter(region => region.pageIndex === this.pageIndex && region.bounds.width*region.bounds.height < this.overlay.clientWidth*this.overlay.clientHeight*0.8 && point.x >= region.bounds.x && point.x <= region.bounds.x+region.bounds.width && point.y >= region.bounds.y && point.y <= region.bounds.y+region.bounds.height).sort((a,b)=>(b.bounds.width*b.bounds.height)-(a.bounds.width*a.bounds.height))[0] : null;
        const width = detected ? detected.bounds.width : this.activeTool === 'photo' && this.pendingPhoto ? Math.min(140,this.pendingPhoto.imageCanvas.width) : this.activeTool === 'grid' ? 220 : 22;
        const height = detected ? detected.bounds.height : this.activeTool === 'photo' && this.pendingPhoto ? width*this.pendingPhoto.imageCanvas.height/this.pendingPhoto.imageCanvas.width : this.activeTool === 'grid' ? 28 : 22;
        const x = detected ? detected.bounds.x : clamp(point.x-width/2,0,Math.max(0,this.overlay.clientWidth-width));
        const y = detected ? detected.bounds.y : clamp(point.y-height/2,0,Math.max(0,this.overlay.clientHeight-height));
        let item;
        if (this.activeTool === 'date') {
          const rawDate = document.querySelector('#pdf-date-value')?.value;
          if (!rawDate) { this.notify('Choose a date first.','error'); return; }
          const [year,month,day]=rawDate.split('-');
          const format=document.querySelector('#pdf-date-format')?.value || 'dd/mm/yyyy';
          const value=format==='dd-mm-yyyy'?`${day}-${month}-${year}`:format==='mm/dd/yyyy'?`${month}/${day}/${year}`:format==='yyyy-mm-dd'?rawDate:`${day}/${month}/${year}`;
          item = { type:'date', text:value, fontSize:12, pageIndex:this.pageIndex, viewportWidth:this.overlay.clientWidth, viewportHeight:this.overlay.clientHeight, x,y,width:Math.max(100,width),height };
        } else if (this.activeTool === 'grid') {
          const value = document.querySelector('#pdf-grid-value')?.value || document.querySelector('#pdf-text-value')?.value || '';
          if (!value.trim()) { this.notify('Type the letters or numbers first.','error'); return; }
          const count = Math.max(1,Array.from(value).filter(ch=>ch!==' ').length);
          const cellWidth = width/count;
          const cells = Array.from({length:count},(_,i)=>({x:x+i*cellWidth,y,width:cellWidth,height}));
          const distributed = distributeCharacters(value,cells,{uppercase:true});
          if (distributed.overflow) this.notify(`${distributed.overflow} character(s) do not fit in the selected cells.`,'warning');
          item = { type:'character-grid', cells:distributed.cells.map(c=>({character:c.character,bounds:{x:c.bounds.x,y:c.bounds.y,width:c.bounds.width,height:c.bounds.height}})), pageIndex:this.pageIndex, viewportWidth:this.overlay.clientWidth, viewportHeight:this.overlay.clientHeight, x,y,width,height };
        } else if (this.activeTool === 'photo') {
          if (!this.pendingPhoto) { this.notify('Choose a photo first.','error'); return; }
          item = { type:'photo', imageCanvas:this.pendingPhoto.imageCanvas, mimeType:'image/png', pageIndex:this.pageIndex, viewportWidth:this.overlay.clientWidth, viewportHeight:this.overlay.clientHeight, x,y,width,height };
          this.pendingPhoto = null;
        } else item = { type:this.activeTool, pageIndex:this.pageIndex, viewportWidth:this.overlay.clientWidth, viewportHeight:this.overlay.clientHeight, x,y,width,height };
        this.overlayPlacements.push(item); this.currentPlacement=item; this.activeTool='select';
        this.overlay.style.cursor='default'; this.dragging=true; this.dragOffset={x:point.x-x,y:point.y-y};
            } else if (this.activeSignature) {
        const aspect = this.activeSignature.image.height / this.activeSignature.image.width;
        const width = Math.min(Number(document.querySelector('#pdf-signature-width')?.value || 170), this.overlay.clientWidth);
        const height = width * aspect;
        const x = clamp(point.x - width / 2, 0, Math.max(0, this.overlay.clientWidth - width));
        const y = clamp(point.y - height / 2, 0, Math.max(0, this.overlay.clientHeight - height));
        this.currentPlacement = { type: 'signature', signatureId: this.activeSignature.id, image: this.activeSignature.image, imageCanvas: imageDataToCanvas(this.activeSignature.image), pageIndex: this.pageIndex, viewportWidth: this.overlay.clientWidth, viewportHeight: this.overlay.clientHeight, x, y, width, height };
        this.placements.push(this.currentPlacement); this.dragging = true; this.dragOffset = { x: point.x - x, y: point.y - y };
      } else return;
      this.overlay.setPointerCapture(event.pointerId); this.#drawPlacements(); this.#updatePageControls();
    });
    this.overlay.addEventListener('pointermove', event => {
      if (!this.dragging || !this.currentPlacement) return;
      const point = this.#overlayPoint(event);
      const nextX = clamp(point.x - this.dragOffset.x, 0, this.overlay.clientWidth - this.currentPlacement.width);
      const nextY = clamp(point.y - this.dragOffset.y, 0, this.overlay.clientHeight - this.currentPlacement.height);
      const dx=nextX-this.currentPlacement.x, dy=nextY-this.currentPlacement.y;
      this.currentPlacement.x=nextX; this.currentPlacement.y=nextY;
      if(this.currentPlacement.type==='character-grid')for(const cell of this.currentPlacement.cells){cell.bounds.x+=dx;cell.bounds.y+=dy;}
      this.#drawPlacements();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.overlay.addEventListener(type, () => {
      this.dragging = false;
      if (type === 'pointerup' && this.dragStartSnapshot) this.#recordHistory(this.dragStartSnapshot);
      this.dragStartSnapshot = null;
    });
    this.overlay.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='z') { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='y') { event.preventDefault(); this.redo(); return; }
      if (event.key === 'Enter' && !this.currentPlacement && this.activeTool === 'text' && document.querySelector('#pdf-text-value')?.value?.trim()) {
        event.preventDefault(); const text = document.querySelector('#pdf-text-value').value.trim(); const fontSize = Number(document.querySelector('#pdf-text-size')?.value || 12);
        const width = Math.min(Math.max(120, text.length * fontSize * 0.65), this.overlay.clientWidth); const height = fontSize * 1.6;
        this.currentPlacement = { type: 'text', text, fontSize, pageIndex: this.pageIndex, viewportWidth: this.overlay.clientWidth, viewportHeight: this.overlay.clientHeight, x: 24, y: 24, width, height };
        this.textPlacements.push(this.currentPlacement); this.activeTool = 'select';
        const addTextButton = this.toolsContainer.querySelector('#pdf-add-text');
        addTextButton?.setAttribute('aria-pressed', 'false'); addTextButton?.classList.remove('button-primary'); addTextButton?.classList.add('button-secondary');
        this.overlay.style.cursor = 'default'; this.#drawPlacements(); this.#updatePageControls();
      } else if (event.key === 'Enter' && !this.currentPlacement && this.activeSignature) {
        event.preventDefault();
        const width = Number(document.querySelector('#pdf-signature-width')?.value || 170);
        const height = width * this.activeSignature.image.height / this.activeSignature.image.width;
        const x = Math.max(0, (this.overlay.clientWidth - width) / 2), y = Math.max(0, (this.overlay.clientHeight - height) / 2);
        this.currentPlacement = { type: 'signature', signatureId: this.activeSignature.id, image: this.activeSignature.image, imageCanvas: imageDataToCanvas(this.activeSignature.image), pageIndex: this.pageIndex, viewportWidth: this.overlay.clientWidth, viewportHeight: this.overlay.clientHeight, x, y, width, height };
        this.placements.push(this.currentPlacement); this.#drawPlacements(); this.#updatePageControls();
      } else if (this.currentPlacement && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault(); const before=this.#captureState(); const oldX=this.currentPlacement.x, oldY=this.currentPlacement.y; const step = event.shiftKey ? 10 : 1;
        if (event.key === 'ArrowUp') this.currentPlacement.y = Math.max(0, this.currentPlacement.y - step);
        if (event.key === 'ArrowDown') this.currentPlacement.y = Math.min(this.overlay.clientHeight - this.currentPlacement.height, this.currentPlacement.y + step);
        if (event.key === 'ArrowLeft') this.currentPlacement.x = Math.max(0, this.currentPlacement.x - step);
        if (event.key === 'ArrowRight') this.currentPlacement.x = Math.min(this.overlay.clientWidth - this.currentPlacement.width, this.currentPlacement.x + step);
        const dx=this.currentPlacement.x-oldX, dy=this.currentPlacement.y-oldY;
        if(this.currentPlacement.type==='character-grid')for(const cell of this.currentPlacement.cells){cell.bounds.x+=dx;cell.bounds.y+=dy;}
        this.#recordHistory(before); this.#drawPlacements();
      } else if (this.currentPlacement && ['Delete','Backspace'].includes(event.key)) {
        event.preventDefault(); const before=this.#captureState(); this.placements = this.placements.filter(item => item !== this.currentPlacement); this.textPlacements = this.textPlacements.filter(item => item !== this.currentPlacement); this.overlayPlacements = this.overlayPlacements.filter(item => item !== this.currentPlacement); this.currentPlacement = null; this.#recordHistory(before); this.#drawPlacements(); this.#updatePageControls();
      }
    });
  }

  #overlayPoint(event) { const rect = this.overlay.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  #hitPlacement(point, placement) { return point.x >= placement.x && point.x <= placement.x + placement.width && point.y >= placement.y && point.y <= placement.y + placement.height; }
  #drawPlacements() {
    const ctx = this.overlay.getContext('2d'); ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const ratio = this.overlay.width / Math.max(1, this.overlay.clientWidth); ctx.save(); ctx.scale(ratio, ratio);
    for (const placement of [...this.placements, ...this.textPlacements, ...this.overlayPlacements].filter(item => item.pageIndex === this.pageIndex || item.pageIndex == null)) {
      if (placement.type === 'text' || placement.type === 'date') {
        ctx.globalAlpha = 1; ctx.fillStyle = '#111827'; ctx.font = `${placement.fontSize || 12}px Arial, sans-serif`; ctx.textBaseline = 'top';
        ctx.fillText(placement.text, placement.x, placement.y);
      } else if (placement.type === 'tick' || placement.type === 'cross') {
        ctx.globalAlpha=1; ctx.strokeStyle='#111827'; ctx.lineWidth=2;
        ctx.beginPath();
        if (placement.type==='tick') { ctx.moveTo(placement.x+placement.width*.15,placement.y+placement.height*.52); ctx.lineTo(placement.x+placement.width*.42,placement.y+placement.height*.8); ctx.lineTo(placement.x+placement.width*.9,placement.y+placement.height*.16); }
        else { ctx.moveTo(placement.x,placement.y); ctx.lineTo(placement.x+placement.width,placement.y+placement.height); ctx.moveTo(placement.x+placement.width,placement.y); ctx.lineTo(placement.x,placement.y+placement.height); }
        ctx.stroke();
      } else if (placement.type==='character-grid') {
        ctx.fillStyle='#111827'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='12px Arial,sans-serif';
        for (const cell of placement.cells) ctx.fillText(cell.character,(cell.bounds.x+cell.bounds.width/2),(cell.bounds.y+cell.bounds.height/2));
      } else { ctx.globalAlpha = 0.92; ctx.drawImage(placement.imageCanvas, placement.x, placement.y, placement.width, placement.height); }
      if (placement === this.currentPlacement) { ctx.globalAlpha = 1; ctx.strokeStyle = '#2459d3'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(placement.x, placement.y, placement.width, placement.height); }
    }
    for (const region of this.detectionRegions.filter(item=>item.pageIndex===this.pageIndex)) {
      ctx.globalAlpha=0.75; ctx.strokeStyle='#d97706'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
      ctx.strokeRect(region.bounds.x,region.bounds.y,region.bounds.width,region.bounds.height);
    }
    ctx.restore();
  }

  #updatePageControls() {
    const label = this.toolsContainer.querySelector('#pdf-page-label'); if (label) label.textContent = `Page ${this.pageIndex + 1} of ${this.pdfJsDocument.numPages}`;
    const previous = this.toolsContainer.querySelector('#pdf-previous'); const next = this.toolsContainer.querySelector('#pdf-next');
    if (previous) previous.disabled = this.pageIndex === 0;
    if (next) next.disabled = this.pageIndex === this.pdfJsDocument.numPages - 1;
    const undo=this.toolsContainer.querySelector('#pdf-undo'); if(undo)undo.disabled=!this.undoStack.length;
    const redo=this.toolsContainer.querySelector('#pdf-redo'); if(redo)redo.disabled=!this.redoStack.length;
    const signatureSize=this.toolsContainer.querySelector('#pdf-signature-width'); if(signatureSize)signatureSize.disabled=this.currentPlacement?.type!=='signature';
    const resize=this.toolsContainer.querySelector('#pdf-placement-width'); if(resize){resize.disabled=!this.currentPlacement; if(this.currentPlacement)resize.value=String(Math.round(this.currentPlacement.width));}
    const remove = this.toolsContainer.querySelector('#pdf-remove-signature'); if (remove) remove.disabled = !this.currentPlacement || this.currentPlacement.pageIndex !== this.pageIndex;
  }

  resizeCurrentPlacement(width) {
    const item=this.currentPlacement;
    if(!item || !Number.isFinite(width) || width<=0)return;
    const before=this.#captureState();
    const ratio=width/Math.max(1,item.width);
    item.height*=ratio; item.width=width;
    if(item.type==='character-grid')for(const cell of item.cells){cell.bounds.x=item.x+(cell.bounds.x-item.x)*ratio;cell.bounds.y=item.y+(cell.bounds.y-item.y)*ratio;cell.bounds.width*=ratio;cell.bounds.height*=ratio;}
    this.#recordHistory(before);this.#drawPlacements();
  }

  #captureState() {
    const clone = item => ({ ...item, cells:item.cells?.map(cell=>({character:cell.character,bounds:{...cell.bounds}})), bounds:item.bounds?{...item.bounds}:undefined });
    return { placements:this.placements.map(clone), textPlacements:this.textPlacements.map(clone), overlayPlacements:this.overlayPlacements.map(clone) };
  }
  #historyKey(state) {
    const clean = items => items.map(({image,imageCanvas, ...item})=>item);
    return JSON.stringify({p:clean(state.placements),t:clean(state.textPlacements),o:clean(state.overlayPlacements)});
  }
  #recordHistory(before) {
    if (!before || this.#historyKey(before)===this.#historyKey(this.#captureState())) return;
    this.undoStack.push(before); if(this.undoStack.length>50)this.undoStack.shift();
    this.redoStack.length=0; this.#updatePageControls();
  }
  #restoreState(state) {
    this.placements=state.placements; this.textPlacements=state.textPlacements; this.overlayPlacements=state.overlayPlacements;
    this.currentPlacement=null; this.#drawPlacements(); this.#updatePageControls();
  }
  undo() {
    if(!this.undoStack.length)return;
    this.redoStack.push(this.#captureState());
    this.#restoreState(this.undoStack.pop());
  }
  redo() {
    if(!this.redoStack.length)return;
    this.undoStack.push(this.#captureState());
    this.#restoreState(this.redoStack.pop());
  }

  async detectCurrentPage() {
    try {
      const context=this.canvas.getContext('2d',{willReadFrequently:true});
      const imageData=context.getImageData(0,0,this.canvas.width,this.canvas.height);
      const options={pageWidth:this.overlay.clientWidth,pageHeight:this.overlay.clientHeight,minArea:180};
      const result=typeof Worker==='function' ? await runDetectionWorker(imageData,options) : detectFormGeometry(imageData,options);
      this.detectionRegions=result.regions.map(region=>({...region,pageIndex:this.pageIndex,viewportWidth:this.overlay.clientWidth,viewportHeight:this.overlay.clientHeight}));
      this.#drawPlacements();
      this.notify(result.regions.length ? `Found ${result.regions.length} possible boxes. Check the marked areas before using them.` : 'No boxes found. You can still add marks by hand.','info');
      return result;
    } catch(error) { this.notify(error.message || 'Form detection failed.','error'); return null; }
  }

  async export() {
    try {
      const placements = this.placements.map(item => {
        const pageSize = this.pdfDocument.getPage(item.pageIndex).getSize();
        const ratioX = pageSize.width / item.viewportWidth;
        const ratioY = pageSize.height / item.viewportHeight;
        return { pageIndex: item.pageIndex, pngBytes: imageDataToPngBytes(item.image), x: item.x * ratioX, y: pageSize.height - (item.y + item.height) * ratioY, width: item.width * ratioX, height: item.height * ratioY };
      });
      const textPlacements = this.textPlacements.map(item => {
        const pageSize = this.pdfDocument.getPage(item.pageIndex).getSize();
        const converted={ pageIndex: item.pageIndex, text: item.text, width:item.width*pageSize.width/item.viewportWidth, height:item.height*pageSize.height/item.viewportHeight, ...toPdfTextPlacement(item, { width: item.viewportWidth, height: item.viewportHeight }, pageSize.width, pageSize.height) };
        if (/[^\u0000-\u00ff]/u.test(item.text)) converted.rasterizedPngBytes=rasterizeText(item.text,item.fontSize,item.width,item.height);
        return converted;
      });
      const overlayPlacements = this.overlayPlacements.map(item => {
        const pageSize = this.pdfDocument.getPage(item.pageIndex).getSize();
        const sx=pageSize.width/item.viewportWidth, sy=pageSize.height/item.viewportHeight;
        const bounds={x:item.x*sx,y:pageSize.height-(item.y+item.height)*sy,width:item.width*sx,height:item.height*sy};
        const output={type:item.type,pageIndex:item.pageIndex,bounds,text:item.text,fontSize:item.fontSize};
        if ((item.type==='text'||item.type==='date') && /[^\u0000-\u00ff]/u.test(item.text||'')) output.rasterizedPngBytes=rasterizeText(item.text,item.fontSize,item.width,item.height);
        if (item.type==='character-grid') output.cells=item.cells.map(cell=>({
          character:cell.character,
          bounds:{x:cell.bounds.x*sx,y:pageSize.height-(cell.bounds.y+cell.bounds.height)*sy,width:cell.bounds.width*sx,height:cell.bounds.height*sy},
          ...(/[^\u0000-\u00ff]/u.test(cell.character||'')?{rasterizedPngBytes:rasterizeText(cell.character,12,cell.bounds.width,cell.bounds.height)}:{})
        }));
        if (item.type==='photo') { output.bytes=imageDataToPngBytes({width:item.imageCanvas.width,height:item.imageCanvas.height,data:item.imageCanvas.getContext('2d').getImageData(0,0,item.imageCanvas.width,item.imageCanvas.height).data}); output.mimeType='image/png'; }
        return output;
      });
      const bytes = await exportPdf(this.pdfBytes, { placements, textPlacements, overlayPlacements, fields: this.fields, values: this.fieldValues, flatten: Boolean(document.querySelector('#pdf-flatten')?.checked) });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'signstudio-completed.pdf'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      this.notify('Your finished PDF has been saved.', 'success');
    } catch (error) { this.notify(error.message || 'The PDF could not be exported.', 'error'); }
  }
}

function humanFieldName(name) {
  const words=String(name||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b(?:txt|fld)\b/gi,'').trim();
  const known={fullname:'Full name',firstname:'First name',lastname:'Last name',dob:'Date of birth',dateofbirth:'Date of birth',mobile:'Mobile number',mobilenumber:'Mobile number',emailaddress:'Email address',pincode:'PIN code',zipcode:'PIN code'};
  return known[words.toLowerCase().replace(/\s+/g,'')] || words.replace(/\b\w/g,char=>char.toUpperCase()) || 'Answer';
}
function makeButton(label, text, icon = '') { const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-secondary'; button.setAttribute('aria-label', label); if (icon) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true'); const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `${import.meta.env.BASE_URL}icons/ui.svg#${icon}`); svg.append(use); button.append(svg); } if (text) button.append(document.createTextNode(text)); return button; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function imageDataToCanvas(imageData) { const canvas = document.createElement('canvas'); canvas.width = imageData.width; canvas.height = imageData.height; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height), 0, 0); return canvas; }
function rasterizeText(text,fontSize,width,height) {
  const scale=2,canvas=document.createElement('canvas');
  canvas.width=Math.max(2,Math.ceil(width*scale));canvas.height=Math.max(2,Math.ceil(height*scale));
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#111827';ctx.font=`${fontSize||12}px Arial, sans-serif`;ctx.textBaseline='top';
  ctx.direction=/[\u0590-\u08ff]/u.test(text)?'rtl':'ltr';
  ctx.fillText(String(text),2,1,Math.max(1,width-4));
  const encoded=atob(canvas.toDataURL('image/png').split(',')[1]);
  return Uint8Array.from(encoded,char=>char.charCodeAt(0));
}
function imageDataToPngBytes(imageData) { const canvas = imageDataToCanvas(imageData); const data = atob(canvas.toDataURL('image/png').split(',')[1]); return Uint8Array.from(data, char => char.charCodeAt(0)); }


let detectionWorkerSequence = 0;
function runDetectionWorker(imageData, options) {
  return new Promise((resolve,reject)=>{
    let worker;
    try { worker=new Worker(new URL('./form-detection.worker.js',import.meta.url),{type:'module'}); }
    catch { resolve(detectFormGeometry(imageData,options)); return; }
    const id=++detectionWorkerSequence;
    worker.addEventListener('message',event=>{
      if(event.data?.id!==id)return;
      worker.terminate();
      if(event.data.error)reject(Object.assign(new Error(event.data.error.message),{name:event.data.error.name}));
      else resolve(event.data.result);
    });
    worker.addEventListener('error',error=>{worker.terminate();reject(error);},{once:true});
    const copy=new Uint8ClampedArray(imageData.data);
    worker.postMessage({id,imageData:{width:imageData.width,height:imageData.height,data:copy},options},[copy.buffer]);
  });
}
