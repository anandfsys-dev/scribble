import '../style.css';
import { CanvasState } from './CanvasState.js';
import { ToolManager } from './tools/ToolManager.js';
import { Exporter } from './Exporter.js';
import { setupTheme } from './ThemeManager.js';
import { PresentationEngine } from './PresentationEngine.js';

document.addEventListener('DOMContentLoaded', () => {
  const canvasEl = document.getElementById('canvas');
  
  // Initialize State, Tools, and Presentation Engine
  const canvasState = new CanvasState(canvasEl);
  const toolManager = new ToolManager(canvasState);
  const presentationEngine = new PresentationEngine(canvasState);
  
  // Resize handler
  const resizeCanvas = () => {
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
    canvasState.render();
  };
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); // Initial size
  
  let clipboard = [];

  const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 96];

  // Handle Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Don't intercept if typing in an input
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    // Font size step: Ctrl+Shift+. (increase) / Ctrl+Shift+, (decrease)
    // Use e.code (layout-independent) rather than e.key which varies by OS/browser when Ctrl is held
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) {
      e.preventDefault();
      const current = canvasState.currentStyle.fontSize || 24;
      const idx = FONT_SIZES.indexOf(current);
      const isIncrease = e.code === 'Period';
      let newIdx;
      if (isIncrease) {
        newIdx = idx >= 0 ? Math.min(idx + 1, FONT_SIZES.length - 1) : FONT_SIZES.findIndex(s => s > current);
        if (newIdx < 0) newIdx = FONT_SIZES.length - 1;
      } else {
        if (idx >= 0) {
          newIdx = Math.max(0, idx - 1);
        } else {
          newIdx = 0;
          for (let i = 0; i < FONT_SIZES.length; i++) { if (FONT_SIZES[i] < current) newIdx = i; }
        }
      }
      applyFontSize(canvasState, FONT_SIZES[newIdx]);
      return;
    }

    // Text formatting shortcuts
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      // Ctrl+B → bold, Ctrl+I → italic, Ctrl+Shift+S → strikethrough
      if (!e.shiftKey && e.code === 'KeyB') {
        e.preventDefault();
        toggleTextStyle(canvasState, 'fontBold', 'btn-font-bold');
        return;
      }
      if (!e.shiftKey && e.code === 'KeyI') {
        e.preventDefault();
        toggleTextStyle(canvasState, 'fontItalic', 'btn-font-italic');
        return;
      }
      if (e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        toggleTextStyle(canvasState, 'fontStrikethrough', 'btn-font-strikethrough');
        return;
      }
    }

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
    
    // Number + letter shortcuts for tools
    const toolMap = {
      '1': 'select',
      '2': 'rectangle',
      '3': 'ellipse',
      '4': 'line',
      '5': 'arrow',
      '6': 'pen',
      '7': 'text',
      'f': 'frame'
    };
    const key = e.key === 'f' ? 'f' : e.key;
    if (toolMap[key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.getElementById(`tool-${toolMap[key]}`);
      if (btn) btn.click();
    }
  });

  // ── URL span helpers ─────────────────────────────────────────────
  function addUrlSpan(element, start, end, url) {
    if (!element.urlSpans) element.urlSpans = [];
    element.urlSpans = element.urlSpans.filter(s => s.end <= start || s.start >= end);
    element.urlSpans.push({ start, end, url });
    element.urlSpans.sort((a, b) => a.start - b.start);
  }

  function removeUrlSpansInRange(element, start, end) {
    if (!element.urlSpans) return;
    element.urlSpans = element.urlSpans.filter(s => s.end <= start || s.start >= end);
    if (element.urlSpans.length === 0) delete element.urlSpans;
  }

  // ── Link Dialog ──────────────────────────────────────────────────
  const linkDialogOverlay = document.getElementById('link-dialog-overlay');
  const linkInput = document.getElementById('link-input');
  // { element, start, end, textarea } — textarea is non-null when Ctrl+K triggered from editor
  let linkDialogTarget = null;

  function openLinkDialog(el) {
    if (!el || el.type !== 'text') return;
    const existing = el.urlSpans?.length > 0 ? el.urlSpans[0].url : '';
    linkInput.value = existing;
    linkDialogTarget = { element: el, start: 0, end: el.text.length, textarea: null };
    linkDialogOverlay.classList.remove('hidden');
    setTimeout(() => linkInput.focus(), 50);
  }

  function openLinkDialogForRange(element, start, end, textarea) {
    const existing = (element.urlSpans || []).find(s => s.start <= start && s.end >= end);
    linkInput.value = existing?.url || '';
    linkDialogTarget = { element, start, end, textarea };
    // Suppress textarea blur-commit while dialog is open
    toolManager.tools.text._suppressBlurCommit = true;
    linkDialogOverlay.classList.remove('hidden');
    setTimeout(() => linkInput.focus(), 50);
  }

  function closeLinkDialog(refocusTextarea) {
    linkDialogOverlay.classList.add('hidden');
    const ta = linkDialogTarget?.textarea;
    linkDialogTarget = null;
    toolManager.tools.text._suppressBlurCommit = false;
    if (refocusTextarea && ta) setTimeout(() => ta.focus(), 10);
  }

  function confirmLink() {
    if (!linkDialogTarget) return;
    const { element, start, end } = linkDialogTarget;
    const raw = linkInput.value.trim();
    const url = raw ? (raw.startsWith('http') ? raw : 'https://' + raw) : null;
    if (url) {
      addUrlSpan(element, start, end, url);
    } else {
      removeUrlSpansInRange(element, start, end);
    }
    canvasState.saveHistory();
    canvasState.saveToLocalStorage();
    canvasState.isDirty = true;
    closeLinkDialog(true);
  }

  document.getElementById('link-confirm-btn').addEventListener('click', confirmLink);
  document.getElementById('link-cancel-btn').addEventListener('click', () => closeLinkDialog(true));
  linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmLink(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeLinkDialog(true); }
    e.stopPropagation();
  });
  linkDialogOverlay.addEventListener('pointerdown', (e) => {
    if (e.target === linkDialogOverlay) closeLinkDialog(true);
  });

  // Wire up Ctrl+K from TextTool
  toolManager.tools.text._onLinkRequest = (element, start, end, textarea) => {
    openLinkDialogForRange(element, start, end, textarea);
  };

  // ── Link Tooltip (shown below selected linked text) ──────────────
  const linkTooltip = document.getElementById('link-tooltip');
  const linkTooltipUrl = document.getElementById('link-tooltip-url');
  const linkTooltipEdit = document.getElementById('link-tooltip-edit');

  linkTooltipEdit.addEventListener('click', () => {
    const el = canvasState.selection[0];
    if (el?.type === 'text') openLinkDialog(el);
  });

  canvasState._onAfterRender = () => {
    const sel = canvasState.selection;
    const isEditing = !!toolManager.tools.text._activeTextarea;
    if (sel.length === 1 && sel[0].type === 'text' && sel[0].urlSpans?.length > 0 && !isEditing) {
      const el = sel[0];
      const b = canvasState.getElementBounds(el);
      const cx = (b.minX + b.maxX) / 2;
      const cy = b.maxY;
      const sx = cx * canvasState.zoom + canvasState.pan.x;
      const sy = cy * canvasState.zoom + canvasState.pan.y;
      const firstUrl = el.urlSpans[0].url;
      linkTooltipUrl.textContent = firstUrl.length > 42 ? firstUrl.slice(0, 39) + '…' : firstUrl;
      linkTooltipUrl.href = firstUrl;
      linkTooltip.style.display = 'flex';
      linkTooltip.style.left = sx + 'px';
      linkTooltip.style.top  = (sy + 10) + 'px';
    } else {
      linkTooltip.style.display = 'none';
    }
  };

  // ── Context Menu ────────────────────────────────────────────────
  const contextMenu = document.getElementById('context-menu');
  const ctxLinkBtn = document.getElementById('ctx-link-btn');
  const ctxOpenLinkBtn = document.getElementById('ctx-open-link-btn');
  const ctxRemoveLinkBtn = document.getElementById('ctx-remove-link-btn');
  let contextMenuTarget = null;

  canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = canvasState.screenToCanvas(e.clientX, e.clientY);
    const hitEl = canvasState.getElementAt(pos);

    if (hitEl && !canvasState.selection.includes(hitEl)) {
      canvasState.setSelection([hitEl]);
    }
    contextMenuTarget = hitEl || null;

    const hasSelection = canvasState.selection.length > 0;
    const isText = contextMenuTarget?.type === 'text';
    const hasLinks = isText && !!contextMenuTarget.urlSpans?.length;

    document.querySelector('[data-action="cut"]').classList.toggle('ctx-item--disabled', !hasSelection);
    document.querySelector('[data-action="copy"]').classList.toggle('ctx-item--disabled', !hasSelection);

    ctxLinkBtn.style.display = isText ? 'flex' : 'none';
    ctxOpenLinkBtn.style.display = hasLinks ? 'flex' : 'none';
    ctxRemoveLinkBtn.style.display = hasLinks ? 'flex' : 'none';
    if (isText) ctxLinkBtn.querySelector('.ctx-label').textContent = hasLinks ? 'Edit Link' : 'Add Link';

    const sep = contextMenu.querySelector('.ctx-sep');
    sep.style.display = isText ? 'block' : 'none';

    contextMenu.style.left = '0';
    contextMenu.style.top = '0';
    contextMenu.classList.remove('hidden');
    const mw = contextMenu.offsetWidth, mh = contextMenu.offsetHeight;
    contextMenu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth  - mw - 8)) + 'px';
    contextMenu.style.top  = Math.max(8, Math.min(e.clientY, window.innerHeight - mh - 8)) + 'px';
  });

  document.addEventListener('pointerdown', (e) => {
    if (!contextMenu.contains(e.target)) contextMenu.classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      contextMenu.classList.add('hidden');
      if (!linkDialogOverlay.classList.contains('hidden')) closeLinkDialog(true);
    }
  });

  contextMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item || item.classList.contains('ctx-item--disabled')) return;
    const action = item.dataset.action;
    contextMenu.classList.add('hidden');

    switch (action) {
      case 'cut':
        clipboard = JSON.parse(JSON.stringify(canvasState.selection));
        clipboard.forEach(el => { delete el.startBinding; delete el.endBinding; });
        if (canvasState.selection.length > 0) {
          canvasState.selection.forEach(el => canvasState.removeElement(el));
          canvasState.setSelection([]);
        }
        break;

      case 'copy':
        clipboard = JSON.parse(JSON.stringify(canvasState.selection));
        clipboard.forEach(el => { delete el.startBinding; delete el.endBinding; });
        break;

      case 'paste':
        if (clipboard.length > 0) {
          const pasted = JSON.parse(JSON.stringify(clipboard));
          pasted.forEach((el, index) => {
            el.id = Date.now().toString() + index;
            if (el.type === 'freehand') {
              el.points = el.points.map(p => [p[0] + 20, p[1] + 20]);
            } else {
              el.x += 20; el.y += 20;
              if (el.x2 !== undefined) el.x2 += 20;
              if (el.y2 !== undefined) el.y2 += 20;
            }
            canvasState.elements.push(el);
          });
          canvasState.setSelection(pasted);
          canvasState.saveHistory();
          canvasState.isDirty = true;
        }
        break;

      case 'link':
        openLinkDialog(contextMenuTarget);
        break;

      case 'open-link':
        if (contextMenuTarget?.urlSpans?.length) {
          window.open(contextMenuTarget.urlSpans[0].url, '_blank', 'noopener');
        }
        break;

      case 'remove-link':
        if (contextMenuTarget) {
          delete contextMenuTarget.urlSpans;
          canvasState.saveHistory();
          canvasState.saveToLocalStorage();
          canvasState.isDirty = true;
        }
        break;
    }
  });

  // Handle Double Click to add text to shape or edit text
  canvasEl.addEventListener('dblclick', (e) => {
    const pos = canvasState.screenToCanvas(e.clientX, e.clientY);
    const hitElement = canvasState.getElementAt(pos);

    if (hitElement) {
      if (hitElement.type === 'text') {
        toolManager.tools.text.editElement(hitElement);
      } else if (hitElement.type === 'rectangle' || hitElement.type === 'ellipse') {
        const center = {
          x: hitElement.x + hitElement.width / 2,
          y: hitElement.y + hitElement.height / 2
        };
        document.getElementById('tool-text').click();
        toolManager.activeTool.onPointerDown(center, e, {
          centerAlign: true,
          maxWidth: Math.abs(hitElement.width)
        });
      } else {
        const center = toolManager.tools.select.getElementCenter
          ? toolManager.tools.select.getElementCenter(hitElement)
          : { x: hitElement.x + (hitElement.width||0)/2, y: hitElement.y + (hitElement.height||0)/2 };
        document.getElementById('tool-text').click();
        toolManager.activeTool.onPointerDown(center, e);
      }
    } else if (toolManager.activeTool.type === 'text') {
      toolManager.activeTool.onPointerDown(pos, e);
    }
  });
  
  // Setup UI Listeners
  setupToolbar(canvasState, toolManager);
  setupProperties(canvasState);
  setupExport(canvasState);
  setupTheme(canvasState);
  setupFramesPanel(canvasState, presentationEngine);
  setupSearch(canvasState);
});


