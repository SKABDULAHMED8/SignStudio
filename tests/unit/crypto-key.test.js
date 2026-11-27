import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceKey } from '../../src/security/crypto.js';

test('device encryption key is non-extractable AES-GCM', async () => {
  const key = await createDeviceKey();
  assert.equal(key.algorithm.name, 'AES-GCM');
  assert.equal(key.algorithm.length, 256);
  assert.equal(key.extractable, false);
});

import { KeyManager } from '../../src/security/key-manager.js';

test('KeyManager persists and reuses the same device key', async () => {
  const store = new Map();
  const repository = {
    async get(_store, id) { return store.get(id) ?? null; },
    async put(_store, record) { store.set(record.id, record); }
  };
  const firstManager = new KeyManager(repository);
  const first = await firstManager.getDeviceKey();
  firstManager.lock();
  const second = await new KeyManager(repository).getDeviceKey();
  assert.equal(first, second);
  assert.equal(second.extractable, false);
});

test('KeyManager refuses to replace an unusable key silently', async () => {
  const store = new Map([['device', { id: 'device', key: { invalid: true } }]]);
  const repository = {
    async get(_store, id) { return store.get(id) ?? null; },
    async put(_store, record) { store.set(record.id, record); }
  };
  await assert.rejects(new KeyManager(repository).getDeviceKey(), /cannot be used/i);
});
