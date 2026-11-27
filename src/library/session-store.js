export class SessionStore {
  #items = new Map();
  save(item) { const id = crypto.randomUUID(); this.#items.set(id, structuredClone(item)); return id; }
  get(id) { const value = this.#items.get(id); return value ? structuredClone(value) : null; }
  list() { return [...this.#items.entries()].map(([id, value]) => ({ id, ...structuredClone(value), storage: 'session' })); }
  delete(id) { return this.#items.delete(id); }
  clear() { this.#items.clear(); }
}
