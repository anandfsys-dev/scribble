export class FrameTool {
  constructor(state) {
    this.state = state;
    this.type = 'frame';
    this.isDrawing = false;
    this.currentElement = null;
  }

  onPointerDown(pos, e) {
    this.isDrawing = true;
    const frames = this.state.elements.filter(el => el.type === 'frame');
    const maxOrder = frames.reduce((m, el) => Math.max(m, el.frameOrder ?? -1), -1);
    this.currentElement = {
      id: Date.now().toString(),
      type: 'frame',
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      name: `Frame ${frames.length + 1}`,
      frameOrder: maxOrder + 1,
    };
    this.state.elements.push(this.currentElement);
    this.state.isDirty = true;
  }

  onPointerMove(pos, e) {
    if (!this.isDrawing || !this.currentElement) return;
    this.currentElement.width = pos.x - this.currentElement.x;
    this.currentElement.height = pos.y - this.currentElement.y;
    this.state.isDirty = true;
  }

  onPointerUp(pos, e) {
    this.isDrawing = false;
    if (this.currentElement) {
      if (Math.abs(this.currentElement.width) < 10 || Math.abs(this.currentElement.height) < 10) {
        this.state.elements = this.state.elements.filter(el => el !== this.currentElement);
        this.state.isDirty = true;
      } else {
        this.state.saveHistory();
        this.state.saveToLocalStorage();
      }
    }
    this.currentElement = null;
  }
}