function animatePanToElement(el, state, animRef) {
  const b = state.getElementBounds(el);
  const bW = Math.max(b.maxX - b.minX, 1);
  const bH = Math.max(b.maxY - b.minY, 1);
  const bcx = (b.minX + b.maxX) / 2;
  const bcy = (b.minY + b.maxY) / 2;

  const P = 80;
  const W = window.innerWidth, H = window.innerHeight;
  const targetZoom = Math.min((W - 2*P) / bW, (H - 2*P) / bH, 2.5);
  const targetPanX = W/2 - bcx * targetZoom;
  const targetPanY = H/2 - bcy * targetZoom;

  const startZoom = state.zoom;
  const startPanX = state.pan.x, startPanY = state.pan.y;
  const duration = 650;
  const startTime = performance.now();

  if (animRef.id) cancelAnimationFrame(animRef.id);

  const tick = (now) => {
    const t = Math.min((now - startTime) / duration, 1);
    const e = t < 0.5 ? 16*t*t*t*t*t : 1 - Math.pow(-2*t+2, 5)/2;
    state.zoom   = startZoom + (targetZoom - startZoom) * e;
    state.pan.x  = startPanX + (targetPanX - startPanX) * e;
    state.pan.y  = startPanY + (targetPanY - startPanY) * e;
    state.isDirty = true;
    if (t < 1) animRef.id = requestAnimationFrame(tick);
  };
  animRef.id = requestAnimationFrame(tick);
}

