import { applyFormValues } from './forms.js';

export async function exportPdf(pdfBytes, { placements = [], textPlacements = [], overlayPlacements = [], fields = [], values = {}, flatten = false } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.load(pdfBytes);
  const form = document.getForm();
  applyFormValues(form, fields, values);
  if (fields.some(field => field.supported) && typeof form.updateFieldAppearances === 'function') form.updateFieldAppearances();
  for (const placement of placements) {
    assertPage(document, placement.pageIndex);
    const page = document.getPage(placement.pageIndex);
    const image = await document.embedPng(placement.pngBytes);
    page.drawImage(image, { x: placement.x, y: placement.y, width: placement.width, height: placement.height, rotate: placement.rotate });
  }
  const needsText = textPlacements.length || overlayPlacements.some(item => ['text','date','character-grid'].includes(item.type));
  const textFont = needsText ? await document.embedFont(StandardFonts.Helvetica) : null;
  for (const placement of textPlacements) {
    assertPage(document, placement.pageIndex);
    const page = document.getPage(placement.pageIndex);
    if (placement.rasterizedPngBytes) {
      const image=await document.embedPng(placement.rasterizedPngBytes);
      page.drawImage(image,{x:placement.x,y:placement.y,width:placement.width??image.width/2,height:placement.height??image.height/2});
    } else page.drawText(String(placement.text ?? ''), { x: placement.x, y: placement.y, size: placement.fontSize, font: textFont, color: rgb(0.07, 0.09, 0.13), maxWidth: Math.max(1, page.getWidth() - placement.x - 12), lineHeight: placement.fontSize * 1.25 });
  }
  for (const item of overlayPlacements) {
    assertPage(document, item.pageIndex);
    const page = document.getPage(item.pageIndex);
    const b = item.bounds;
    if (!b || ![b.x,b.y,b.width,b.height].every(Number.isFinite)) throw new TypeError('An overlay placement has invalid bounds.');
    if (item.type === 'tick') {
      page.drawLine({ start: { x: b.x + b.width*0.16, y: b.y + b.height*0.52 }, end: { x: b.x + b.width*0.42, y: b.y + b.height*0.24 }, thickness: item.strokeWidth ?? 1.8, color: rgb(0.05,0.1,0.18) });
      page.drawLine({ start: { x: b.x + b.width*0.42, y: b.y + b.height*0.24 }, end: { x: b.x + b.width*0.88, y: b.y + b.height*0.82 }, thickness: item.strokeWidth ?? 1.8, color: rgb(0.05,0.1,0.18) });
    } else if (item.type === 'cross') {
      page.drawLine({ start: { x: b.x, y: b.y }, end: { x: b.x+b.width, y: b.y+b.height }, thickness: item.strokeWidth ?? 1.8, color: rgb(0.05,0.1,0.18) });
      page.drawLine({ start: { x: b.x, y: b.y+b.height }, end: { x: b.x+b.width, y: b.y }, thickness: item.strokeWidth ?? 1.8, color: rgb(0.05,0.1,0.18) });
    } else if (item.type === 'text' || item.type === 'date') {
      if(item.rasterizedPngBytes){const image=await document.embedPng(item.rasterizedPngBytes);page.drawImage(image,{x:b.x,y:b.y,width:b.width,height:b.height});}
      else page.drawText(String(item.text ?? ''), { x: b.x, y: b.y, size: item.fontSize ?? 11, font: textFont, color: rgb(0.07,0.09,0.13), maxWidth: b.width, lineHeight: (item.fontSize ?? 11)*1.2 });
    } else if (item.type === 'character-grid') {
      const cells = item.cells ?? [];
      for (const cell of cells) {
        if (!cell.character) continue;
        const cb = cell.bounds;
        const size = Math.min(item.fontSize ?? cb.height*0.72, cb.height*0.82);
        const text = String(cell.character);
        if(cell.rasterizedPngBytes){const image=await document.embedPng(cell.rasterizedPngBytes);page.drawImage(image,{x:cb.x,y:cb.y,width:cb.width,height:cb.height});}
        else {const width = textFont.widthOfTextAtSize(text, size);page.drawText(text, { x: cb.x + Math.max(0,(cb.width-width)/2), y: cb.y + Math.max(0,(cb.height-size)/2), size, font: textFont, color: rgb(0.07,0.09,0.13), maxWidth: cb.width });}
      }
    } else if (item.type === 'photo') {
      const bytes = item.bytes instanceof Uint8Array ? item.bytes : new Uint8Array(item.bytes ?? []);
      const image = item.mimeType === 'image/jpeg' ? await document.embedJpg(bytes) : await document.embedPng(bytes);
      page.drawImage(image, { x: b.x, y: b.y, width: b.width, height: b.height });
    } else {
      throw new TypeError(`Unsupported overlay placement type: ${item.type}`);
    }
  }
  if (flatten) form.flatten();
  return document.save({ useObjectStreams: true });
}

function assertPage(document, pageIndex) {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.getPageCount()) throw new RangeError('A placement refers to a page that does not exist.');
}
