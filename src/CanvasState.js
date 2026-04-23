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

    // Alignment guides (set by SelectTool during drag, cleared on release)
    this.alignGuides = [];

    // Search highlight state
    this.searchHighlightId = null;
    this.searchQuery = null;

    // Group edit mode: groupId of the group being individually edited, or null
    this.editingGroupId = null;

    // Called each rAF tick — used by main.js to update DOM overlays (link tooltip, etc.)
    this._onAfterRender = null;

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
        this.elements = CanvasState._migrateElements(JSON.parse(saved));
        this.historyManager.init(this.elements);
      }
    } catch (e) {
      console.error('Failed to load from local storage', e);
    }
  }

  // Migrate legacy element.url → urlSpans
  static _migrateElements(elements) {
    return elements.map(el => {
      if (el.type === 'text' && el.url && !el.urlSpans) {
        el.urlSpans = [{ start: 0, end: el.text?.length ?? 0, url: el.url }];
        delete el.url;
      }
      return el;
    });
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

  bringToFront() {
    const sel = new Set(this.selection.filter(el => el.type !== 'frame'));
    if (!sel.size) return;
    this.saveHistory();
    this.elements = [...this.elements.filter(el => !sel.has(el)), ...this.elements.filter(el => sel.has(el))];
    this.isDirty = true;
    this.saveToLocalStorage();
  }

  sendToBack() {
    const sel = new Set(this.selection.filter(el => el.type !== 'frame'));
    if (!sel.size) return;
    this.saveHistory();
    this.elements = [...this.elements.filter(el => sel.has(el)), ...this.elements.filter(el => !sel.has(el))];
    this.isDirty = true;
    this.saveToLocalStorage();
  }

  bringForward() {
    const sel = new Set(this.selection.filter(el => el.type !== 'frame'));
    if (!sel.size) return;
    this.saveHistory();
    for (let i = this.elements.length - 2; i >= 0; i--) {
      if (sel.has(this.elements[i]) && !sel.has(this.elements[i + 1]))
        [this.elements[i], this.elements[i + 1]] = [this.elements[i + 1], this.elements[i]];
    }
    this.isDirty = true;
    this.saveToLocalStorage();
  }

  sendBackward() {
    const sel = new Set(this.selection.filter(el => el.type !== 'frame'));
    if (!sel.size) return;
    this.saveHistory();
    for (let i = 1; i < this.elements.length; i++) {
      if (sel.has(this.elements[i]) && !sel.has(this.elements[i - 1]))
        [this.elements[i], this.elements[i - 1]] = [this.elements[i - 1], this.elements[i]];
    }
    this.isDirty = true;
    this.saveToLocalStorage();
  }

  getGroupMembers(groupId) {
    return this.elements.filter(el => el.groupId === groupId);
  }

  groupElements() {
    const targets = this.selection.filter(el => el.type !== 'frame');
    if (targets.length < 2) return;
    this.saveHistory();
    const newGroupId = Date.now().toString() + 'g';
    targets.forEach(el => { el.groupId = newGroupId; });
    this.isDirty = true;
    this.saveToLocalStorage();
  }

  ungroupElements() {
    const targets = this.selection.filter(el => el.groupId);
    if (!targets.length) return;
    this.saveHistory();
    targets.forEach(el => { delete el.groupId; });
    this.editingGroupId = null;
    this.isDirty = true;
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
    if (this.isDirty || this.searchHighlightId) {
      this.render();
      this.isDirty = false;
    }
    if (this._onAfterRender) this._onAfterRender();
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
    // Draw all non-frame elements; suppress individual selection handles for whole-group selections
    this.elements.forEach(el => {
      if (el.type !== 'frame') {
        const individuallySelected = this.selection.includes(el) &&
          (!el.groupId || this.editingGroupId === el.groupId);
        this.renderer.drawElement(el, individuallySelected);
      }
    });

    // Draw group outlines (faint when idle, prominent when any member is selected/in edit)
    const seenGroupIds = new Set();
    this.elements.forEach(el => { if (el.groupId) seenGroupIds.add(el.groupId); });
    seenGroupIds.forEach(gid => {
      const members = this.getGroupMembers(gid);
      const b = members.reduce((acc, el) => {
        const eb = this.getElementBounds(el);
        return {
          minX: Math.min(acc.minX, eb.minX), minY: Math.min(acc.minY, eb.minY),
          maxX: Math.max(acc.maxX, eb.maxX), maxY: Math.max(acc.maxY, eb.maxY)
        };
      }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      const isActive = this.selection.some(el => el.groupId === gid) || this.editingGroupId === gid;
      this.renderer.drawGroupOutline(b, isActive);
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
    
    // Draw alignment guides
    if (this.alignGuides && this.alignGuides.length > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = '#3b82f6';
      this.ctx.lineWidth = 1 / this.zoom;
      this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
      this.ctx.globalAlpha = 0.75;
      const extent = 50000;
      this.alignGuides.forEach(guide => {
        this.ctx.beginPath();
        if (guide.type === 'v') {
          this.ctx.moveTo(guide.pos, -extent);
          this.ctx.lineTo(guide.pos, extent);
        } else {
          this.ctx.moveTo(-extent, guide.pos);
          this.ctx.lineTo(extent, guide.pos);
        }
        this.ctx.stroke();
      });
      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = 1;
      this.ctx.restore();
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
    
    // Draw search highlight
    if (this.searchHighlightId) {
      const el = this.elements.find(e => e.id === this.searchHighlightId);
      if (el) {
        const t = Date.now();
        if (el.type === 'text' && this.searchQuery && el.text) {
          // Word-level yellow highlight drawn over the text (semi-transparent so text stays readable)
          const { style } = el;
          const fontSize = style.fontSize || 24;
          const isCentered = el.textAlign === 'center';
          this.ctx.save();
          this.ctx.font = `${style.fontItalic ? 'italic ' : ''}${style.fontBold ? 'bold ' : ''}${fontSize}px 'Caveat', cursive`;
          const lines = this.renderer.wrapTextWithOffsets(this.ctx, el.text, el.maxWidth);
          const lineHeight = fontSize * 1.2;
          const totalHeight = lines.length * lineHeight;
          const startY = el.y - totalHeight / 2 + lineHeight / 2;
          const lowerText = el.text.toLowerCase();
          const q = this.searchQuery;
          const matchRanges = [];
          let mPos = 0;
          while ((mPos = lowerText.indexOf(q, mPos)) !== -1) {
            matchRanges.push({ start: mPos, end: mPos + q.length });
            mPos += q.length;
          }
          this.ctx.fillStyle = 'rgba(255, 200, 50, 0.45)';
          for (let li = 0; li < lines.length; li++) {
            const { text: lineText, startOffset } = lines[li];
            const lineEnd = startOffset + lineText.length;
            const lineY = startY + li * lineHeight;
            const linePixelWidth = this.ctx.measureText(lineText).width;
            const lineStartX = isCentered ? el.x - linePixelWidth / 2 : el.x;
            for (const { start, end } of matchRanges) {
              const overlapStart = Math.max(start, startOffset);
              const overlapEnd = Math.min(end, lineEnd);
              if (overlapStart >= overlapEnd) continue;
              const preWidth = this.ctx.measureText(lineText.substring(0, overlapStart - startOffset)).width;
              const matchWidth = this.ctx.measureText(lineText.substring(overlapStart - startOffset, overlapEnd - startOffset)).width;
              this.ctx.fillRect(lineStartX + preWidth - 1, lineY - fontSize * 0.5, matchWidth + 2, fontSize);
            }
          }
          this.ctx.restore();
        } else {
          // Marching-ants ring for frames (the frame name IS the match, no sub-word target)
          const b = this.getElementBounds(el);
          const pad = 14;
          const pulse = 0.5 + 0.3 * Math.sin(t / 350);
          this.ctx.save();
          this.ctx.strokeStyle = `rgba(185, 85, 48, ${pulse})`;
          this.ctx.lineWidth = 2.5 / this.zoom;
          const dashLen = 10 / this.zoom;
          const gapLen  = 6  / this.zoom;
          this.ctx.setLineDash([dashLen, gapLen]);
          this.ctx.lineDashOffset = -(t / 60) % (dashLen + gapLen);
          this.ctx.beginPath();
          const rx = b.minX - pad, ry = b.minY - pad;
          const rw = (b.maxX - b.minX) + pad * 2;
          const rh = (b.maxY - b.minY) + pad * 2;
          const r  = Math.min(6 / this.zoom, rw / 2, rh / 2);
          this.ctx.roundRect(rx, ry, rw, rh, r);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
          this.ctx.restore();
        }
      }
    }

    this.ctx.restore();
  }
}