function setupSearch(canvasState) {
  const bar      = document.getElementById('search-bar');
  const input    = document.getElementById('search-input');
  const countEl  = document.getElementById('search-count');
  const prevBtn  = document.getElementById('search-prev');
  const nextBtn  = document.getElementById('search-next');
  const closeBtn = document.getElementById('search-close');

  let results = [];
  let cursor  = -1;
  const animRef = { id: null };

  function open() {
    bar.classList.remove('hidden');
    input.focus();
    input.select();
    runSearch();
  }

  function close() {
    bar.classList.add('hidden');
    canvasState.searchHighlightId = null;
    canvasState.searchQuery = null;
    canvasState.isDirty = true;
    if (animRef.id) cancelAnimationFrame(animRef.id);
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
      e.preventDefault();
      bar.classList.contains('hidden') ? open() : input.focus();
    }
  }, { capture: true });

  closeBtn.addEventListener('click', close);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter')  { e.shiftKey ? navigate(-1) : navigate(1); }
    e.stopPropagation();
  });

  function runSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results = []; cursor = -1;
      updateCount();
      canvasState.searchHighlightId = null;
      canvasState.searchQuery = null;
      canvasState.isDirty = true;
      return;
    }
    canvasState.searchQuery = q;
    results = canvasState.elements.filter(el => {
      if (el.type === 'text')  return el.text?.toLowerCase().includes(q);
      if (el.type === 'frame') return el.name?.toLowerCase().includes(q);
      return false;
    });
    cursor = results.length > 0 ? 0 : -1;
    updateCount();
    focusCurrent();
  }

  function navigate(dir) {
    if (results.length === 0) return;
    cursor = (cursor + dir + results.length) % results.length;
    updateCount();
    focusCurrent();
  }

  function focusCurrent() {
    if (cursor < 0 || cursor >= results.length) return;
    const el = results[cursor];
    canvasState.searchHighlightId = el.id;
    canvasState.isDirty = true;
    animatePanToElement(el, canvasState, animRef);
  }

  function updateCount() {
    countEl.className = 'search-count';
    if (!input.value.trim()) { countEl.textContent = ''; return; }
    if (results.length === 0) {
      countEl.textContent = 'no results';
      countEl.classList.add('no-results');
    } else {
      countEl.textContent = `${cursor + 1}/${results.length}`;
      countEl.classList.add('has-results');
    }
    prevBtn.disabled = results.length <= 1;
    nextBtn.disabled = results.length <= 1;
  }

  input.addEventListener('input', runSearch);
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));
}

