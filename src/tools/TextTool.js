export class TextTool {
  constructor(state) {
    this.state = state;
    this._activeTextarea = null;
  }

  _makeTextarea(screenX, screenTopY, fontSizePx, color, style = {}) {
    const ta = document.createElement('textarea');
    ta.style.position   = 'absolute';
    ta.style.zIndex     = '100';
    ta.style.left       = `${screenX}px`;
    ta.style.top        = `${screenTopY}px`;
    ta.style.padding    = '0';
    ta.style.margin     = '0';
    ta.style.border     = 'none';
    ta.style.outline    = 'none';
    ta.style.background = 'transparent';
    ta.style.resize     = 'none';
    ta.style.overflow   = 'hidden';
    ta.style.fontFamily = "'Caveat', cursive";
    ta.style.fontSize   = `${fontSizePx}px`;
    ta.style.fontWeight = style.fontBold  ? '700'    : '400';
    ta.style.fontStyle  = style.fontItalic ? 'italic' : 'normal';
    ta.style.lineHeight = '1.2';
    ta.style.color      = color;
    ta.style.textAlign  = 'left';
    const decs = [];
    if (style.fontUnderline)    decs.push('underline');
    if (style.fontStrikethrough) decs.push('line-through');
    ta.style.textDecoration = decs.join(' ') || 'none';
    return ta;
  }

  _autoResize(ta) {
    const span = document.createElement('span');
    span.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;' +
      `font-family:${ta.style.fontFamily};` +
      `font-size:${ta.style.fontSize};` +
      `font-weight:${ta.style.fontWeight || '400'};` +
      `font-style:${ta.style.fontStyle || 'normal'};` +
      `line-height:${ta.style.lineHeight};`;
    const lines = ta.value.split('\n');
    let maxW = 0;
    for (const line of lines) {
      span.textContent = line || '​';
      document.body.appendChild(span);
      maxW = Math.max(maxW, span.offsetWidth);
      document.body.removeChild(span);
    }
    ta.style.width  = (maxW + 6) + 'px';
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // opts: { centerAlign?: bool, maxWidth?: number (canvas units) }
  onPointerDown(pos, e, opts = {}) {
    if (this._activeTextarea) return;
    const hit = this.state.getElementAt(pos, null, ['text']);
    if (hit) { this.editElement(hit); return; }

    const fontSize   = this.state.currentStyle.fontSize || 24;
    const fsPx       = fontSize * this.state.zoom;
    const lineH      = fsPx * 1.2;
    const screenX    = pos.x * this.state.zoom + this.state.pan.x;
    const screenY    = pos.y * this.state.zoom + this.state.pan.y;
    const screenTopY = screenY - lineH / 2;

    const color = this.state.currentStyle.textColor || this.state.currentStyle.strokeColor;
    const ta = this._makeTextarea(screenX, screenTopY, fsPx, color, this.state.currentStyle);

    if (opts.centerAlign) {
      ta.style.left      = `${screenX}px`;
      ta.style.transform = 'translateX(-50%)';
      ta.style.textAlign = 'center';
      if (opts.maxWidth) {
        ta.style.width      = `${opts.maxWidth * this.state.zoom}px`;
        ta.style.whiteSpace = 'pre-wrap';
        ta.style.wordBreak  = 'break-word';
      } else {
        ta.style.whiteSpace = 'nowrap';
        ta.style.minWidth   = '4px';
      }
    } else {
      ta.style.whiteSpace = 'nowrap';
      ta.style.minWidth   = '4px';
    }

    document.getElementById('app').appendChild(ta);
    this._activeTextarea = ta;

    const resize = () => {
      if (opts.centerAlign && opts.maxWidth) {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      } else {
        this._autoResize(ta);
      }
    };
    resize();
    ta.addEventListener('input', resize);
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
        if (opts.centerAlign) {
          el.textAlign = 'center';
          if (opts.maxWidth) el.maxWidth = opts.maxWidth;
        }
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
      else if (ev.key === 'Escape')           { ta.value = ''; commit(); }
    });
  }

  editElement(element) {
    const fontSize  = element.style.fontSize || 24;
    const fsPx      = fontSize * this.state.zoom;
    const lineH     = fsPx * 1.2;
    const cachedH   = element.height || lineH / this.state.zoom;
    const screenTopY = (element.y - cachedH / 2) * this.state.zoom + this.state.pan.y;
    const screenX    = element.x * this.state.zoom + this.state.pan.x;

    const isCentered = element.textAlign === 'center';
    const color = element.style.textColor || element.style.strokeColor;
    const ta = this._makeTextarea(screenX, screenTopY, fsPx, color, element.style);
    ta.value = element.text;

    if (isCentered) {
      ta.style.left      = `${screenX}px`;
      ta.style.transform = 'translateX(-50%)';
      ta.style.textAlign = 'center';
      if (element.maxWidth) {
        ta.style.width      = `${element.maxWidth * this.state.zoom}px`;
        ta.style.whiteSpace = 'pre-wrap';
        ta.style.wordBreak  = 'break-word';
      } else {
        ta.style.whiteSpace = 'nowrap';
        ta.style.minWidth   = '4px';
      }
    } else if (element.maxWidth) {
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
