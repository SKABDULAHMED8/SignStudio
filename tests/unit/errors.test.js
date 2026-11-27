import test from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_MESSAGES } from '../../src/errors/codes.js';

test('each documented support error code has a plain-language message', () => {
  for (const code of ['SS-CAM-101','SS-IMG-201','SS-IMG-202','SS-IMG-203','SS-STO-301','SS-STO-302','SS-STO-303','SS-SAV-401','SS-OFF-501','SS-ENC-601']) {
    assert.equal(typeof ERROR_MESSAGES[code], 'string');
    assert.ok(ERROR_MESSAGES[code].length > 10);
  }
});
