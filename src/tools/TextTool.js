export class TextTool {
  constructor(state) {
    this.state = state;
    this._activeTextarea = null;
  }

  // ── Textarea factory ────────────────────────────────────────────
  _makeTextarea(screenX, screenTopY, fontSizePx, color) {
    const ta = document.createElement('textarea');
    ta.style.position  = 'absolute';
    ta.style.zIndex    = '100';
    ta.style.left      = `${screenX}px`;
    ta.style.top       = `${screenTopY}px`;
    ta.style.padding   = '0';
    ta.style.margin    = '0';
    ta.style.border    = 'none';
    ta.style.outline   = 'none';
    ta.style.background = 'transparent';
    ta.style.resize    = 'none';
    ta.style.overflow  = 'hidden';
    ta.style.fontFamily = "'Caveat', cursive";
    ta.style.fontSize  = `${fontSizePx}px`;
    ta.style.lineHeight = '1.2';
    ta.style.color     = color;
    ta.style.textAlign = 'left';
    // No transform — explicit top positioning avoids rounding mismatch
    return ta;
  }

  // Measure the longest line and resize the textarea to fit exactly
  _autoResize(ta) {
    const span = document.createElement('span');
    span.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;' +
      `font-family:${ta.style.fontFamily};` +
      `font-size:${ta.style.fontSize};` +
      `line-height:${ta.style.lineHeight};`;
    // Measure the widest line (for nowrap mode)
    const lines = ta.value.split('\n');
    let maxW = 0;
    for (const line of lines) {
      span.textContent = line || '​';
      document.body.appendChild(span);
      maxW = Math.max(maxW, span.offsetWidth);
      document.body.removeChild(span);
    }
    ta.style.width  = (maxW + 6) + 'px'; // small buffer prevents internal clipping
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // ── Create new text ─────────────────────────────────────────────
  onPointerDown(pos, e) {
    if (this._activeTextarea) return;
    const hit = this.state.getElementAt(pos, null, ['text']);
    if (hit) { this.editElement(hit); return; }

    const fontSize   = this.state.currentStyle.fontSize || 24;
    const fsPx       = fontSize * this.state.zoom;          // screen px
    const lineH      = fsPx * 1.2;
    const screenX    = pos.x * this.state.zoom + this.state.pan.x;
    const screenY    = pos.y * this.state.zoom + this.state.pan.y;
    // Position textarea top so that first-line EM-middle sits exactly at screenY
    const screenTopY = screenY - lineH / 2;

    const color = this.state.currentStyle.textColor || this.state.currentStyle.strokeColor;
    const ta = this._makeTextarea(screenX, screenTopY, fsPx, color);
    ta.style.whiteSpace = 'nowrap';
    ta.style.minWidth   = '4px';

    document.getElementById('app').appendChild(ta);
    this._activeTextarea = ta;
    this._autoResize(ta);
    ta.addEventListener('input', () => this._autoResize(ta));
    setTimeout(() => ta.focus(), 10);

    const commit = () => {
      if (!ta.parentNode) return;
      this._activeTextarea = null;
      const text = ta.value.trim();
      if (text) {
        const el = {
          id: Date.now().toString(),
          type: 'text',
          text,
          x: pos.x,
          y: pos.y,
          style: { ...this.state.currentStyle }
        };
        this.state.addElement(el);
        this.state.setSelection([el]);
      }
      ta.remove();
      document.getElementById('tool-select')?.click();
    };

    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && ev.shiftKey) { ev.preventDefault(); commit(); }
      else if (ev.key === 'Escape')            { ta.value = ''; commit(); }
    });
  }

  // ── Edit existing text ──────────────────────────────────────────
  editElement(element) {
    const fontSize  = element.style.fontSize || 24;
    const fsPx      = fontSize * this.state.zoom;
    const lineH     = fsPx * 1.2;

    // element.y is the vertical center of the text block.
    // Canvas top of text block = element.y - element.height/2.
    // Fallback height = single-line height when renderer hasn't cached it yet.
    const cachedH   = element.height || lineH / this.state.zoom;
    const screenX   = element.x * this.state.zoom + this.state.pan.x;
    const screenTopY = (element.y - cachedH / 2) * this.state.zoom + this.state.pan.y;

    const color = element.style.textColor || element.style.strokeColor;
    const ta = this._makeTextarea(screenX, screenTopY, fsPx, color);
    ta.value = element.text;

    if (element.maxWidth) {
      // Wrapping mode: fix width, allow height to grow
      ta.style.width      = `${element.maxWidth * this.state.zoom}px`;
      ta.style.whiteSpace = 'pre-wrap';
      ta.style.wordBreak  = 'break-word';
    } else {
      ta.style.whiteSpace = 'nowrap';
      ta.style.minWidth   = '4px';
    }

    document.getElementById('app').appendChild(ta);
    this._activeTextarea = ta;

    const resize = () => {
      if (element.maxWidth) {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      } else {
        this._autoResize(ta);
      }
    };
    resize();
    ta.addEventListener('input', resize);

    setTimeout(() => { ta.focus(); ta.select(); }, 10);

    // Hide canvas text while textarea is active
    const original = element.text;
    element.text = '';
    this.state.isDirty = true;

    const commit = () => {
      if (!ta.parentNode) return;
      this._activeTextarea = null;
      const text = ta.value.trim();
      if (text) {
        element.text = text;
        this.state.isDirty = true;
        this.state.saveHistory();
        this.state.saveToLocalStorage();
      } else {
        this.state.removeElement(element);
      }
      ta.remove();
      document.getElementById('tool-select')?.click();
    };

    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && ev.shiftKey) { ev.preventDefault(); commit(); }
      else if (ev.key === 'Escape') {
        ev.preventDefault();
        this._activeTextarea = null;
        element.text = original;
        ta.remove();
        this.state.isDirty = true;
      }
    });
  }

  onPointerMove() {}
  onPointerUp()   {}
}
