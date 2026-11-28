export function createSignaturePad(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('A signature canvas is required.');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Signature drawing is not supported by this browser.');
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = 1000;
  const height = 300;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  context.scale(pixelRatio, pixelRatio);
  context.lineWidth = 3.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#172b4d';
  let drawing = false;
  let hasInk = false;
  const point = event => {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * width / bounds.width, y: (event.clientY - bounds.top) * height / bounds.height };
  };
  const start = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + 0.01, p.y + 0.01);
    context.stroke();
    drawing = true;
    hasInk = true;
  };
  const move = event => {
    if (!drawing) return;
    event.preventDefault();
    const p = point(event);
    context.lineTo(p.x, p.y);
    context.stroke();
  };
  const stop = () => { drawing = false; context.closePath(); };
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('lostpointercapture', stop);
  return {
    clear() { context.clearRect(0, 0, width, height); hasInk = false; drawing = false; },
    get hasInk() { return hasInk; },
    exportPng() {
      if (!hasInk) throw new Error('Draw your signature before using it.');
      return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The signature image could not be created.')), 'image/png'));
    },
    destroy() {
      stop();
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', stop);
      canvas.removeEventListener('pointercancel', stop);
      canvas.removeEventListener('lostpointercapture', stop);
    }
  };
}
