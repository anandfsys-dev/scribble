import { SelectTool } from './SelectTool.js';
import { DrawTool } from './DrawTool.js';
import { FreehandTool } from './FreehandTool.js';
import { TextTool } from './TextTool.js';

export class ToolManager {
  constructor(state) {
    this.state = state;
    
    // Initialize tools
    this.tools = {
      select: new SelectTool(state),
      rectangle: new DrawTool(state, 'rectangle'),
      ellipse: new DrawTool(state, 'ellipse'),
      line: new DrawTool(state, 'line'),
      arrow: new DrawTool(state, 'arrow'),
      pen: new FreehandTool(state),
      text: new TextTool(state)
    };
    
    this.activeTool = this.tools.select;
    this.isPanning = false;
    this.lastPanPos = { x: 0, y: 0 };
    
    this.setupListeners();
  }
  
  setActiveTool(toolName) {
    if (this.tools[toolName]) {
      this.activeTool = this.tools[toolName];
      this.state.setSelection([]); // Clear selection on tool change
    }
  }
  
  setupListeners() {
    const canvas = this.state.canvas;
    
    canvas.addEventListener('pointerdown', (e) => {
      // Middle click or spacebar+click for panning (simple implementation: middle click)
      if (e.button === 1 || e.shiftKey) {
        this.isPanning = true;
        this.lastPanPos = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        return;
      }
      
      const pos = this.state.screenToCanvas(e.clientX, e.clientY);

      // Auto line-draw interception
      if (this.activeTool.type === 'select' && this.state.hoverPoint) {
         document.getElementById('tool-arrow').click();
         // The click changes this.activeTool, so we proceed to call onPointerDown on the newly active tool
      }

      this.activeTool.onPointerDown(pos, e);
    });
    
    window.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastPanPos.x;
        const dy = e.clientY - this.lastPanPos.y;
        this.state.pan.x += dx;
        this.state.pan.y += dy;
        this.lastPanPos = { x: e.clientX, y: e.clientY };
        this.state.isDirty = true;
        return;
      }
      
      const pos = this.state.screenToCanvas(e.clientX, e.clientY);
      this.activeTool.onPointerMove(pos, e);
      
      // Hover logic for connection points
      if (this.activeTool.type === 'arrow' || this.activeTool.type === 'line') {
        const hitElement = this.state.getElementAt(pos, this.activeTool.currentElement ? this.activeTool.currentElement.id : null, ['rectangle', 'ellipse', 'text']);
        
        let targetHoverElement = hitElement;
        
        if (hitElement) {
            const isDeepInside = this.state.isPointDeepInsideElement(pos, hitElement);
            if (isDeepInside) {
                targetHoverElement = null; // Hide connection points
            }
        }

        if (targetHoverElement !== this.state.hoveredElement) {
          this.state.hoveredElement = targetHoverElement;
          this.state.isDirty = true;
        }

        // Auto line-draw feature: track hover on connection points
        if (targetHoverElement) {
            const point = this.state.getClosestConnectionPoint(pos, targetHoverElement);
            if (point && Math.hypot(pos.x - point.point.x, pos.y - point.point.y) < 25) {
                this.state.hoverPoint = point;
                document.body.style.cursor = 'crosshair';
            } else {
                this.state.hoverPoint = null;
                document.body.style.cursor = 'default';
            }
        } else {
            this.state.hoverPoint = null;
            document.body.style.cursor = 'default';
        }
      } else {
        if (this.state.hoveredElement || this.state.hoverPoint) {
          this.state.hoveredElement = null;
          this.state.hoverPoint = null;
          this.state.isDirty = true;
          document.body.style.cursor = 'default';
        }

        // Text tool cursor
        if (this.activeTool.type === 'text') {
          const hitText = this.state.getElementAt(pos, null, ['text']);
          if (hitText) {
            document.body.style.cursor = 'text';
          } else {
            document.body.style.cursor = 'crosshair';
          }
        }
      }
    });
    
    window.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        canvas.style.cursor = 'default';
        return;
      }
      
      const pos = this.state.screenToCanvas(e.clientX, e.clientY);
      this.activeTool.onPointerUp(pos, e);
    });
    
    // Zooming
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomFactor = 0.005;
        const delta = -e.deltaY * zoomFactor;
        const oldZoom = this.state.zoom;
        const newZoom = Math.max(0.1, Math.min(this.state.zoom + delta, 5));
        
        // Zoom towards mouse pointer
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        this.state.pan.x = mouseX - (mouseX - this.state.pan.x) * (newZoom / oldZoom);
        this.state.pan.y = mouseY - (mouseY - this.state.pan.y) * (newZoom / oldZoom);
        
        this.state.zoom = newZoom;
      } else {
        // Pan
        this.state.pan.x -= e.deltaX;
        this.state.pan.y -= e.deltaY;
      }
      this.state.isDirty = true;
    }, { passive: false });
  }
}
