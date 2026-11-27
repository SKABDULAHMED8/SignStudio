export class EditHistory {
  constructor(limit = 50) { this.limit = limit; this.entries = []; this.index = 0; }
  push(entry) { this.entries = this.entries.slice(0, this.index); this.entries.push(structuredClone(entry)); if (this.entries.length > this.limit) this.entries.shift(); this.index = this.entries.length; }
  undo() { if (!this.index) return null; return structuredClone(this.entries[--this.index]); }
  redo() { if (this.index >= this.entries.length) return null; return structuredClone(this.entries[this.index++]); }
}
