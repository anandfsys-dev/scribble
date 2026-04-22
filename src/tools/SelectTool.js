const SNAP_THRESHOLD = 8;

// Computes the proposed collective bounds of selected elements shifted by (dx, dy)
// using their original (drag-start) positions so we can check snap before applying.
function getProposedGroupBounds(selection, originalPositions, dx, dy) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selection.forEach(el => {
    const orig = originalPositions.find(o => o.id === el.id);
    if (!orig) return;
    const ox = orig.x + dx, oy = orig.y + dy;
    let b;
    if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'frame') {
      b = { minX: Math.min(ox, ox + el.width), maxX: Math.max(ox, ox + el.width),
            minY: Math.min(oy, oy + el.height), maxY: Math.max(oy, oy + el.height) };
    } else if (el.type === 'text') {
      const w = el.width || 20, h = el.height || 20;
      const left = el.textAlign === 'center' ? ox - w / 2 : ox;
      b = { minX: left, maxX: left + w, minY: oy - h / 2, maxY: oy + h / 2 };
    } else if (el.type === 'line' || el.type === 'arrow') {
      const ox2 = (orig.x2 ?? 0) + dx, oy2 = (orig.y2 ?? 0) + dy;
      b = { minX: Math.min(ox, ox2), maxX: Math.max(ox, ox2),
            minY: Math.min(oy, oy2), maxY: Math.max(oy, oy2) };
    } else if (el.type === 'freehand' && orig.points) {
      let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
      orig.points.forEach(p => {
        const px = p[0] + dx, py = p[1] + dy;
        if (px < mnX) mnX = px; if (px > mxX) mxX = px;
        if (py < mnY) mnY = py; if (py > mxY) mxY = py;
      });
      b = { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
    } else {
      b = { minX: ox, maxX: ox, minY: oy, maxY: oy };
    }
    minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
  });
  return { minX, maxX, minY, maxY };
}

export class SelectTool {
  constructor(state) {
    this.state = state;
    this.type = 'select';
    this.isDragging = false;
    this.isSelecting = false;
    this.isResizing = false;
    this.resizeElement = null;
    this.dragStart = null;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.hasMoved = false;
    this.hasDuplicatedThisDrag = false;
    this.toggleElement = null;
    this.wasSelectedBeforeClick = false;
    this.originalPositions = [];
  }

  onPointerDown(pos, e) {
    // Check if we clicked a resize handle of a selected text element
    const selectedText = this.state.selection.find(el => el.type === 'text');
    if (selectedText) {
      const x = selectedText.x;
      const y = selectedText.y;
      const fontSize = selectedText.style?.fontSize || 24;
      const width  = selectedText.width  || 80;
      const height = selectedText.height || fontSize * 1.2;
      const isCentered = selectedText.textAlign === 'center';
      const handles = isCentered ? {
        'n': { x: x,             y: y - height / 2 },
        'e': { x: x + width / 2, y: y },
        's': { x: x,             y: y + height / 2 },
        'w': { x: x - width / 2, y: y }
      } : {
        'n': { x: x + width / 2, y: y - height / 2 },
        'e': { x: x + width,     y: y },
        's': { x: x + width / 2, y: y + height / 2 },
        'w': { x: x,             y: y }
      };

      for (const [key, hPos] of Object.entries(handles)) {
        const dist = Math.sqrt(Math.pow(pos.x - hPos.x, 2) + Math.pow(pos.y - hPos.y, 2));
        if (dist < 10) {
          this.isResizing = true;
          this.resizeElement = selectedText;
          this.resizeHandle = key;
          this.dragStart = { x: pos.x, y: pos.y };
          return;
        }
      }
    }

    const clickedElement = this.state.getElementAt(pos);

    if (clickedElement) {
      this.wasSelectedBeforeClick = this.state.selection.includes(clickedElement);
      this.toggleElement = (e.shiftKey || e.ctrlKey || e.metaKey) ? clickedElement : null;

      if (!this.wasSelectedBeforeClick) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          this.state.setSelection([...this.state.selection, clickedElement]);
        } else {
          this.state.setSelection([clickedElement]);
        }
      }

      this.isDragging = true;
      this.hasDuplicatedThisDrag = false;
      this.dragStart = { x: pos.x, y: pos.y };
      this.hasMoved = false;

