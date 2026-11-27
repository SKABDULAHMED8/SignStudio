import test from 'node:test';
import assert from 'node:assert/strict';
import { PassphraseLock } from '../../src/security/lock.js';

class MemoryRepository {
  values = new Map();
  async put(store, value) { this.values.set(`${store}:${value.id}`, structuredClone(value)); }
  async get(store, id) { return structuredClone(this.values.get(`${store}:${id}`) ?? null); }
  async delete(store, id) { this.values.delete(`${store}:${id}`); }
}

test('passphrase lock enables, rejects a wrong phrase, unlocks and disables', async () => {
  const repository = new MemoryRepository();
  const lock = new PassphraseLock(repository);
  await lock.enable('correct horse battery staple');
  assert.equal(await lock.isConfigured(), true);
  lock.lock();
  assert.equal(await lock.unlock('incorrect phrase'), false);
  assert.equal(await lock.unlock('correct horse battery staple'), true);
  await lock.disable('correct horse battery staple');
  assert.equal(await lock.isConfigured(), false);
});
