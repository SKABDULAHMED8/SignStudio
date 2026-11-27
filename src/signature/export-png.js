export function suggestedFilename(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `signature-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}

export async function encodePng(imageData) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const context = canvas.getContext('2d');
    context.putImageData(new ImageData(imageData.data, imageData.width, imageData.height), 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const canvas = document.createElement('canvas'); canvas.width = imageData.width; canvas.height = imageData.height;
  const context = canvas.getContext('2d'); context.putImageData(new ImageData(imageData.data, imageData.width, imageData.height), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
}

export async function savePng(imageData, fileName = suggestedFilename()) {
  const blob = await encodePng(imageData);
  if (typeof showSaveFilePicker === 'function') {
    try {
      const handle = await showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }] });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      return { method: 'picked', message: 'Your transparent signature was saved to the selected location.' };
    } catch (error) {
      if (error.name === 'AbortError') return { method: 'cancelled', message: 'Save cancelled. Your signature is still open in SignStudio.' };
      throw error;
    }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { method: 'download', message: 'Your signature was downloaded. Check your browser’s Downloads folder.' };
}
