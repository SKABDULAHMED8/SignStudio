const DATABASE_NAME = 'signstudio-local';
const DATABASE_VERSION = 2;
const STORES = ['signatures', 'settings', 'keys', 'trash', 'personal-profiles'];

export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Local storage is unavailable in this browser.'));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local signature library.'));
    request.onblocked = () => reject(new Error('Close other SignStudio tabs to update local storage.'));
  });
}

export class LocalRepository {
  constructor(database) { this.database = database; }
  async put(storeName, record) { return this.#request(storeName, 'readwrite', store => store.put(record)); }
  async get(storeName, id) { return this.#request(storeName, 'readonly', store => store.get(id)); }
  async getAll(storeName) { return this.#request(storeName, 'readonly', store => store.getAll()); }
  async delete(storeName, id) { return this.#request(storeName, 'readwrite', store => store.delete(id)); }
  async clear(storeName) { return this.#request(storeName, 'readwrite', store => store.clear()); }
  #request(storeName, mode, makeRequest) {
    if (!STORES.includes(storeName)) throw new TypeError('Unknown local storage collection.');
    return new Promise((resolve, reject) => {
      let result;
      let settled = false;
      const transaction = this.database.transaction(storeName, mode);
      const request = makeRequest(transaction.objectStore(storeName));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { if (!settled) { settled = true; reject(request.error ?? new Error('Local storage request failed.')); } };
      transaction.oncomplete = () => { if (!settled) { settled = true; resolve(result); } };
      transaction.onabort = () => { if (!settled) { settled = true; reject(transaction.error ?? new Error('Local storage operation failed.')); } };
      transaction.onerror = () => { if (!settled) { settled = true; reject(transaction.error ?? new Error('Local storage transaction failed.')); } };
    });
  }
}
