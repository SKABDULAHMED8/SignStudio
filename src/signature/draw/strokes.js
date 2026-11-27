export class StrokeHistory {
  #strokes = [];
  #cursor = 0;
  #limit;
  constructor(limit = 50) { this.#limit = Math.max(1, limit); }
  get current() { return structuredClone(this.#strokes.slice(0, this.#cursor)); }
  get canUndo() { return this.#cursor > 0; }
  get canRedo() { return this.#cursor < this.#strokes.length; }
  add(points) {
    if (!Array.isArray(points) || points.length === 0) return;
    this.#strokes = this.#strokes.slice(0, this.#cursor);
    this.#strokes.push(structuredClone(points));
    if (this.#strokes.length > this.#limit) this.#strokes.shift();
    this.#cursor = this.#strokes.length;
  }
  undo() { if (this.canUndo) this.#cursor--; return this.current; }
  redo() { if (this.canRedo) this.#cursor++; return this.current; }
  clear() { this.#strokes = []; this.#cursor = 0; }
}
