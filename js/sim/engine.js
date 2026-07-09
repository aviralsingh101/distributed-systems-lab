import { Draw } from "./primitives.js";

/**
 * Stage — a 2D canvas diagram surface. One instance per topic view; disposed on
 * navigation. It maintains a fixed logical coordinate space (W×H) that is scaled
 * to fit the host element (letterboxed, retina-aware) so every diagram is laid
 * out in stable, predictable coordinates. It renders continuously and calls a
 * single tick callback each frame with the real delta time; the drawing itself
 * is immediate-mode via the `Draw` helper (stage.g).
 */
export class Stage {
  constructor(host) {
    this.host = host;
    this.W = 1000;
    this.H = 560;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "diagram-canvas";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.g = new Draw(this);

    this._tick = null;
    this._disposed = false;
    this._last = performance.now();

    this._resize = this._resize.bind(this);
    this._ro = new ResizeObserver(this._resize);
    this._ro.observe(host);
    this._resize();

    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  onTick(cb) { this._tick = cb; }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.host.clientWidth || 800;
    const ch = this.host.clientHeight || 460;
    this.canvas.width = Math.max(1, Math.round(cw * dpr));
    this.canvas.height = Math.max(1, Math.round(ch * dpr));
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    this.dpr = dpr;
    this.cw = cw;
    this.ch = ch;
    this.scale = Math.min(cw / this.W, ch / this.H);
    this.offx = (cw - this.W * this.scale) / 2;
    this.offy = (ch - this.H * this.scale) / 2;
  }

  _loop(now) {
    if (this._disposed) return;
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    ctx.save();
    ctx.translate(this.offx, this.offy);
    ctx.scale(this.scale, this.scale);
    if (this._tick) {
      try { this._tick(dt); } catch (e) { /* keep the loop alive */ }
    }
    ctx.restore();
    this._raf = requestAnimationFrame(this._loop);
  }

  dispose() {
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
