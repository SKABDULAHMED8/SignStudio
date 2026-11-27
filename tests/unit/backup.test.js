import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createEncryptedBackup, openEncryptedBackup } from '../../src/library/backup.js';

describe('encrypted backups', () => {
  test('round-trips records with a passphrase', async () => {
    const blob = await createEncryptedBackup([{ id: 'one', name: 'Signature', image: { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) } }], 'a secure backup passphrase');
    const text = await blob.text();
    const opened = await openEncryptedBackup(text, 'a secure backup passphrase');
    assert.equal(opened.records[0].name, 'Signature');
    assert.ok(opened.records[0].image.data instanceof Uint8ClampedArray);
    assert.deepEqual([...opened.records[0].image.data], [10, 20, 30, 255]);
  });
  test('rejects a wrong backup passphrase', async () => {
    const blob = await createEncryptedBackup([{ id: 'one' }], 'a secure backup passphrase');
    await assert.rejects(openEncryptedBackup(await blob.text(), 'a wrong backup passphrase'));
  });
});