function applyFontSize(state, size) {
  state.currentStyle.fontSize = size;
  const sel = document.getElementById('font-size-select');
  if (sel) sel.value = size;
  state.applyStyleToSelection('fontSize', size);
}

function toggleTextStyle(state, prop, btnId) {
  const newVal = !state.currentStyle[prop];
  state.currentStyle[prop] = newVal;
  document.getElementById(btnId)?.classList.toggle('active', newVal);
  state.applyStyleToSelection(prop, newVal);
}

function setupToolbar(state, toolManager) {
  const tools = ['select', 'rectangle', 'ellipse', 'line', 'arrow', 'pen', 'text', 'frame'];
  
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

  // Text Color
  document.querySelectorAll('.text-color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.text-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStyle.textColor = btn.dataset.color;
      state.applyStyleToSelection('textColor', btn.dataset.color);
    });
  });

  // Font Size dropdown
  // Save selection on mousedown so the native dropdown can't cause it to be lost
  const fontSizeSelect = document.getElementById('font-size-select');
  if (fontSizeSelect) {
    let _savedSel = [];
    fontSizeSelect.addEventListener('mousedown', () => { _savedSel = [...state.selection]; });
    fontSizeSelect.addEventListener('change', () => {
      const size = parseInt(fontSizeSelect.value);
      state.currentStyle.fontSize = size;
      // If selection was somehow cleared during dropdown interaction, restore it
      if (state.selection.length === 0 && _savedSel.length > 0) state.selection = _savedSel;
      applyFontSize(state, size);
    });
  }

  // Text style toggles (Bold / Italic / Underline / Strikethrough)
  ['fontBold', 'fontItalic', 'fontUnderline', 'fontStrikethrough'].forEach(prop => {
    const btn = document.querySelector(`.text-style-btn[data-style="${prop}"]`);
    if (!btn) return;
    let _savedSel = [];
    btn.addEventListener('mousedown', () => { _savedSel = [...state.selection]; });
    btn.addEventListener('click', () => {
      if (state.selection.length === 0 && _savedSel.length > 0) state.selection = _savedSel;
      const newVal = !state.currentStyle[prop];
      state.currentStyle[prop] = newVal;
      btn.classList.toggle('active', newVal);
      state.applyStyleToSelection(prop, newVal);
    });
  });
}

