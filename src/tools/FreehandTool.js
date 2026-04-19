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
    
    const lastPoint = this.currentElement.points[this.currentElement.points.length - 1];
    const dx = pos.x - lastPoint[0];
    const dy = pos.y - lastPoint[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Minimum distance threshold to reduce jitter and excessive points
    if (dist > 5) {
      // Linear interpolation (lerp) for smoothing
      // This creates a "follow" effect that rounds out sharp jitters
      const smoothing = 0.6;
      const nextX = lastPoint[0] + dx * smoothing;
      const nextY = lastPoint[1] + dy * smoothing;
      
      this.currentElement.points.push([nextX, nextY]);
      this.state.isDirty = true;
    }
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
