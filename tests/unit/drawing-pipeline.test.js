import test from 'node:test';
import assert from 'node:assert/strict';
import { processTransparentSignature } from '../../src/signature/processing/pipeline.js';

test('transparent drawing input is cropped and recoloured without paper estimation', () => {
  const width = 5, height = 5;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 1; y <= 3; y++) {
    const pixel = (y * width + y) * 4;
    data[pixel] = 30; data[pixel + 1] = 80; data[pixel + 2] = 220; data[pixel + 3] = 255;
  }
  const result = processTransparentSignature({ width, height, data }, { ink: 'red', cropMargin: 0, noiseRemoval: 0, outputSize: 'original' });
  assert.equal(result.image.width, 3);
  assert.equal(result.image.height, 3);
  assert.deepEqual([...result.image.data.slice(4, 8)], [201, 54, 54, 0]);
  assert.equal(result.image.data[(1 * 3 + 1) * 4 + 3], 255);
});

test('transparent drawing input rejects a blank canvas', () => {
  assert.throws(() => processTransparentSignature({ width: 2, height: 2, data: new Uint8ClampedArray(16) }), /No signature ink/i);
});
