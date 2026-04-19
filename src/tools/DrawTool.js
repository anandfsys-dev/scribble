export class DrawTool {
  constructor(state, type) {
    this.state = state;
    this.type = type; // 'rectangle', 'ellipse', 'line', 'arrow'
    this.isDrawing = false;
    this.currentElement = null;
  }
  
  onPointerDown(pos, e) {
    this.isDrawing = true;
    
    // Create new element
    this.currentElement = {
      id: Date.now().toString(),
      type: this.type,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      x2: pos.x,
      y2: pos.y,
      style: { ...this.state.currentStyle }
    };
    
    // Binding logic
    if (this.type === 'arrow' || this.type === 'line') {
      const hitElement = this.state.getElementAt(pos, this.currentElement.id, ['rectangle', 'ellipse', 'text']);
      if (hitElement) {
        const closestPoint = this.state.getClosestConnectionPoint(pos, hitElement);
        if (closestPoint) {
            this.currentElement.startBinding = { id: hitElement.id, key: closestPoint.key };
            this.currentElement.x = closestPoint.point.x;
            this.currentElement.y = closestPoint.point.y;
            this.currentElement.x2 = closestPoint.point.x;
            this.currentElement.y2 = closestPoint.point.y;
        }
      }
    }
    
    // Add directly to array so it renders, but don't save history yet
    this.state.elements.push(this.currentElement);
    this.state.isDirty = true;
  }
  

  onPointerMove(pos, e) {
    if (!this.isDrawing || !this.currentElement) return;
    
    if (this.type === 'rectangle' || this.type === 'ellipse') {
      this.currentElement.width = pos.x - this.currentElement.x;
      this.currentElement.height = pos.y - this.currentElement.y;
    } else {
      // line or arrow
      let targetX = pos.x;
      let targetY = pos.y;
      
      const hitElement = this.state.getElementAt(pos, this.currentElement.id, ['rectangle', 'ellipse', 'text']);
      if (hitElement) {
        const closestPoint = this.state.getClosestConnectionPoint(pos, hitElement);
        if (closestPoint) {
            this.currentElement.endBinding = { id: hitElement.id, key: closestPoint.key };
            targetX = closestPoint.point.x;
            targetY = closestPoint.point.y;
        }
      } else {
        delete this.currentElement.endBinding;
      }
      
      this.currentElement.x2 = targetX;
      this.currentElement.y2 = targetY;
    }
    
    this.state.isDirty = true;
  }
  
  onPointerUp(pos, e) {
    this.isDrawing = false;
    
    if (this.currentElement) {
      let removed = false;
      // If tiny, remove it
      if (this.type === 'rectangle' || this.type === 'ellipse') {
        if (Math.abs(this.currentElement.width) < 2 && Math.abs(this.currentElement.height) < 2) {
          this.state.removeElement(this.currentElement);
          removed = true;
        }
      } else {
        if (Math.abs(this.currentElement.x2 - this.currentElement.x) < 2 && Math.abs(this.currentElement.y2 - this.currentElement.y) < 2) {
          this.state.removeElement(this.currentElement);
          removed = true;
        }
      }
      
      if (!removed) {
        this.state.saveHistory();
        this.state.saveToLocalStorage();
      }
    }
    
    this.currentElement = null;
  }
}
