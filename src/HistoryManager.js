export class HistoryManager {
  constructor() {
    this._stack = [[]];
    this._index = 0;
  }

  // Call after loading persisted elements to seed the history stack
  init(elements) {
    this._stack = [JSON.parse(JSON.stringify(elements))];
    this._index = 0;
  }

  // Snapshot current elements; truncates any undone future states
  save(elements) {
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }
    this._stack.push(JSON.parse(JSON.stringify(elements)));
    if (this._stack.length > 50) {
      this._stack.shift();
    } else {
      this._index++;
    }
  }

  // Returns the previous elements snapshot, or null if at the beginning
  undo() {
    if (this._index > 0) {
      this._index--;
      return JSON.parse(JSON.stringify(this._stack[this._index]));
    }
    return null;
  }

  // Returns the next elements snapshot, or null if at the end
  redo() {
    if (this._index < this._stack.length - 1) {
      this._index++;
      return JSON.parse(JSON.stringify(this._stack[this._index]));
    }
    return null;
  }
}
