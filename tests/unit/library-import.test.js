import test from 'node:test';
import assert from 'node:assert/strict';
import { SignatureLibrary } from '../../src/library/library.js';
import { createDeviceKey } from '../../src/security/crypto.js';

class MemoryRepository {
  stores = new Map(['signatures','trash','settings','keys'].map(name => [name, new Map()]));
  async put(store, record) { this.stores.get(store).set(record.id, structuredClone(record)); }
  async get(store, id) { return structuredClone(this.stores.get(store).get(id) ?? null); }
  async getAll(store) { return [...this.stores.get(store).values()].map(value => structuredClone(value)); }
  async delete(store, id) { this.stores.get(store).delete(id); }
}
const image = { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) };

test('imports backup records into encrypted device storage', async () => {
  const repository = new MemoryRepository();
  const key = await createDeviceKey();
  const library = new SignatureLibrary(repository, async () => key);
  const count = await library.importRecords([{ name: 'Restored', image, ink: 'blue', settings: {} }]);
  assert.equal(count, 1);
  const records = await library.list();
  assert.equal(records[0].name, 'Restored');
  assert.equal(records[0].image, undefined);
  assert.deepEqual([...((await library.get(records[0].id)).image.data)], [10, 20, 30, 255]);
});

test('does not partially import when the library capacity would be exceeded', async () => {
  const repository = new MemoryRepository();
  const key = await createDeviceKey();
  const library = new SignatureLibrary(repository, async () => key);
  for (let index = 0; index < 99; index++) await library.save({ name: `Existing ${index}`, image, ink: 'blue', settings: {} });
  await assert.rejects(library.importRecords([{ name: 'One', image, ink: 'blue', settings: {} }, { name: 'Two', image, ink: 'blue', settings: {} }]), /slots are available/i);
  assert.equal((await library.list()).length, 99);
});
