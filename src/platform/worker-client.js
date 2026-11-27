export class WorkerClient {
  #worker;
  #pending = new Map();
  #counter = 0;
  constructor() {
    this.#worker = new Worker(new URL('../signature/workers/extract.worker.js', import.meta.url), { type: 'module' });
    this.#worker.addEventListener('message', event => {
      const { id, result, error } = event.data;
      const pending = this.#pending.get(id);
      if (!pending) return;
      this.#pending.delete(id);
      if (error) pending.reject(Object.assign(new Error(error.message), { name: error.name }));
      else pending.resolve(result);
    });
    this.#worker.addEventListener('error', error => {
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
    });
  }
  process(imageData, settings) {
    const id = ++this.#counter;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      const data = new Uint8ClampedArray(imageData.data);
      this.#worker.postMessage({ id, imageData: { width: imageData.width, height: imageData.height, data }, settings }, [data.buffer]);
    });
  }
  terminate() { this.#worker.terminate(); for (const p of this.#pending.values()) p.reject(new Error('Image processing stopped.')); this.#pending.clear(); }
}
