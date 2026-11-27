const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 600_000;
const AES_ALGORITHM = 'AES-GCM';

function cryptoApi() {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser cryptography is unavailable. Open SignStudio using HTTPS or localhost.');
  return globalThis.crypto;
}

export async function createDeviceKey() {
  return cryptoApi().subtle.generateKey({ name: AES_ALGORITHM, length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function derivePassphraseKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new TypeError('Use a passphrase with at least 12 characters.');
  if (!(salt instanceof Uint8Array) || salt.length < 16) throw new TypeError('A random salt of at least 16 bytes is required.');
  const material = await cryptoApi().subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return cryptoApi().subtle.deriveKey({ name: 'PBKDF2', salt, iterations: Math.max(PBKDF2_ITERATIONS, iterations), hash: 'SHA-256' }, material, { name: AES_ALGORITHM, length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptPayload(key, plainBytes) {
  const iv = cryptoApi().getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi().subtle.encrypt({ name: AES_ALGORITHM, iv }, key, plainBytes);
  return { iv, ciphertext: new Uint8Array(ciphertext), algorithm: AES_ALGORITHM };
}

export async function decryptPayload(key, encrypted) {
  const plain = await cryptoApi().subtle.decrypt({ name: AES_ALGORITHM, iv: encrypted.iv }, key, encrypted.ciphertext);
  return new Uint8Array(plain);
}

export function randomBytes(length) { return cryptoApi().getRandomValues(new Uint8Array(length)); }
