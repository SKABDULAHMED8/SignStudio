import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageFile } from '../../src/signature/validate.js';

describe('image validation', () => {
  test('accepts supported image MIME types within size limits', () => {
    assert.deepEqual(validateImageFile({ type: 'image/png', size: 100 }), { valid: true });
  });
  test('rejects unsupported formats and oversized images', () => {
    assert.equal(validateImageFile({ type: 'application/pdf', size: 100 }).valid, false);
    assert.equal(validateImageFile({ type: 'image/jpeg', size: 30 * 1024 * 1024 }).valid, false);
  });
});
