export function toPdfPoint(clientX, clientY, rect, pageWidth, pageHeight) {
  const scaleX = pageWidth / rect.width;
  const scaleY = pageHeight / rect.height;
  return {
    x: clamp((clientX - rect.left) * scaleX, 0, pageWidth),
    y: clamp(pageHeight - (clientY - rect.top) * scaleY, 0, pageHeight)
  };
}

export function toPdfRect(rect, viewport, pageWidth, pageHeight) {
  const scaleX = pageWidth / viewport.width;
  const scaleY = pageHeight / viewport.height;
  const width = Math.min(Math.max(0, rect.width * scaleX), pageWidth);
  const height = Math.min(Math.max(0, rect.height * scaleY), pageHeight);
  const x = clamp(rect.x * scaleX, 0, pageWidth - width);
  const top = clamp(rect.y * scaleY, 0, pageHeight - height);
  return { x, y: pageHeight - top - height, width, height };
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }


export function toPdfTextPlacement(textPlacement, viewport, pageWidth, pageHeight) {
  const scaleX = pageWidth / viewport.width;
  const scaleY = pageHeight / viewport.height;
  const fontSize = Math.max(1, textPlacement.fontSize * scaleY);
  const x = clamp(textPlacement.x * scaleX, 0, pageWidth);
  const top = clamp((textPlacement.y + textPlacement.fontSize) * scaleY, 0, pageHeight);
  return { x, y: pageHeight - top, fontSize };
}
