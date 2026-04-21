export class PresentationEngine {
  constructor(state) {
    this.state = state;
    this._animFrame = null;
    this._onKey = this._onKey.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  getFrames() {
    return this.state.getFrames();
  }

  start(index = 0) {
    const frames = this.getFrames();
    if (frames.length === 0) return;
    this.state.isPresenting = true;
    this.state.activeFrameIndex = Math.max(0, Math.min(index, frames.length - 1));
    document.body.classList.add('presenting');
    document.getElementById('presentation-overlay').classList.remove('hidden');
    document.getElementById('pres-dim-overlay').style.display = 'block';
    this._animateTo(frames[this.state.activeFrameIndex]);
    this._updateOverlay();
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', this._onResize);
  }

  exit() {
    this.state.isPresenting = false;
    this.state.activeFrameIndex = null;
    this.state.isDirty = true;
    document.body.classList.remove('presenting');
    document.getElementById('presentation-overlay').classList.add('hidden');
    document.getElementById('pres-dim-overlay').style.display = 'none';
    document.getElementById('pres-dim-overlay').style.clipPath = '';
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
  }

  navigate(delta) {
    const frames = this.getFrames();
    if (frames.length === 0) return;
    const newIndex = Math.max(0, Math.min(this.state.activeFrameIndex + delta, frames.length - 1));
    this.state.activeFrameIndex = newIndex;
    this._animateTo(frames[newIndex]);
    this._updateOverlay();
  }

  // Zoom to a frame without entering presentation mode (used from frames panel list)
  zoomToFrame(frame) {
    this._animateTo(frame);
  }

  _animateTo(frame) {
    const P = 40;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const fw = Math.abs(frame.width);
    const fh = Math.abs(frame.height);
    if (fw === 0 || fh === 0) return;

    const targetZoom = Math.min((W - 2 * P) / fw, (H - 2 * P) / fh);
    const fcx = frame.x + frame.width / 2;
    const fcy = frame.y + frame.height / 2;
    const targetPanX = W / 2 - fcx * targetZoom;
    const targetPanY = H / 2 - fcy * targetZoom;

    const startZoom = this.state.zoom;
    const startPanX = this.state.pan.x;
    const startPanY = this.state.pan.y;
    const duration = 700;
    const startTime = performance.now();

    if (this._animFrame) cancelAnimationFrame(this._animFrame);

    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Ease-in-out quint — smoother than cubic, imperceptible acceleration/deceleration
      const e = t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
      this.state.zoom = startZoom + (targetZoom - startZoom) * e;
      this.state.pan.x = startPanX + (targetPanX - startPanX) * e;
      this.state.pan.y = startPanY + (targetPanY - startPanY) * e;
      this.state.isDirty = true;
      this._updateDimOverlay(frame);
      if (t < 1) this._animFrame = requestAnimationFrame(animate);
    };
    this._animFrame = requestAnimationFrame(animate);
  }

  // Update the CSS clip-path blur overlay so the active frame area is unblurred
  _updateDimOverlay(frame) {
    const overlay = document.getElementById('pres-dim-overlay');
    if (!overlay) return;

    const { zoom, pan } = this.state;
    const normX = (frame.width >= 0 ? frame.x : frame.x + frame.width) * zoom + pan.x;
    const normY = (frame.height >= 0 ? frame.y : frame.y + frame.height) * zoom + pan.y;
    const normW = Math.abs(frame.width) * zoom;
    const normH = Math.abs(frame.height) * zoom;
    const W = window.innerWidth;
    const H = window.innerHeight;

    const x1 = normX, y1 = normY;
    const x2 = normX + normW, y2 = normY + normH;

    // Outer rectangle (full screen) with inner counterclockwise hole (frame area)
    overlay.style.clipPath = `polygon(
      0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px, 0px 0px,
      ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
    )`;
  }

  _updateOverlay() {
    const frames = this.getFrames();
    const frame = frames[this.state.activeFrameIndex];
    const nameEl = document.getElementById('pres-frame-name');
    const counterEl = document.getElementById('pres-counter');
    if (nameEl) nameEl.textContent = frame?.name || '';
    if (counterEl) counterEl.textContent = `${this.state.activeFrameIndex + 1} / ${frames.length}`;

    const prevBtn = document.getElementById('btn-prev-frame');
    const nextBtn = document.getElementById('btn-next-frame');
    if (prevBtn) prevBtn.disabled = this.state.activeFrameIndex === 0;
    if (nextBtn) nextBtn.disabled = this.state.activeFrameIndex === frames.length - 1;
  }

  _onKey(e) {
    if (e.key === 'Escape') { this.exit(); return; }
    if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) { e.preventDefault(); this.navigate(1); }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); this.navigate(-1); }
  }

  _onResize() {
    const frames = this.getFrames();
    if (frames.length === 0 || this.state.activeFrameIndex === null) return;
    const frame = frames[this.state.activeFrameIndex];
    this._animateTo(frame);
  }
}
