import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreFromEncryptedBackup } from '../../src/recovery/restore.js';
import { createEncryptedBackup } from '../../src/library/backup.js';
import { createDeviceKey } from '../../src/security/crypto.js';
import { PersonalProfileStore } from '../../src/library/personal-profiles.js';

class MemoryRepository {
  stores = new Map(['signatures','trash','settings','keys','personal-profiles'].map(name => [name, new Map()]));
  async put(store, record) { this.stores.get(store).set(record.id, structuredClone(record)); }
  async get(store, id) { return structuredClone(this.stores.get(store).get(id) ?? null); }
  async getAll(store) { return [...this.stores.get(store).values()].map(value => structuredClone(value)); }
  async delete(store, id) { this.stores.get(store).delete(id); }
  async clear(store) { this.stores.get(store).clear(); }
}

test('recovery restores encrypted backup records under a new device key', async () => {
  const repository = new MemoryRepository();
  await repository.put('signatures', { id: 'unreadable', name: 'Old encrypted record', encrypted: { iv: new Uint8Array(12), ciphertext: new Uint8Array(20) } });
  const backup = await createEncryptedBackup([{ name: 'Recovered', ink: 'blue', settings: {}, image: { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) } }], 'backup recovery passphrase');
  const result = await restoreFromEncryptedBackup({ repository, fileText: await backup.text(), passphrase: 'backup recovery passphrase', replaceExisting: true });
  assert.equal(result.restored, 1);
  assert.ok((await repository.get('keys', 'device'))?.key);
  assert.equal((await repository.getAll('signatures')).length, 1);
});

test('recovery clears an old passphrase lock only after a valid backup is restored', async () => {
  const repository = new MemoryRepository();
  await repository.put('settings', { id: 'passphrase-lock', salt: new Uint8Array(16), verifier: { iv: new Uint8Array(12), ciphertext: new Uint8Array(16) } });
  const backup = await createEncryptedBackup([], 'backup recovery passphrase');
  await restoreFromEncryptedBackup({ repository, fileText: await backup.text(), passphrase: 'backup recovery passphrase', replaceExisting: true, clearPassphraseLock: true });
  assert.equal(await repository.get('settings', 'passphrase-lock'), null);
});

test('recovery refuses to replace existing data without explicit confirmation', async () => {
  const repository = new MemoryRepository();
  await repository.put('signatures', { id: 'keep', name: 'Keep this' });
  const backup = await createEncryptedBackup([], 'backup recovery passphrase');
  await assert.rejects(restoreFromEncryptedBackup({ repository, fileText: await backup.text(), passphrase: 'backup recovery passphrase' }), /requires confirmation/i);
  assert.ok(await repository.get('signatures', 'keep'));
});


test('backup restore preserves encrypted personal profiles while rotating the device key', async () => {
  const repository = new MemoryRepository();
  const oldKey = new (await import('../../src/security/key-manager.js')).KeyManager(repository);
  const profileStore = new PersonalProfileStore(repository, () => oldKey.getDeviceKey());
  await profileStore.save({ name: 'Primary', fields: { fullName: 'Ada Lovelace' } });
  const previousKey = (await repository.get('keys','device')).key;
  const backup = await createEncryptedBackup([], 'backup recovery passphrase');
  await restoreFromEncryptedBackup({ repository, fileText: await backup.text(), passphrase: 'backup recovery passphrase', replaceExisting: true });
  const newKey = (await repository.get('keys','device')).key;
  assert.notEqual(newKey, previousKey);
  const newKeyManager = new (await import('../../src/security/key-manager.js')).KeyManager(repository);
  const restoredProfiles = new PersonalProfileStore(repository, () => newKeyManager.getDeviceKey());
  assert.equal((await restoredProfiles.list())[0].fields.fullName, 'Ada Lovelace');
});
