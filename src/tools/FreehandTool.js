import { calculatePathLength, simplifyPath } from '../utils/GeometryUtils.js';

export class FreehandTool {
  constructor(state) {
    this.state = state;
    this.isDrawing = false;
    this.currentElement = null;
    this.holdTimer = null;
    this.hasSnapped = false;
    this.lastPos = null;
  }
  
  onPointerDown(pos, e) {
    this.isDrawing = true;
    this.hasSnapped = false;
    this.lastPos = pos;
    
    this.currentElement = {
      id: Date.now().toString(),
      type: 'freehand',
      points: [[pos.x, pos.y]],
      style: { ...this.state.currentStyle }
    };
    
    this.state.elements.push(this.currentElement);
    this.state.isDirty = true;
    
    this.startHoldTimer();
  }
  
  onPointerMove(pos, e) {
    if (!this.isDrawing || !this.currentElement || this.hasSnapped) return;
    
    const lastPoint = this.currentElement.points[this.currentElement.points.length - 1];
    const dx = pos.x - lastPoint[0];
    const dy = pos.y - lastPoint[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Only add points if moved significantly to reduce noise
    if (dist > 3) {
      const smoothing = 0.6;
      const nextX = lastPoint[0] + dx * smoothing;
      const nextY = lastPoint[1] + dy * smoothing;
      
      this.currentElement.points.push([nextX, nextY]);
      this.state.isDirty = true;
      
      // Reset timer if we moved significantly
      if (dist > 10) {
        this.startHoldTimer();
      }
    }
  }
  
  onPointerUp(pos, e) {
    this.clearHoldTimer();
    this.isDrawing = false;
    
    if (this.currentElement) {
      if (this.currentElement.points && this.currentElement.points.length < 2) {
        this.state.removeElement(this.currentElement);
      } else {
        this.state.saveHistory();
        this.state.saveToLocalStorage();
      }
    }
    
    this.currentElement = null;
  }

  startHoldTimer() {
    this.clearHoldTimer();
    // 600ms hold triggers shape recognition
    this.holdTimer = setTimeout(() => this.trySnapShape(), 600);
  }

  clearHoldTimer() {
    if (this.holdTimer) clearTimeout(this.holdTimer);
  }

  trySnapShape() {
    if (!this.isDrawing || !this.currentElement || this.hasSnapped) return;
    if (this.currentElement.points.length < 15) return;

    const points = this.currentElement.points;
    const pathLength = calculatePathLength(points);

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
    });
    const width = maxX - minX;
    const height = maxY - minY;

    // Minimum size thresholds to prevent small strokes (like arrow heads) from snapping
    if (pathLength < 60 || (width < 30 && height < 30)) return;

    const start = points[0];
    const end = points[points.length - 1];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const distStartEnd = Math.sqrt(dx * dx + dy * dy);

    // Logic to distinguish between Line and Ellipse
    // If endpoints are close relative to overall size, it's a closed shape (Ellipse)
    const isClosed = distStartEnd < Math.max(width, height) * 0.4 || distStartEnd < 50;

    if (isClosed) {
        // Snap to Ellipse
        this.currentElement.type = 'ellipse';
        this.currentElement.x = minX;
        this.currentElement.y = minY;
        this.currentElement.width = width;
        this.currentElement.height = height;
        delete this.currentElement.points;
    } else {
        // Decide between Straight Line and Smooth Curve
        const curviness = calculatePathLength(points);
        const straightness = curviness / distStartEnd;

        if (straightness > 1.1) {
            // It's a curve! Simplify it to create a "Smooth Curve"
            this.currentElement.points = simplifyPath(points, 10);
            // Keep type as 'freehand' but it's now "perfected"
        } else {
            // Snap to Straight Line
            this.currentElement.type = 'line';
            this.currentElement.x = start[0];
            this.currentElement.y = start[1];
            this.currentElement.x2 = end[0];
            this.currentElement.y2 = end[1];
            delete this.currentElement.points;
        }
    }

    this.hasSnapped = true;
    this.state.isDirty = true;
  }

}
