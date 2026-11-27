import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { derivePassphraseKey, encryptPayload, decryptPayload } from '../../src/security/crypto.js';

describe('local encryption', () => {
  test('round-trips encrypted payloads', async () => {
    const key = await derivePassphraseKey('correct horse battery staple', new Uint8Array(16));
    const encrypted = await encryptPayload(key, new TextEncoder().encode('signature-data'));
    const plain = await decryptPayload(key, encrypted);
    assert.equal(new TextDecoder().decode(plain), 'signature-data');
  });
  test('rejects tampered ciphertext', async () => {
    const key = await derivePassphraseKey('a sufficiently long passphrase', new Uint8Array(16));
    const encrypted = await encryptPayload(key, new TextEncoder().encode('value'));
    encrypted.ciphertext[0] ^= 1;
    await assert.rejects(decryptPayload(key, encrypted));
  });
});
