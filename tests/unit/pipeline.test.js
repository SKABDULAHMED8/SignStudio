import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAlpha, createInkMask, cropToContent, processSignature, recolorInk, resizeOutput, rgbToHsv, removeNoise } from '../../src/signature/processing/pipeline.js';

const makeImage = (pixels, width = pixels.length, height = 1) => ({ width, height, data: new Uint8ClampedArray(pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a])) });

describe('signature processing pipeline', () => {
  test('converts RGB colours to HSV hue degrees', () => {
    assert.ok(Math.abs(rgbToHsv(0, 0, 255).h - 240) < 0.001);
    assert.ok(Math.abs(rgbToHsv(255, 0, 0).h) < 0.001);
  });

  test('keeps blue ink and rejects bright paper', () => {
    const image = makeImage([[25, 65, 210], [250, 250, 248]]);
    const mask = createInkMask(image, [250, 250, 248], { ink: 'blue', sensitivity: 0.8 });
    assert.ok(mask[0] > 0);
    assert.equal(mask[1], 0);
  });

  test('creates continuous alpha for faint edges', () => {
    const alpha = calculateAlpha(new Float32Array([0, 0.25, 0.65, 1]), 4, 1, 0.7);
    assert.ok(alpha[1] > 0);
    assert.ok(alpha[1] < alpha[2]);
    assert.ok(alpha[2] < 255);
  });

  test('crops to ink with a clamped margin', () => {
    const image = makeImage(Array.from({ length: 25 }, () => [255, 255, 255]), 5, 5);
    const alpha = new Uint8ClampedArray(25); alpha[12] = 255;
    const crop = cropToContent(image, alpha, 1);
    assert.equal(crop.width, 3); assert.equal(crop.height, 3);
    assert.deepEqual(crop.origin, { x: 1, y: 1 });
  });

  test('recolours RGB but preserves each pixel alpha', () => {
    const input = makeImage([[10, 20, 30, 70], [30, 40, 50, 200]], 2, 1);
    const result = recolorInk(input, '#2468ac');
    assert.deepEqual([...result.data], [36, 104, 172, 70, 36, 104, 172, 200]);
  });

  test('removes small connected specks but keeps a larger component', () => {
    const alpha = new Uint8ClampedArray(36); alpha[0] = 255; alpha[14] = 255; alpha[15] = 255; alpha[16] = 255; alpha[20] = 255; alpha[21] = 255; alpha[22] = 255;
    const result = removeNoise(alpha, 6, 6, 0.3);
    assert.equal(result[0], 0);
    assert.equal(result[14], 255);
    assert.equal(result[15], 255);
    assert.equal(result[16], 255);
    assert.equal(result[20], 255);
  });

  test('never upscales and caps output dimensions', () => {
    assert.deepEqual(resizeOutput({ width: 400, height: 200 }, 1024), { width: 400, height: 200, scale: 1 });
    assert.equal(Math.max(resizeOutput({ width: 6000, height: 3000 }, 'original').width, resizeOutput({ width: 6000, height: 3000 }, 'original').height), 4096);
  });

  test('detects blue ink after lighting normalization without losing its contrast signal', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const ink = y >= 29 && y <= 33 && x >= 12 && x <= 51;
      const offset = (y * width + x) * 4;
      data[offset] = ink ? 20 : 255;
      data[offset + 1] = ink ? 55 : 255;
      data[offset + 2] = ink ? 120 : 255;
      data[offset + 3] = 255;
    }
    const result = processSignature({ width, height, data }, { ink: 'blue' });
    assert.ok(result.image.data.some((value, index) => index % 4 === 3 && value > 0));
    assert.ok(result.image.data.some((value, index) => index % 4 === 3 && value === 0));
  });

});

test('sensitivity slider has deterministic monotonic edge retention', () => {
  const image = makeImage([[150, 165, 220]]);
  const weak = createInkMask(image, [250, 250, 250], { ink: 'blue', sensitivity: 0.2 });
  const strong = createInkMask(image, [250, 250, 250], { ink: 'blue', sensitivity: 0.9 });
  assert.ok(strong[0] >= weak[0]);
});
