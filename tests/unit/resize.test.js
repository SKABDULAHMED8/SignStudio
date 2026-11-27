import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeNearestPremultiplied } from '../../src/signature/processing/pipeline.js';

test('resize preserves alpha and does not introduce an opaque paper background', () => {
  const source = { width: 2, height: 1, data: new Uint8ClampedArray([36,104,172,0,36,104,172,128]) };
  const result = resizeNearestPremultiplied(source, 4, 2);
  assert.equal(result.width, 4);
  assert.equal(result.height, 2);
  assert.ok(result.data.some((value, index) => index % 4 === 3 && value === 0));
  assert.ok(result.data.some((value, index) => index % 4 === 3 && value === 128));
});
