import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { SignatureLibrary, TRASH_MS, MAX_SIGNATURES } from '../../src/library/library.js';
import { createDeviceKey } from '../../src/security/crypto.js';

class MemoryRepository {
  stores = new Map(['signatures','trash','settings','keys'].map(name => [name, new Map()]));
  async put(store, record) { this.stores.get(store).set(record.id, structuredClone(record)); }
  async get(store, id) { return structuredClone(this.stores.get(store).get(id) ?? null); }
  async getAll(store) { return [...this.stores.get(store).values()].map(value => structuredClone(value)); }
  async delete(store, id) { this.stores.get(store).delete(id); }
}

const sample = { width: 1, height: 1, data: new Uint8ClampedArray([1,2,3,128]) };

describe('SignatureLibrary lifecycle', () => {
  test('stores encrypted records and decrypts them only through the library', async () => {
    const repository = new MemoryRepository(), key = await createDeviceKey();
    const library = new SignatureLibrary(repository, async () => key);
    const saved = await library.save({ name: 'Test', image: sample, ink: 'blue', settings: { sensitivity: 0.5 } });
    const raw = await repository.get('signatures', saved.id);
    assert.equal(raw.encrypted.algorithm, 'AES-GCM');
    assert.equal(Object.hasOwn(raw, 'name'), false, 'signature names must not be stored in plaintext');
    assert.equal(raw.encrypted.ciphertext instanceof Uint8Array, true);
    assert.ok(raw.imageEncrypted?.ciphertext instanceof Uint8Array);
    const values = await library.list();
    assert.equal(values[0].name, 'Test');
    assert.equal(values[0].image, undefined, 'library lists must not load full signature pixel buffers');
    assert.ok(values[0].thumbnail?.data);
    assert.deepEqual([...((await library.get(saved.id)).image.data)], [1,2,3,128]);
    assert.deepEqual([...((await library.exportRecords())[0].image.data)], [1,2,3,128]);
  });

  test('rename changes the encrypted name without writing it as plaintext metadata', async () => {
    const repository = new MemoryRepository(), key = await createDeviceKey();
    const library = new SignatureLibrary(repository, async () => key);
    const saved = await library.save({ name: 'Original name', image: sample, ink: 'blue', settings: {} });
    await library.rename(saved.id, 'Private renamed label');
    const raw = await repository.get('signatures', saved.id);
    assert.equal(Object.hasOwn(raw, 'name'), false);
    assert.equal((await library.list())[0].name, 'Private renamed label');
  });

  test('replace updates the same record and retains up to ten encrypted versions', async () => {
    const repository = new MemoryRepository(), key = await createDeviceKey();
    const library = new SignatureLibrary(repository, async () => key);
    const first = await library.save({ name: 'One', image: sample, ink: 'blue', settings: {} });
    const replaced = await library.save({ name: 'One', image: sample, ink: 'red', settings: {}, replaceId: first.id });
    const record = await repository.get('signatures', first.id);
    assert.equal(replaced.id, first.id);
    assert.equal(record.versions.length, 1);
    assert.equal((await library.list())[0].ink, 'red');
    assert.equal((await library.get(first.id)).image.data[0], sample.data[0]);
  });

  test('restores a previous version and preserves the replaced current version', async () => {
    const repository = new MemoryRepository(), key = await createDeviceKey();
    const library = new SignatureLibrary(repository, async () => key);
    const first = await library.save({ name: 'Version one', image: sample, ink: 'blue', settings: {} });
    const changed = { ...sample, data: new Uint8ClampedArray(sample.data) }; changed.data[0] = 180;
    await library.save({ name: 'Version two', image: changed, ink: 'red', settings: {}, replaceId: first.id });
    const versions = await library.listVersions(first.id);
    assert.equal(versions.length, 1);
    assert.equal(versions[0].name, 'Version one');
    await library.restoreVersion(first.id, 0);
    const restored = await library.list();
    assert.equal(restored[0].name, 'Version one');
    assert.equal(restored[0].versions, 1);
    assert.equal((await library.listVersions(first.id))[0].name, 'Version two');
  });

  test('discard is undoable before expiry and expired trash is purged', async () => {
    const repository = new MemoryRepository(), key = await createDeviceKey();
    const library = new SignatureLibrary(repository, async () => key);
    const saved = await library.save({ name: 'Undo', image: sample, ink: 'black', settings: {} });
    await library.discard(saved.id);
    assert.equal(await library.restore(saved.id), true);
    await library.discard(saved.id);
    await library.purgeExpiredTrash(Date.now() + TRASH_MS + 1);
    assert.equal(await repository.get('trash', saved.id), null);
  });

  test('enforces the 100 saved signature cap', async () => {
    const repository = new MemoryRepository(), key = await createDeviceKey();
    const library = new SignatureLibrary(repository, async () => key);
    for (let i = 0; i < MAX_SIGNATURES; i++) await library.save({ name: `S${i}`, image: sample, ink: 'black', settings: {} });
    await assert.rejects(library.save({ name: 'Over limit', image: sample, ink: 'black', settings: {} }), /library is full/i);
  });
});
