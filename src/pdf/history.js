export class PlacementHistory {
  constructor(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('History limit must be a positive integer.');
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  execute(command) {
    if (!command || typeof command.do !== 'function' || typeof command.undo !== 'function') throw new TypeError('A history command needs do and undo functions.');
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  undo(state) {
    const command = this.undoStack.pop();
    if (!command) return state;
    const next = command.undo(state);
    this.redoStack.push(command);
    return next;
  }
  redo(state) {
    const command = this.redoStack.pop();
    if (!command) return state;
    const next = command.do(state);
    this.undoStack.push(command);
    return next;
  }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
}
