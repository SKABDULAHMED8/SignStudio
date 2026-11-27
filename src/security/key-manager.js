import { createDeviceKey } from './crypto.js';

export class KeyManager {
  constructor(repository) { this.repository = repository; this.cachedKey = null; }
  async getDeviceKey() {
    if (this.cachedKey) return this.cachedKey;
    const existing = await this.repository.get('keys', 'device');
    if (existing?.key) {
      try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const sample = new Uint8Array([83, 83, 49]);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, existing.key, sample);
        const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, existing.key, encrypted));
        if (decrypted.length !== sample.length || decrypted.some((value, index) => value !== sample[index])) throw new Error('Key check failed.');
      } catch { throw new Error('The saved device encryption key cannot be used. Restore an encrypted backup or start a new library.'); }
      this.cachedKey = existing.key; return existing.key;
    }
    const key = await createDeviceKey();
    await this.repository.put('keys', { id: 'device', key, createdAt: Date.now() });
    this.cachedKey = key;
    return key;
  }
  lock() { this.cachedKey = null; }
}
