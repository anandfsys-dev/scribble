import { Renderer } from './Renderer.js';

export class CanvasState {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer(this.ctx);
    
    // Document state
    this.elements = [];
    this.selection = [];
    
    // History State
    this.history = [];
    this.historyIndex = -1;
    this.isUndoRedoing = false;
    
    // UI State
    this.hoveredElement = null;
    this.hoverPoint = null;
    this.selectionBox = null;
    
    // View state
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    
    // Current Styles
    this.currentStyle = {
      strokeColor: '#1e1e1e',
      fillColor: 'transparent',
      strokeWidth: 1
    };
    
    // Render loop state
    this.isDirty = true;
    
    this.loadFromLocalStorage();
    this.requestRender();
    
    // Setup undo/redo listener
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        e.preventDefault();
      }
    });
  }

  saveHistory() {
    if (this.isUndoRedoing) return;
    
    // Truncate future history if we've undone and are now making a new change
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    this.history.push(JSON.parse(JSON.stringify(this.elements)));
    
    // Limit history size to prevent memory leaks
    if (this.history.length > 50) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.isUndoRedoing = true;
      this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.selection = []; // Clear selection on undo
      this.isDirty = true;
      this.saveToLocalStorage();
      this.isUndoRedoing = false;
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.isUndoRedoing = true;
      this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.selection = [];
      this.isDirty = true;
      this.saveToLocalStorage();
      this.isUndoRedoing = false;
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('scribble_elements');
      if (saved) {
        this.elements = JSON.parse(saved);
        // Initialize history with loaded state
        this.history = [JSON.parse(saved)];
        this.historyIndex = 0;
      } else {
        this.history = [[]];
        this.historyIndex = 0;
      }
    } catch (e) {
      console.error('Failed to load from local storage', e);
      this.history = [[]];
      this.historyIndex = 0;
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('scribble_elements', JSON.stringify(this.elements));
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
  }
  
  addElement(element) {
    this.elements.push(element);
    this.isDirty = true;
    this.saveHistory();
    this.saveToLocalStorage();
  }
  
  removeElement(element) {
    this.elements = this.elements.filter(e => e !== element);
    this.selection = this.selection.filter(e => e !== element);
    this.isDirty = true;
    this.saveHistory();
    this.saveToLocalStorage();
  }

  clearCanvas() {
    if (this.elements.length === 0) return;
    this.elements = [];
    this.selection = [];
    this.isDirty = true;
    this.saveHistory();
    this.saveToLocalStorage();
  }

  
  setSelection(elements) {
    this.selection = elements;
    this.isDirty = true;
  }
  
  applyStyleToSelection(property, value) {
    if (this.selection.length === 0) return;
    
    this.selection.forEach(el => {
      el.style[property] = value;
    });
    this.isDirty = true;
    this.saveHistory();
    this.saveToLocalStorage();
  }
  
  // Convert screen coordinates to canvas coordinates
  screenToCanvas(x, y) {
    return {
      x: (x - this.pan.x) / this.zoom,
      y: (y - this.pan.y) / this.zoom
    };
  }

  getElementAt(pos, ignoreId = null, types = null) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      if (this.elements[i].id === ignoreId) continue;
      if (types && !types.includes(this.elements[i].type)) continue;
      if (this.hitTest(pos, this.elements[i])) {
        return this.elements[i];
      }
    }
    return null;
  }

  hitTest(pos, element) {
    const padding = 10;
    
    switch (element.type) {
      case 'rectangle':
      case 'ellipse': {
        const w = element.width || 0;
        const h = element.height || 0;
        const minX = Math.min(element.x, element.x + w);
        const maxX = Math.max(element.x, element.x + w);
        const minY = Math.min(element.y, element.y + h);
        const maxY = Math.max(element.y, element.y + h);
        
        return pos.x >= minX - padding && pos.x <= maxX + padding &&
               pos.y >= minY - padding && pos.y <= maxY + padding;
      }
      case 'text': {
        const w = element.width !== undefined ? element.width : 0;
        const h = element.height !== undefined ? element.height : 0;
        const minX = element.x - w/2;
        const maxX = element.x + w/2;
        const minY = element.y - h/2;
        const maxY = element.y + h/2;
        
        return pos.x >= minX - padding && pos.x <= maxX + padding &&
               pos.y >= minY - padding && pos.y <= maxY + padding;
      }
      case 'line':
      case 'arrow': {
        const minX = Math.min(element.x, element.x2);
        const maxX = Math.max(element.x, element.x2);
        const minY = Math.min(element.y, element.y2);
        const maxY = Math.max(element.y, element.y2);
        return pos.x >= minX - padding && pos.x <= maxX + padding &&
               pos.y >= minY - padding && pos.y <= maxY + padding;
      }
      case 'freehand': {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        element.points.forEach(p => {
          if (p[0] < minX) minX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] > maxY) maxY = p[1];
        });
        return pos.x >= minX - padding && pos.x <= maxX + padding &&
               pos.y >= minY - padding && pos.y <= maxY + padding;
      }
    }
    return false;
  }
  
  getElementBounds(element) {
    let minX = element.x;
    let maxX = element.x;
    let minY = element.y;
    let maxY = element.y;
    
    switch (element.type) {
      case 'rectangle':
      case 'ellipse': {
        const w = element.width || 0;
        const h = element.height || 0;
        minX = Math.min(element.x, element.x + w);
        maxX = Math.max(element.x, element.x + w);
        minY = Math.min(element.y, element.y + h);
        maxY = Math.max(element.y, element.y + h);
        break;
      }
      case 'text': {
        const w = element.width !== undefined ? element.width : 0;
        const h = element.height !== undefined ? element.height : 0;
        minX = element.x - w/2;
        maxX = element.x + w/2;
        minY = element.y - h/2;
        maxY = element.y + h/2;
        break;
      }
      case 'line':
      case 'arrow': {
        minX = Math.min(element.x, element.x2);
        maxX = Math.max(element.x, element.x2);
        minY = Math.min(element.y, element.y2);
        maxY = Math.max(element.y, element.y2);
        break;
      }
      case 'freehand': {
        minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
        element.points.forEach(p => {
          if (p[0] < minX) minX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] > maxY) maxY = p[1];
        });
        break;
      }
    }
    return { minX, maxX, minY, maxY };
  }
  
  isPointDeepInsideElement(pos, element) {
    const bounds = this.getElementBounds(element);
    const innerPadding = 15; // User must be closer than 15px to the edge to trigger connection points
    
    // If shape is too small, there is no "deep inside"
    if (bounds.maxX - bounds.minX <= innerPadding * 2 || bounds.maxY - bounds.minY <= innerPadding * 2) {
      return false; 
    }
    
    return pos.x >= bounds.minX + innerPadding && pos.x <= bounds.maxX - innerPadding &&
           pos.y >= bounds.minY + innerPadding && pos.y <= bounds.maxY - innerPadding;
  }
  
  // Render loop
  requestRender() {
    if (this.isDirty) {
      this.render();
      this.isDirty = false;
    }
    requestAnimationFrame(() => this.requestRender());
  }

  getConnectionPoints(el) {
    if (el.type === 'rectangle' || el.type === 'ellipse') {
      const w = el.width;
      const h = el.height;
      return {
        top: { x: el.x + w / 2, y: el.y },
        bottom: { x: el.x + w / 2, y: el.y + h },
        left: { x: el.x, y: el.y + h / 2 },
        right: { x: el.x + w, y: el.y + h / 2 },
        center: { x: el.x + w / 2, y: el.y + h / 2 }
      };
    } else if (el.type === 'text') {
      const w = 100; // approx
      const h = 50;
      return {
        top: { x: el.x, y: el.y - h/2 },
        bottom: { x: el.x, y: el.y + h/2 },
        left: { x: el.x - w/2, y: el.y },
        right: { x: el.x + w/2, y: el.y },
        center: { x: el.x, y: el.y }
      };
    }
    return null;
  }

  getClosestConnectionPoint(pos, el) {
    const points = this.getConnectionPoints(el);
    if (!points) return null;
    
    let closest = null;
    let minDistance = Infinity;
    
    for (const [key, point] of Object.entries(points)) {
      const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (dist < minDistance) {
        minDistance = dist;
        closest = { key, point };
      }
    }
    
    // Snapping logic. Let's exclude center unless distance is very small, 
    // actually returning the edge points is better.
    if (closest.key === 'center' && minDistance > 30) {
        // Find second closest
        minDistance = Infinity;
        for (const [key, point] of Object.entries(points)) {
            if (key === 'center') continue;
            const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
            if (dist < minDistance) {
                minDistance = dist;
                closest = { key, point };
            }
        }
    }

    return closest;
  }
  
  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply transform
    this.ctx.save();
    this.ctx.translate(this.pan.x, this.pan.y);
    this.ctx.scale(this.zoom, this.zoom);
    
    // Draw all elements
    this.elements.forEach(el => {
      this.renderer.drawElement(el, this.selection.includes(el));
    });
    
    // Draw selection marquee
    if (this.selectionBox) {
      const { start, end } = this.selectionBox;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      
      this.ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
      this.ctx.strokeStyle = '#4f46e5';
      this.ctx.lineWidth = 1 / this.zoom;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.strokeRect(x, y, w, h);
    }
    
    // Draw hovered connection points
    if (this.hoveredElement) {
      const points = this.getConnectionPoints(this.hoveredElement);
      if (points) {
        for (const [key, point] of Object.entries(points)) {
          if (key === 'center') continue;
          this.ctx.fillStyle = '#fff';
          this.ctx.strokeStyle = '#4f46e5';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
        }
      }
    }
    
    this.ctx.restore();
  }
}