function setupFramesPanel(state, engine) {
  function renderFramesList() {
    const list = document.getElementById('frames-list');
    const empty = document.getElementById('frames-empty');
    const frames = state.getFrames();

    // Update badge
    const badge = document.getElementById('frames-count-badge');
    if (frames.length > 0) {
      badge.textContent = frames.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }

    const clearBtn = document.getElementById('btn-clear-frames');
    if (frames.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      clearBtn.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    clearBtn.style.display = 'block';
    list.innerHTML = '';

    frames.forEach((frame, i) => {
      const item = document.createElement('div');
      item.className = 'frame-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'frame-item-name';
      nameSpan.textContent = frame.name;
      nameSpan.title = 'Click to zoom • Double-click to rename';

      nameSpan.addEventListener('click', () => {
        engine.zoomToFrame(frame);
      });

      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = frame.name;
        input.className = 'frame-item-input';
        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
          const newName = input.value.trim() || frame.name;
          frame.name = newName;
          state.saveHistory();
          state.saveToLocalStorage();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { commit(); input.blur(); }
          if (ev.key === 'Escape') { input.value = frame.name; input.blur(); }
          ev.stopPropagation();
        });
      });

      const upBtn = document.createElement('button');
      upBtn.textContent = '▲';
      upBtn.className = 'frame-order-btn';
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prev = frames[i - 1];
        [frame.frameOrder, prev.frameOrder] = [prev.frameOrder, frame.frameOrder];
        state.saveHistory();
        state.saveToLocalStorage();
      });

      const downBtn = document.createElement('button');
      downBtn.textContent = '▼';
      downBtn.className = 'frame-order-btn';
      downBtn.disabled = i === frames.length - 1;
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = frames[i + 1];
        [frame.frameOrder, next.frameOrder] = [next.frameOrder, frame.frameOrder];
        state.saveHistory();
        state.saveToLocalStorage();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✕';
      deleteBtn.className = 'frame-delete-btn';
      deleteBtn.title = 'Delete frame';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.elements = state.elements.filter(el => el !== frame);
        state.isDirty = true;
        state.saveHistory();
        state.saveToLocalStorage();
      });

      item.appendChild(nameSpan);
      item.appendChild(upBtn);
      item.appendChild(downBtn);
      item.appendChild(deleteBtn);
      list.appendChild(item);
    });
  }

  // Sync list whenever elements change
  state._onElementsChanged = renderFramesList;
  renderFramesList();

  // Toggle collapse/expand
  document.getElementById('btn-frames-toggle').addEventListener('click', (e) => {
    document.getElementById('frames-panel').classList.toggle('frames-panel--collapsed');
  });

  // Present button — stop propagation so it doesn't trigger the toggle
  document.getElementById('btn-present').addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.getFrames().length === 0) return;
    engine.start(0);
  });

  // Clear all frames
  document.getElementById('btn-clear-frames').addEventListener('click', () => {
    if (state.getFrames().length === 0) return;
    state.elements = state.elements.filter(el => el.type !== 'frame');
    state.isDirty = true;
    state.saveHistory();
    state.saveToLocalStorage();
  });

  // Presentation overlay controls
  document.getElementById('btn-exit-present').addEventListener('click', () => engine.exit());
  document.getElementById('btn-prev-frame').addEventListener('click', () => engine.navigate(-1));
  document.getElementById('btn-next-frame').addEventListener('click', () => engine.navigate(1));

  // Click anywhere on overlay (not on a button) → advance to next frame
  document.getElementById('presentation-overlay').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    engine.navigate(1);
  });
}

function setupExport(state) {
  document.getElementById('btn-clear').addEventListener('click', () => {
    state.clearCanvas();
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    Exporter.exportJson(state.elements);
  });
  
  document.getElementById('btn-reset-view').addEventListener('click', () => {
    state.resetView();
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
