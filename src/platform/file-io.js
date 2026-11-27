import { savePng } from '../signature/export-png.js';
import { MAX_INPUT_PIXELS } from '../signature/processing/constants.js';

export async function decodeImageFile(file) {
  let bitmap;
  if ('createImageBitmap' in globalThis) bitmap = await createImageBitmap(file);
  else {
    const url = URL.createObjectURL(file);
    try { const image = new Image(); image.src = url; await image.decode(); bitmap = image; }
    finally { URL.revokeObjectURL(url); }
  }
  if (bitmap.width * bitmap.height > MAX_INPUT_PIXELS) { bitmap.close?.(); throw new RangeError('This image has too many pixels to process safely.'); }
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bitmap.width, bitmap.height) : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0); const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height); bitmap.close?.();
  return { imageData, previewUrl: URL.createObjectURL(file) };
}

export { savePng };
