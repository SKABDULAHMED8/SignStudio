import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintImage, hammingDistance, findSimilarSignature } from '../../src/library/duplicate-check.js';

function signature({ invert = false, offset = 0 } = {}) {
  const width = 9, height = 8, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ink = (x === y || x === 8 - y) && y > 0 && y < 7;
    const pixel = (y * width + x) * 4;
    const value = ink ? (invert ? 240 : 20) : 255 - offset;
    data[pixel] = value; data[pixel + 1] = value; data[pixel + 2] = value; data[pixel + 3] = 255;
  }
  return { width, height, data };
}

test('fingerprint is stable for an identical signature', () => {
  const image = signature();
  assert.equal(fingerprintImage(image), fingerprintImage(structuredClone(image)));
});

test('similarity detects the same stroke shape despite a small brightness shift', () => {
  const record = { id: 'saved', name: 'Saved', image: signature() };
  const result = findSimilarSignature([record], signature({ offset: 3 }));
  assert.equal(result?.record.id, 'saved');
});

test('different signature shapes are not treated as duplicates', () => {
  const record = { id: 'saved', name: 'Saved', image: signature() };
  const image = signature();
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const offset = (y * image.width + x) * 4; const ink = y === 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = ink ? 20 : 255;
  }
  assert.equal(findSimilarSignature([record], image, 5), null);
});

test('hamming distance counts changed bits', () => {
  assert.equal(hammingDistance('0000000000000000', '0000000000000003'), 2);
});
