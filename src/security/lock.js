import { derivePassphraseKey, encryptPayload, decryptPayload, randomBytes } from './crypto.js';

const LOCK_ID = 'passphrase-lock';
const CHECK_TEXT = 'SignStudio library check v1';

export class PassphraseLock {
  constructor(repository) { this.repository = repository; this.sessionKey = null; }
  async isConfigured() { return Boolean(await this.repository.get('settings', LOCK_ID)); }
  async enable(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < 12) throw new TypeError('Use a passphrase with at least 12 characters.');
    const salt = randomBytes(16);
    const key = await derivePassphraseKey(passphrase, salt);
    const verifier = await encryptPayload(key, new TextEncoder().encode(CHECK_TEXT));
    await this.repository.put('settings', { id: LOCK_ID, salt, verifier, iterations: 600000, createdAt: Date.now() });
    this.sessionKey = key;
  }
  async unlock(passphrase) {
    const config = await this.repository.get('settings', LOCK_ID);
    if (!config || typeof passphrase !== 'string') return false;
    try {
      const key = await derivePassphraseKey(passphrase, config.salt, config.iterations ?? 600000);
      const value = await decryptPayload(key, config.verifier);
      if (new TextDecoder().decode(value) !== CHECK_TEXT) return false;
      this.sessionKey = key;
      return true;
    } catch { return false; }
  }
  async disable(passphrase) {
    if (!await this.unlock(passphrase)) return false;
    await this.repository.delete('settings', LOCK_ID);
    this.sessionKey = null;
    return true;
  }
  lock() { this.sessionKey = null; }
  get unlocked() { return Boolean(this.sessionKey); }
}
