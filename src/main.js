import '../style.css';
import { CanvasState } from './CanvasState.js';
import { ToolManager } from './tools/ToolManager.js';
import { Exporter } from './Exporter.js';

document.addEventListener('DOMContentLoaded', () => {
  const canvasEl = document.getElementById('canvas');
  
  // Initialize State and Tools
  const canvasState = new CanvasState(canvasEl);
  const toolManager = new ToolManager(canvasState);
  
  // Resize handler
  const resizeCanvas = () => {
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
    canvasState.render();
  };
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); // Initial size
  
  let clipboard = [];

  // Handle Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Don't intercept if typing in an input
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey)) {
        const key = e.key.toLowerCase();
        if (key === 'c') {
            clipboard = JSON.parse(JSON.stringify(canvasState.selection));
            clipboard.forEach(el => { delete el.startBinding; delete el.endBinding; });
        } else if (key === 'x') {
            clipboard = JSON.parse(JSON.stringify(canvasState.selection));
            clipboard.forEach(el => { delete el.startBinding; delete el.endBinding; });
            if (canvasState.selection.length > 0) {
                canvasState.selection.forEach(el => canvasState.removeElement(el));
                canvasState.setSelection([]);
            }
        } else if (key === 'v') {
            if (clipboard.length > 0) {
                const pasted = JSON.parse(JSON.stringify(clipboard));
                pasted.forEach((el, index) => {
                    el.id = Date.now().toString() + index;
                    if (el.type === 'freehand') {
                        el.points = el.points.map(p => [p[0] + 20, p[1] + 20]);
                    } else {
                        el.x += 20;
                        el.y += 20;
                        if (el.x2 !== undefined) el.x2 += 20;
                        if (el.y2 !== undefined) el.y2 += 20;
                    }
                    canvasState.elements.push(el);
                });
                canvasState.setSelection(pasted);
                canvasState.saveHistory();
                canvasState.isDirty = true;
            }
        }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (canvasState.selection.length > 0) {
        canvasState.selection.forEach(el => canvasState.removeElement(el));
        canvasState.setSelection([]);
      }
    }
    
    // Number shortcuts
    const toolMap = {
      '1': 'select',
      '2': 'rectangle',
      '3': 'ellipse',
      '4': 'line',
      '5': 'arrow',
      '6': 'pen',
      '7': 'text'
    };
    if (toolMap[e.key]) {
      const btn = document.getElementById(`tool-${toolMap[e.key]}`);
      if (btn) btn.click();
    }
  });

  // Handle Double Click to add text to shape or edit text
  canvasEl.addEventListener('dblclick', (e) => {
    const pos = canvasState.screenToCanvas(e.clientX, e.clientY);
    const hitElement = canvasState.getElementAt(pos);
    
    if (hitElement) {
      if (hitElement.type === 'text') {
        toolManager.tools.text.editElement(hitElement);
      } else {
        // Find center
        const center = toolManager.tools.select.getElementCenter ? 
                       toolManager.tools.select.getElementCenter(hitElement) : 
                       { x: hitElement.x + (hitElement.width||0)/2, y: hitElement.y + (hitElement.height||0)/2 };
        
        // Select text tool
        document.getElementById('tool-text').click();
        
        // Trigger text tool at center
        toolManager.activeTool.onPointerDown(center, e);
      }
    } else if (toolManager.activeTool.type === 'text') {
      // Double click empty space in text mode - start new text
      toolManager.activeTool.onPointerDown(pos, e);
    }
  });
  
  // Setup UI Listeners
  setupToolbar(canvasState, toolManager);
  setupProperties(canvasState);
  setupExport(canvasState);
  setupTheme(canvasState);
});

const PALETTES = {
  light: {
    stroke: ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'],
    fill: ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99']
  },
  dark: {
    stroke: ['#f8f9fa', '#ff8787', '#8ce99a', '#74c0fc', '#ffd43b'],
    fill: ['transparent', '#5c0011', '#092b00', '#001d66', '#5c3e00']
  }
};

function updatePalette(state) {
  const isDark = document.documentElement.classList.contains('dark');
  const palette = isDark ? PALETTES.dark : PALETTES.light;
  const oldPalette = isDark ? PALETTES.light : PALETTES.dark;

  // Update buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    const index = btn.dataset.colorIndex;
    const color = palette.stroke[index];
    btn.style.backgroundColor = color;
    btn.dataset.color = color;
  });

  document.querySelectorAll('.fill-btn').forEach(btn => {
    const index = btn.dataset.colorIndex;
    const color = palette.fill[index];
    if (color === 'transparent') {
      btn.style.background = isDark ? 
        'repeating-linear-gradient(45deg, transparent, transparent 3px, #334155 3px, #334155 6px)' :
        'repeating-linear-gradient(45deg, transparent, transparent 3px, #e2e8f0 3px, #e2e8f0 6px)';
    } else {
      btn.style.background = color;
    }
    btn.dataset.color = color;
  });

  // Update existing elements and current style
  const sIdx = oldPalette.stroke.indexOf(state.currentStyle.strokeColor);
  if (sIdx !== -1) state.currentStyle.strokeColor = palette.stroke[sIdx];
  
  const fIdx = oldPalette.fill.indexOf(state.currentStyle.fillColor);
  if (fIdx !== -1) state.currentStyle.fillColor = palette.fill[fIdx];

  state.elements.forEach(el => {
    const s = oldPalette.stroke.indexOf(el.style.strokeColor);
    if (s !== -1) el.style.strokeColor = palette.stroke[s];
    
    const f = oldPalette.fill.indexOf(el.style.fillColor);
    if (f !== -1) el.style.fillColor = palette.fill[f];
  });

  state.isDirty = true;
}

function setupTheme(state) {
  const btn = document.getElementById('btn-theme');
  const html = document.documentElement;
  
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  
  updatePalette(state);
  
  btn.addEventListener('click', () => {
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updatePalette(state);
  });
}

function setupToolbar(state, toolManager) {
  const tools = ['select', 'rectangle', 'ellipse', 'line', 'arrow', 'pen', 'text'];
  
  tools.forEach(toolName => {
    const btn = document.getElementById(`tool-${toolName}`);
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      // Update UI
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update state
      toolManager.setActiveTool(toolName);
    });
  });
}

function setupProperties(state) {
  // Stroke Color
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStyle.strokeColor = btn.dataset.color;
      state.applyStyleToSelection('strokeColor', btn.dataset.color);
    });
  });
  
  // Fill Color
  document.querySelectorAll('.fill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.fill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStyle.fillColor = btn.dataset.color;
      state.applyStyleToSelection('fillColor', btn.dataset.color);
    });
  });
  
  // Stroke Width
  document.querySelectorAll('.width-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStyle.strokeWidth = parseInt(btn.dataset.width);
      state.applyStyleToSelection('strokeWidth', parseInt(btn.dataset.width));
    });
  });
}

function setupExport(state) {
  document.getElementById('btn-clear').addEventListener('click', () => {
    state.clearCanvas();
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    Exporter.exportJson(state.elements);
  });
  
  const importBtn = document.getElementById('btn-import-json');
  const importInput = document.getElementById('input-import-json');
  
  importBtn.addEventListener('click', () => {
    importInput.click();
  });
  
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const elements = await Exporter.importJson(file);
        if (Array.isArray(elements)) {
          state.elements = elements;
          state.setSelection([]);
          state.saveHistory();
          state.isDirty = true;
          alert('Import successful!');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to import JSON: Invalid format.');
      }
      importInput.value = ''; // Reset for next time
    }
  });
}
