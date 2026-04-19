export class FreehandTool {
  constructor(state) {
    this.state = state;
    this.isDrawing = false;
    this.currentElement = null;
  }
  
  onPointerDown(pos, e) {
    this.isDrawing = true;
    
    this.currentElement = {
      id: Date.now().toString(),
      type: 'freehand',
      points: [[pos.x, pos.y]],
      style: { ...this.state.currentStyle }
    };
    
    this.state.elements.push(this.currentElement);
    this.state.isDirty = true;
  }
  
  onPointerMove(pos, e) {
    if (!this.isDrawing || !this.currentElement) return;
    
    this.currentElement.points.push([pos.x, pos.y]);
    this.state.isDirty = true;
  }
  
  onPointerUp(pos, e) {
    this.isDrawing = false;
    
    if (this.currentElement) {
      if (this.currentElement.points.length < 2) {
        this.state.removeElement(this.currentElement);
      } else {
        this.state.saveHistory();
        this.state.saveToLocalStorage();
      }
    }
    
    this.currentElement = null;
  }
}
