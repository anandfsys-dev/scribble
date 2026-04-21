import { Renderer } from './Renderer.js';
import { HistoryManager } from './HistoryManager.js';
import { getElementAt, hitTest, getElementBounds, isPointDeepInsideElement } from './utils/HitTestUtils.js';
import { getConnectionPoints, getClosestConnectionPoint } from './utils/ConnectionPointUtils.js';

export class CanvasState {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer(this.ctx);
    
    // Document state
    this.elements = [];
    this.selection = [];

    // History
    this.historyManager = new HistoryManager();
    
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
      strokeWidth: 1,
      fontSize: 24,
      textColor: '#1e1e1e',
      fontBold: false,
      fontItalic: false,
      fontUnderline: false,
      fontStrikethrough: false
    };
    
    // Render loop state
    this.isDirty = true;

    // Presentation state
    this.isPresenting = false;
    this.activeFrameIndex = null;

    // Callback invoked after any element change (used to refresh Frames panel)
    this._onElementsChanged = null;

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

  resetView() {
    this.scale = 1;
    this.offset = { x: 0, y: 0 };
    this.isDirty = true;
  }

  saveHistory() {
    this.historyManager.save(this.elements);
  }

  undo() {
    if (this.isPresenting) return;
    const snapshot = this.historyManager.undo();
    if (snapshot !== null) {
      this.elements = snapshot;
      this.selection = [];
      this.isDirty = true;
      this.saveToLocalStorage();
    }
  }

  redo() {
    if (this.isPresenting) return;
    const snapshot = this.historyManager.redo();
    if (snapshot !== null) {
      this.elements = snapshot;
      this.selection = [];
      this.isDirty = true;
      this.saveToLocalStorage();
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('scribble_elements');
      if (saved) {
        this.elements = JSON.parse(saved);
        this.historyManager.init(this.elements);
      }
    } catch (e) {
      console.error('Failed to load from local storage', e);
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('scribble_elements', JSON.stringify(this.elements));
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
    if (this._onElementsChanged) this._onElementsChanged();
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
      if (!el.style) return; // frame elements have no user-controlled style
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
    return getElementAt(this.elements, pos, ignoreId, types);
  }

  hitTest(pos, element) {
    return hitTest(pos, element);
  }

  getElementBounds(element) {
    return getElementBounds(element);
  }

  isPointDeepInsideElement(pos, element) {
    return isPointDeepInsideElement(pos, element);
  }
  
  // Render loop
  requestRender() {
    if (this.isDirty) {
      this.render();
      this.isDirty = false;
    }
    requestAnimationFrame(() => this.requestRender());
  }

  getFrames() {
    return this.elements
      .filter(el => el.type === 'frame')
      .sort((a, b) => a.frameOrder - b.frameOrder);
  }

  getConnectionPoints(el) {
    return getConnectionPoints(el);
  }

  getClosestConnectionPoint(pos, el) {
    return getClosestConnectionPoint(pos, el);
  }
  
  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply transform
    this.ctx.save();
    this.ctx.translate(this.pan.x, this.pan.y);
    this.ctx.scale(this.zoom, this.zoom);

    // Draw frames first (background layer) — hidden during presentation to avoid distraction
    if (!this.isPresenting) {
      this.elements.forEach(el => {
        if (el.type === 'frame') this.renderer.drawElement(el, this.selection.includes(el));
      });
    }
    // Draw all non-frame elements
    this.elements.forEach(el => {
      if (el.type !== 'frame') this.renderer.drawElement(el, this.selection.includes(el));
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