      this.originalPositions = this.state.selection.map(el => ({
        id: el.id,
        x: el.x,
        y: el.y,
        x2: el.x2,
        y2: el.y2,
        points: el.points ? JSON.parse(JSON.stringify(el.points)) : null
      }));
      return;
    }

    // Clicked on empty space: Start selection marquee
    this.isSelecting = true;
    this.selectionStart = { x: pos.x, y: pos.y };
    this.selectionEnd = { x: pos.x, y: pos.y };
    this.state.selectionBox = { start: this.selectionStart, end: this.selectionEnd };
    this.state.setSelection([]);
    this.state.isDirty = true;
  }

  onPointerMove(pos, e) {
    if (this.isSelecting) {
      this.selectionEnd = { x: pos.x, y: pos.y };
      this.state.selectionBox = { start: this.selectionStart, end: this.selectionEnd };
      this.state.isDirty = true;
      return;
    }

    if (this.isResizing) {
      const el = this.resizeElement;
      const handle = this.resizeHandle;
      const currentWidth = el.maxWidth || el.width || 80;
      const isCentered = el.textAlign === 'center';

      if (isCentered) {
        if (handle === 'e') {
          el.maxWidth = Math.max(50, (pos.x - el.x) * 2);
        } else if (handle === 'w') {
          el.maxWidth = Math.max(50, (el.x - pos.x) * 2);
        }
      } else {
        if (handle.includes('e')) {
          el.maxWidth = Math.max(50, pos.x - el.x);
        } else if (handle.includes('w')) {
          const rightEdge = el.x + currentWidth;
          const newX = Math.min(rightEdge - 50, pos.x);
          el.maxWidth = Math.max(50, rightEdge - newX);
          el.x = newX;
        }
      }
      // n / s: text height is auto-determined by content — no-op
      this.state.isDirty = true;
      return;
    }

    if (this.isDragging) {
      let dx = pos.x - this.dragStart.x;
      let dy = pos.y - this.dragStart.y;

      // Handle Ctrl + Drag to duplicate
      if ((e.ctrlKey || e.metaKey) && !this.hasDuplicatedThisDrag && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        const duplicates = this.state.selection.map(el => {
            const dup = JSON.parse(JSON.stringify(el));
            dup.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            delete dup.startBinding;
            delete dup.endBinding;
            return dup;
        });

        this.state.elements.push(...duplicates);
        this.state.setSelection(duplicates);
        this.hasDuplicatedThisDrag = true;

        this.originalPositions = this.state.selection.map(el => ({
            id: el.id,
            x: el.x,
            y: el.y,
            x2: el.x2,
            y2: el.y2,
            points: el.points ? JSON.parse(JSON.stringify(el.points)) : null
        }));
      }

      // Alignment snapping against other elements
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const snapped = this.computeAlignSnap(dx, dy);
        dx = snapped.dx;
        dy = snapped.dy;
        this.state.alignGuides = snapped.guides;
      } else {
        this.state.alignGuides = [];
      }

      let moved = false;
      this.state.selection.forEach(el => {
        const orig = this.originalPositions.find(o => o.id === el.id);
        if (!orig) return;

        if (el.type === 'freehand') {
          el.points = orig.points.map(p => [p[0] + dx, p[1] + dy]);
          moved = true;
        } else {
          el.x = orig.x + dx;
          el.y = orig.y + dy;
          if (el.x2 !== undefined) el.x2 = orig.x2 + dx;
          if (el.y2 !== undefined) el.y2 = orig.y2 + dy;
          moved = true;
        }
      });

      if (moved) {
        this.hasMoved = true;
        this.updateBindings();
      }
      this.state.isDirty = true;
    }
  }

  // Compute snapped (dx, dy) and guide lines by checking against other elements' edges/centers.
  computeAlignSnap(dx, dy) {
    const selection = this.state.selection;
    if (selection.length === 0) return { dx, dy, guides: [] };

    const gb = getProposedGroupBounds(selection, this.originalPositions, dx, dy);
    const gMidX = (gb.minX + gb.maxX) / 2;
    const gMidY = (gb.minY + gb.maxY) / 2;

    let bestX = null, bestXDist = SNAP_THRESHOLD;
    let bestY = null, bestYDist = SNAP_THRESHOLD;

    this.state.elements.forEach(el => {
      if (selection.includes(el)) return;
      // Skip elements with no meaningful rectangular edges
      if (el.type === 'freehand') return;
      const b = this.state.getElementBounds(el);
      const eMidX = (b.minX + b.maxX) / 2;
      const eMidY = (b.minY + b.maxY) / 2;

      for (const ex of [b.minX, eMidX, b.maxX]) {
        for (const gx of [gb.minX, gMidX, gb.maxX]) {
          const d = Math.abs(gx - ex);
          if (d < bestXDist) { bestXDist = d; bestX = { offset: ex - gx, guide: ex }; }
        }
      }
      for (const ey of [b.minY, eMidY, b.maxY]) {
        for (const gy of [gb.minY, gMidY, gb.maxY]) {
          const d = Math.abs(gy - ey);
          if (d < bestYDist) { bestYDist = d; bestY = { offset: ey - gy, guide: ey }; }
        }
      }
    });

    const guides = [];
    const snapDx = bestX ? dx + bestX.offset : dx;
    const snapDy = bestY ? dy + bestY.offset : dy;
    if (bestX) guides.push({ type: 'v', pos: bestX.guide });
    if (bestY) guides.push({ type: 'h', pos: bestY.guide });

    return { dx: snapDx, dy: snapDy, guides };
  }

  updateBindings() {
    this.state.elements.forEach(el => {
      if (el.type === 'arrow' || el.type === 'line') {
        if (el.startBinding) {
          const boundTo = this.state.elements.find(e => e.id === el.startBinding.id);
          if (boundTo) {
            const points = this.state.getConnectionPoints(boundTo);
            if (points && points[el.startBinding.key]) {
              el.x = points[el.startBinding.key].x;
              el.y = points[el.startBinding.key].y;
            } else {
              const center = this.getElementCenter(boundTo);
              el.x = center.x;
              el.y = center.y;
            }
          }
        }
        if (el.endBinding) {
          const boundTo = this.state.elements.find(e => e.id === el.endBinding.id);
          if (boundTo) {
            const points = this.state.getConnectionPoints(boundTo);
            if (points && points[el.endBinding.key]) {
              el.x2 = points[el.endBinding.key].x;
              el.y2 = points[el.endBinding.key].y;
            } else {
              const center = this.getElementCenter(boundTo);
              el.x2 = center.x;
              el.y2 = center.y;
            }
          }
        }
      }
    });
  }

  getElementCenter(el) {
    if (el.type === 'rectangle' || el.type === 'ellipse') {
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    } else if (el.type === 'text') {
      if (el.textAlign === 'center') return { x: el.x, y: el.y };
      return { x: el.x + (el.width || 100) / 2, y: el.y };
    }
    return { x: el.x, y: el.y };
  }

  onPointerUp(pos, e) {
    if (this.isSelecting) {
      this.isSelecting = false;
      this.state.selectionBox = null;

      const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
      const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
      const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
      const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

      if (Math.abs(maxX - minX) > 2 || Math.abs(maxY - minY) > 2) {
        const selected = this.state.elements.filter(el => {
          const bounds = this.state.getElementBounds(el);
          return bounds.minX <= maxX && bounds.maxX >= minX &&
                 bounds.minY <= maxY && bounds.maxY >= minY;
        });
        this.state.setSelection(selected);
      }

      this.state.alignGuides = [];
      this.state.isDirty = true;
      return;
    }

    if (this.isResizing) {
      this.isResizing = false;
      this.resizeElement = null;
      this.state.alignGuides = [];
      this.state.saveHistory();
      this.state.saveToLocalStorage();
      return;
    }

    if (this.isDragging) {
      if (this.hasMoved) {
        this.state.saveHistory();
        this.state.saveToLocalStorage();
      } else if (this.toggleElement && this.wasSelectedBeforeClick) {
        const newSelection = this.state.selection.filter(el => el.id !== this.toggleElement.id);
        this.state.setSelection(newSelection);
        this.state.isDirty = true;
      }
    }

    this.state.alignGuides = [];
    this.isDragging = false;
    this.hasMoved = false;
    this.hasDuplicatedThisDrag = false;
    this.toggleElement = null;
    this.originalPositions = [];
    this.state.isDirty = true;
  }

}
