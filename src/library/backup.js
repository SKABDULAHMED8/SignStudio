import { derivePassphraseKey, encryptPayload, decryptPayload, randomBytes } from '../security/crypto.js';
const VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const replacer = (key, value) => {
  if (value instanceof Uint8Array || value instanceof Uint8ClampedArray) {
    return { __signstudioBytes: Array.from(value), __type: value.constructor.name };
  }
  return value;
};
const reviver = (key, value) => {
  if (value && Array.isArray(value.__signstudioBytes)) {
    return value.__type === 'Uint8ClampedArray' ? new Uint8ClampedArray(value.__signstudioBytes) : new Uint8Array(value.__signstudioBytes);
  }
  return value;
};

export async function createEncryptedBackup(records, passphrase) {
  if (!Array.isArray(records) || records.length > 100) throw new TypeError('A backup can contain at most 100 signatures.');
  const salt = randomBytes(16);
  const key = await derivePassphraseKey(passphrase, salt, PBKDF2_ITERATIONS);
  const payload = encoder.encode(JSON.stringify({ version: VERSION, createdAt: new Date().toISOString(), records }, replacer));
  const encrypted = await encryptPayload(key, payload);
  return new Blob([JSON.stringify({ format: 'signstudio-backup', version: VERSION, iterations: PBKDF2_ITERATIONS, salt: [...salt], iv: [...encrypted.iv], ciphertext: [...encrypted.ciphertext] })], { type: 'application/octet-stream' });
}

export async function openEncryptedBackup(fileText, passphrase) {
  if (typeof fileText !== 'string' || fileText.length > 80 * 1024 * 1024) throw new TypeError('The backup file is too large or invalid.');
  const envelope = JSON.parse(fileText);
  if (envelope.format !== 'signstudio-backup' || envelope.version !== VERSION || !Array.isArray(envelope.salt) || !Array.isArray(envelope.iv) || !Array.isArray(envelope.ciphertext)) throw new TypeError('This is not a supported SignStudio backup.');
  if (envelope.salt.length !== 16 || envelope.iv.length !== 12 || envelope.ciphertext.length < 16 || !Number.isInteger(envelope.iterations) || envelope.iterations < PBKDF2_ITERATIONS || envelope.iterations > 2_000_000) throw new TypeError('The backup file is damaged or uses unsupported encryption settings.');
  const key = await derivePassphraseKey(passphrase, new Uint8Array(envelope.salt), envelope.iterations);
  const plain = await decryptPayload(key, { iv: new Uint8Array(envelope.iv), ciphertext: new Uint8Array(envelope.ciphertext) });
  const payload = JSON.parse(decoder.decode(plain), reviver);
  if (payload.version !== VERSION || !Array.isArray(payload.records) || payload.records.length > 100) throw new TypeError('The backup contents are invalid.');
  for (const record of payload.records) {
    if (!record || typeof record.name !== 'string' || !record.image || !Number.isInteger(record.image.width) || !Number.isInteger(record.image.height) || !(record.image.data instanceof Uint8ClampedArray || record.image.data instanceof Uint8Array)) throw new TypeError('The backup contains an invalid signature record.');
    if (record.image.width < 1 || record.image.height < 1 || record.image.width * record.image.height > 16_777_216 || record.image.data.length !== record.image.width * record.image.height * 4) throw new TypeError('The backup contains invalid image dimensions.');
  }
  return payload;
}
