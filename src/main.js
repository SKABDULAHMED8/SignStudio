import '../styles/app.css';
import { WorkerClient } from './platform/worker-client.js';
import { decodeImageFile, savePng } from './platform/file-io.js';
import { DEFAULT_PROCESSING_SETTINGS, MAX_INPUT_BYTES } from './signature/processing/constants.js';
import { PdfFiller } from './pdf/simple-pdf-filler.js';

const $ = selector => document.querySelector(selector);
const toast = message => {
  const element = $('#toast-region');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('visible'), 3800);
};

let source = null;
let result = null;
let worker = null;
let pdf = null;
let finalPdfUrl = null;

function clearImagePreview() {
  const canvas = $('#result-canvas');
  canvas.width = 0;
  canvas.height = 0;
  $('#preview-empty').classList.remove('is-hidden');
  $('#image-dimensions').textContent = 'No result yet';
  $('#image-status').textContent = 'Ready for an image';
  $('#source-name').textContent = '';
  $('#image-work').classList.add('is-hidden');
  $('#image-drop').classList.remove('is-hidden');
  $('#process-image').disabled = true;
  $('#download-png').disabled = true;
  $('#image-picker').value = '';
}

function releaseImage() {
  worker?.terminate();
  worker = null;
  if (source?.previewUrl) URL.revokeObjectURL(source.previewUrl);
  source = null;
  result = null;
  clearImagePreview();
}

function clearPdf() {
  pdf?.clear();
  pdf = null;
  if (finalPdfUrl) URL.revokeObjectURL(finalPdfUrl);
  finalPdfUrl = null;
  $('#pdf-final-preview').removeAttribute('src');
  $('#pdf-layout').classList.add('is-hidden');
  $('#pdf-final').classList.add('is-hidden');
  $('#pdf-start').classList.remove('is-hidden');
  $('#pdf-picker').value = '';
}

function showView(name) {
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === name);
  });
  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === name);
  });
  if (name !== 'cleaner') releaseImage();
  if (name !== 'pdf' && pdf) clearPdf();
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.view));
});
document.querySelectorAll('[data-open]').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.open));
});

const imagePicker = $('#image-picker');
const imageDrop = $('#image-drop');
$('#choose-image').addEventListener('click', () => imagePicker.click());
$('#replace-image').addEventListener('click', () => imagePicker.click());
imagePicker.addEventListener('change', () => loadImage(imagePicker.files?.[0]));
imageDrop.addEventListener('dragover', event => {
  event.preventDefault();
  imageDrop.classList.add('dragging');
});
imageDrop.addEventListener('dragleave', () => imageDrop.classList.remove('dragging'));
imageDrop.addEventListener('drop', event => {
  event.preventDefault();
  imageDrop.classList.remove('dragging');
  loadImage(event.dataTransfer.files?.[0]);
});

async function loadImage(file) {
  if (!file) return;
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new TypeError('Choose a JPG, PNG or WEBP image.');
    }
    if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
      throw new RangeError('Image must be smaller than 24 MB.');
    }
    releaseImage();
    source = await decodeImageFile(file);
    $('#source-name').textContent = file.name;
    $('#image-drop').classList.add('is-hidden');
    $('#image-work').classList.remove('is-hidden');
    $('#process-image').disabled = false;
    await processImage();
  } catch (error) {
    toast(error.message || 'Image could not be opened.');
  } finally {
    imagePicker.value = '';
  }
}

function processingSettings() {
  return {
    ...DEFAULT_PROCESSING_SETTINGS,
    ink: $('#ink').value,
    sensitivity: Number($('#threshold').value) / 100,
    lightingStrength: Number($('#shadow').value) / 100,
    noiseRemoval: Number($('#noise').value) / 100,
    cropMargin: Number($('#margin').value),
    outputSize: $('#output-size').value === 'original' ? 'original' : Number($('#output-size').value)
  };
}

async function processImage() {
  if (!source) return;
  $('#process-image').disabled = true;
  $('#download-png').disabled = true;
  $('#image-status').textContent = 'Processing image…';
  try {
    worker?.terminate();
    worker = new WorkerClient();
    const output = await worker.process(source.imageData, processingSettings());
    result = output.image;
    const canvas = $('#result-canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    canvas.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(result.data), result.width, result.height),
      0,
      0
    );
    $('#preview-empty').classList.add('is-hidden');
    $('#image-dimensions').textContent = result.width + ' × ' + result.height + ' px · transparent PNG';
    $('#image-status').textContent = 'Processing complete. Review the result.';
    $('#download-png').disabled = false;
  } catch (error) {
    result = null;
    $('#image-status').textContent = error.message || 'Processing failed.';
    toast(error.message || 'Image processing failed.');
  } finally {
    worker?.terminate();
    worker = null;
    $('#process-image').disabled = false;
  }
}

