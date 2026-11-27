import { encryptPayload, decryptPayload } from '../security/crypto.js';
import { fingerprintImage } from './duplicate-check.js';
import { resizeNearestPremultiplied } from '../signature/processing/pipeline.js';

export const MAX_SIGNATURES = 100;
export const TRASH_MS = 60_000;
export const MAX_VERSIONS = 10;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encodePayload = value => JSON.stringify(value, (key, item) => item instanceof Uint8ClampedArray || item instanceof Uint8Array ? { __signstudioBytes: [...item], __type: item.constructor.name } : item);
const decodePayload = value => JSON.parse(value, (key, item) => item && item.__signstudioBytes ? (item.__type === 'Uint8ClampedArray' ? new Uint8ClampedArray(item.__signstudioBytes) : new Uint8Array(item.__signstudioBytes)) : item);
const id = () => crypto.randomUUID();

function createThumbnail(image, maxSide = 160) {
  const longest = Math.max(image.width, image.height);
  const scale = Math.min(1, maxSide / longest);
  if (scale === 1) return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  return resizeNearestPremultiplied(image, Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
}

export class SignatureLibrary {
  constructor(repository, keyProvider) { this.repository = repository; this.keyProvider = keyProvider; }

  async list() {
    const key = await this.keyProvider();
    const records = await this.repository.getAll('signatures');
    const output = [];
    for (const record of records) {
      const payload = await this.#decrypt(key, record.encrypted);
      const legacyImage = payload.image;
      const thumbnail = payload.thumbnail ?? (legacyImage ? createThumbnail(legacyImage) : null);
      const fingerprint = payload.fingerprint ?? (legacyImage ? fingerprintImage(legacyImage) : null);
      const { image: _legacyImage, ...metadata } = payload;
      output.push({ id: record.id, name: metadata.name ?? record.name ?? 'Untitled signature', versions: record.versions?.length ?? 0, updatedAt: record.updatedAt, ...metadata, thumbnail, fingerprint, storage: 'device' });
    }
    return output;
  }

  async get(recordId) {
    const record = await this.repository.get('signatures', recordId);
    if (!record) return null;
    const key = await this.keyProvider();
    const payload = await this.#decrypt(key, record.encrypted);
    let image = payload.image;
    if (record.imageEncrypted) image = decodePayload(decoder.decode(await decryptPayload(key, record.imageEncrypted)));
    if (!image) throw new Error('The saved signature image is missing or unreadable.');
    const thumbnail = payload.thumbnail ?? createThumbnail(image);
    const fingerprint = payload.fingerprint ?? fingerprintImage(image);
    const { image: _legacyImage, ...metadata } = payload;
    return { id: record.id, versions: record.versions?.length ?? 0, updatedAt: record.updatedAt, ...metadata, image, thumbnail, fingerprint, storage: 'device' };
  }

  async exportRecords() {
    const records = await this.repository.getAll('signatures');
    const output = [];
    for (const record of records) output.push(await this.get(record.id));
    return output;
  }

  async save({ name, image, thumbnail = null, ink, settings, replaceId = null }) {
    const records = await this.repository.getAll('signatures');
    if (!replaceId && records.length >= MAX_SIGNATURES) throw new Error('Your library is full. Export a backup or remove an older signature.');
    if (!image?.data || image.data.length !== image.width * image.height * 4) throw new TypeError('Signature image data is invalid.');
    const key = await this.keyProvider();
    const recordId = replaceId ?? id();
    const previous = replaceId ? await this.repository.get('signatures', replaceId) : null;
    if (replaceId && !previous) throw new Error('The signature to replace no longer exists.');
    const safeName = String(name || 'Untitled signature').trim().slice(0, 80) || 'Untitled signature';
    const payload = { name: safeName, thumbnail: thumbnail ?? createThumbnail(image), fingerprint: fingerprintImage(image), ink, settings, savedAt: Date.now() };
    const encrypted = await this.#encrypt(key, payload);
    const imageEncrypted = await encryptPayload(key, encoder.encode(encodePayload(image)));
    const versions = previous ? [...(previous.versions ?? []), { encrypted: previous.encrypted, imageEncrypted: previous.imageEncrypted ?? null, savedAt: previous.updatedAt ?? Date.now() }].slice(-MAX_VERSIONS) : [];
    const record = { id: recordId, encrypted, imageEncrypted, versions, updatedAt: Date.now() };
    await this.repository.put('signatures', record);
    return { id: recordId, name: safeName, updatedAt: record.updatedAt };
  }

  async importRecords(records) {
    if (!Array.isArray(records)) throw new TypeError('Backup records are invalid.');
    const existing = await this.repository.getAll('signatures');
    if (existing.length + records.length > MAX_SIGNATURES) throw new RangeError(`Only ${MAX_SIGNATURES - existing.length} signature slots are available. Remove signatures before restoring this backup.`);
    const inserted = [];
    try {
      for (const record of records) {
        const saved = await this.save({ name: record.name, image: record.image, thumbnail: record.thumbnail ?? null, ink: record.ink, settings: record.settings });
        inserted.push(saved.id);
      }
      return inserted.length;
    } catch (error) {
      await Promise.all(inserted.map(recordId => this.repository.delete('signatures', recordId)));
      throw error;
    }
  }

  async listTrash(now = Date.now()) {
    await this.purgeExpiredTrash(now);
    const key = await this.keyProvider();
    const entries = await this.repository.getAll('trash');
    const output = [];
    for (const entry of entries) {
      if (entry.expiresAt <= now) continue;
      const payload = await this.#decrypt(key, entry.record.encrypted);
      output.push({ id: entry.id, name: payload.name ?? entry.record?.name ?? 'Deleted signature', expiresAt: entry.expiresAt });
    }
    return output.sort((a, b) => a.expiresAt - b.expiresAt);
  }

  async listVersions(recordId) {
    const record = await this.repository.get('signatures', recordId);
    if (!record) throw new Error('Signature not found.');
    const key = await this.keyProvider();
    const output = [];
    for (let index = 0; index < (record.versions ?? []).length; index++) {
      const version = record.versions[index];
      const payload = await this.#decrypt(key, version.encrypted ?? version);
      output.push({ index, name: payload.name ?? 'Previous signature', savedAt: version.savedAt ?? null });
    }
    return output;
  }

  async restoreVersion(recordId, versionIndex) {
    const record = await this.repository.get('signatures', recordId);
    if (!record || !Number.isInteger(versionIndex) || versionIndex < 0 || versionIndex >= (record.versions ?? []).length) throw new RangeError('That signature version is no longer available.');
    const versions = [...record.versions];
    const selected = versions.splice(versionIndex, 1)[0];
    const current = { encrypted: record.encrypted, imageEncrypted: record.imageEncrypted ?? null, savedAt: record.updatedAt ?? Date.now() };
    record.encrypted = selected.encrypted ?? selected;
    record.imageEncrypted = selected.imageEncrypted ?? null;
    versions.push(current);
    record.versions = versions.slice(-MAX_VERSIONS);
    record.updatedAt = Date.now();
    await this.repository.put('signatures', record);
    return true;
  }

  async rename(recordId, name) {
    const record = await this.repository.get('signatures', recordId);
    if (!record) throw new Error('Signature not found.');
    const key = await this.keyProvider();
    const payload = await this.#decrypt(key, record.encrypted);
    payload.name = String(name).trim().slice(0, 80) || 'Untitled signature';
    record.encrypted = await this.#encrypt(key, payload);
    record.updatedAt = Date.now();
    await this.repository.put('signatures', record);
  }

  async discard(recordId) {
    const record = await this.repository.get('signatures', recordId);
    if (!record) return false;
    await this.repository.put('trash', { id: record.id, record, deletedAt: Date.now(), expiresAt: Date.now() + TRASH_MS });
    await this.repository.delete('signatures', recordId);
    return true;
  }

  async restore(recordId) {
    const trash = await this.repository.get('trash', recordId);
    if (!trash || trash.expiresAt <= Date.now()) { if (trash) await this.repository.delete('trash', recordId); return false; }
    await this.repository.put('signatures', trash.record);
    await this.repository.delete('trash', recordId);
    return true;
  }

  async purgeExpiredTrash(now = Date.now()) {
    const entries = await this.repository.getAll('trash');
    for (const entry of entries) if (entry.expiresAt <= now) await this.repository.delete('trash', entry.id);
  }

  async #encrypt(key, payload) { return encryptPayload(key, encoder.encode(encodePayload(payload))); }
  async #decrypt(key, encrypted) { return decodePayload(decoder.decode(await decryptPayload(key, encrypted))); }
}