['threshold', 'shadow', 'noise', 'margin', 'ink', 'output-size'].forEach(id => {
  $('#' + id).addEventListener('change', () => {
    ['threshold', 'shadow', 'noise'].forEach(key => {
      $('#' + key + '-value').textContent = $('#' + key).value + '%';
    });
    $('#margin-value').textContent = $('#margin').value + ' px';
    if (source) processImage();
  });
});

$('#download-png').addEventListener('click', async () => {
  if (!result) return;
  try {
    await savePng(result);
    toast('Transparent PNG export is ready.');
  } catch (error) {
    toast(error.message || 'PNG export failed.');
  }
});

document.querySelectorAll('[data-bg]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-bg]').forEach(item => item.classList.toggle('selected', item === button));
    $('#preview-area').className = 'preview-area ' + (button.dataset.bg === 'checker' ? 'checker' : button.dataset.bg);
  });
});

$('#clear-image').addEventListener('click', releaseImage);

const pdfPicker = $('#pdf-picker');
$('#choose-pdf').addEventListener('click', () => pdfPicker.click());
pdfPicker.addEventListener('change', async () => {
  const file = pdfPicker.files?.[0];
  if (!file) return;
  try {
    clearPdf();
    pdf = new PdfFiller({
      canvas: $('#pdf-canvas'),
      overlay: $('#pdf-overlay'),
      fieldsContainer: $('#pdf-fields-list'),
      notify: toast,
      onPageChange: (page, total) => {
        $('#pdf-page-title').textContent = 'Page ' + (page + 1) + ' of ' + total;
        $('#pdf-prev').disabled = page === 0;
        $('#pdf-next').disabled = page === total - 1;
      }
    });
    await pdf.open(file);
    $('#pdf-start').classList.add('is-hidden');
    $('#pdf-layout').classList.remove('is-hidden');
  } catch (error) {
    toast(error.message || 'PDF could not be opened.');
    clearPdf();
  } finally {
    pdfPicker.value = '';
  }
});

$('#pdf-prev').addEventListener('click', () => pdf?.renderPage(pdf.pageIndex - 1));
$('#pdf-next').addEventListener('click', () => pdf?.renderPage(pdf.pageIndex + 1));
$('#pdf-add-text').addEventListener('click', () => pdf?.setTool('text', $('#pdf-text').value));
$('#pdf-add-photo').addEventListener('click', () => $('#pdf-photo-picker').click());
$('#pdf-photo-picker').addEventListener('change', async () => {
  const file = $('#pdf-photo-picker').files?.[0];
  if (!file) return;
  try {
    await pdf?.addPhoto(file);
  } catch (error) {
    toast(error.message || 'Photo could not be added.');
  } finally {
    $('#pdf-photo-picker').value = '';
  }
});
document.querySelectorAll('[data-mark]').forEach(button => {
  button.addEventListener('click', () => pdf?.setTool(button.dataset.mark));
});

$('#pdf-export').addEventListener('click', async () => {
  try {
    const bytes = await pdf.export();
    if (finalPdfUrl) URL.revokeObjectURL(finalPdfUrl);
    finalPdfUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    $('#pdf-final-preview').src = finalPdfUrl;
    $('#pdf-layout').classList.add('is-hidden');
    $('#pdf-final').classList.remove('is-hidden');
  } catch (error) {
    toast(error.message || 'PDF could not be prepared.');
  }
});

$('#pdf-download').addEventListener('click', () => {
  if (!finalPdfUrl) return;
  const link = document.createElement('a');
  link.href = finalPdfUrl;
  link.download = 'signstudio-edited.pdf';
  link.click();
});
$('#pdf-back-edit').addEventListener('click', () => {
  $('#pdf-final').classList.add('is-hidden');
  $('#pdf-layout').classList.remove('is-hidden');
});
$('#pdf-clear').addEventListener('click', clearPdf);

window.addEventListener('pagehide', () => {
  releaseImage();
  clearPdf();
});
