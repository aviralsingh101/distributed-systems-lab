/* ------------------------------------------------------------------ palette */
export const C = {
  bg: "#0b0f1a",
  panel: "#131b2b",
  panelLine: "#26324a",
  ink: "#e6ecf7",
  muted: "#93a1bd",
  faint: "#5b6a88",
  grid: "#1a2233",
  wallet: "#5b9dff",
  service: "#7c5cff",
  gateway: "#ff8fab",
  ledger: "#3ddc97",
  queue: "#ffb454",
  client: "#9aa7c7",
  ok: "#3ddc97",
  warn: "#ffb454",
  err: "#ff5c6c",
  accent: "#5b9dff",
  lock: "#ffd166",
};

/* --------------------------------------------------------------- math utils */
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t,
};
export const cycle = (t, period) => (t % period) / period;

/** Active phase index + local progress across a repeating list of durations. */
export function phaseOf(t, durations) {
  const total = durations.reduce((a, b) => a + b, 0);
  const loops = Math.floor(t / total);
  let x = t % total;
  for (let i = 0; i < durations.length; i++) {
    if (x < durations[i]) return { i, p: durations[i] ? x / durations[i] : 1, loops };
    x -= durations[i];
  }
  return { i: durations.length - 1, p: 1, loops };
}

const withAlpha = (hex, a) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
export { withAlpha };

/* -------------------------------------------------------------- Draw helper */
/**
 * Immediate-mode 2D drawing helper. All coordinates are in the stage's logical
 * space (1000×560). Methods are intentionally high level (node, db, arrow,
 * token, gauge, lane) so topic diagrams read like a description of the concept.
 */
export class Draw {
  constructor(stage) {
    this.s = stage;
    this.layoutBounds = [];
    this.trackLayout = false;
  }
  get ctx() { return this.s.ctx; }
  get W() { return this.s.W; }
  get H() { return this.s.H; }

  _noteLayout(kind, x, y, w, h, meta = "") {
    if (!this.trackLayout) return;
    this.layoutBounds.push({ kind, x, y, w, h, meta });
  }

  _noteText(str, x, y, opts = {}) {
    if (!this.trackLayout || !str) return;
    const size = opts.size ?? 15;
    const w = Math.min(this.W, Math.max(24, String(str).length * size * 0.58));
    const h = size + 6;
    let left = x;
    if (opts.align === "center") left = x - w / 2;
    else if (opts.align === "right") left = x - w;
    const top = y - h / 2;
    this.layoutBounds.push({ kind: "text", x: left, y: top, w, h, meta: String(str).slice(0, 40) });
  }

  font(size, { weight = 400, mono = false } = {}) {
    const fam = mono ? "ui-monospace, Menlo, Consolas, monospace" : "system-ui, 'Segoe UI', Roboto, sans-serif";
    this.ctx.font = `${weight} ${size}px ${fam}`;
  }

  _rr(x, y, w, h, r) {
    const c = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /** Faint background grid for depth (called once per frame if desired). */
  grid() {
    const c = this.ctx;
    c.save();
    c.strokeStyle = C.grid;
    c.lineWidth = 1;
    for (let x = 0; x <= this.W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.H); c.stroke(); }
    for (let y = 0; y <= this.H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(this.W, y); c.stroke(); }
    c.restore();
  }

  text(x, y, str, opts = {}) {
    const c = this.ctx;
    const { size = 15, color = C.ink, align = "left", baseline = "middle", weight = 400, mono = false, alpha = 1, skipLayout = false } = opts;
    c.save();
    c.globalAlpha = alpha;
    this.font(size, { weight, mono });
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = baseline;
    c.fillText(str, x, y);
    c.restore();
    if (!skipLayout) this._noteText(str, x, y, opts);
  }

  /** Multi-line text block, returns height used. */
  para(x, y, str, opts = {}) {
    const { size = 13, lh = 18 } = opts;
    str.split("\n").forEach((line, i) => this.text(x, y + i * lh, line, { size, ...opts }));
  }

  /**
   * A labelled box (service / actor / wallet / etc).
   * opts: { title, value, color, active, state:'ok'|'err'|'warn'|'dim', icon, w, h, align }
   */
  node(x, y, w, h, opts = {}) {
    const c = this.ctx;
    const { title = "", value = "", color = C.service, state = "", active = false, sub = "" } = opts;
    const borderCol = state === "err" ? C.err : state === "ok" ? C.ok : state === "warn" ? C.warn : color;
    c.save();
    if (active) { c.shadowColor = withAlpha(borderCol, 0.7); c.shadowBlur = 22; }
    this._rr(x, y, w, h, 12);
    c.fillStyle = state === "dim" ? "#0f1524" : C.panel;
    c.fill();
    c.shadowBlur = 0;
    // color accent strip on top
    c.save();
    this._rr(x, y, w, h, 12); c.clip();
    c.fillStyle = withAlpha(borderCol, 0.16);
    c.fillRect(x, y, w, 6);
    c.restore();
    this._rr(x, y, w, h, 12);
    c.lineWidth = active ? 2.4 : 1.4;
    c.strokeStyle = state === "dim" ? C.panelLine : borderCol;
    c.stroke();
    c.restore();

    const cx = x + w / 2;
    const trunc = (s, max = 18) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
    if (title && value && sub) {
      this.text(cx, y + 18, trunc(title, 14), { size: 12, weight: 700, align: "center", color: state === "dim" ? C.muted : C.ink });
      this.text(cx, y + h / 2 + 2, trunc(value, 18), { size: 11, align: "center", mono: true, color: borderCol, weight: 600 });
      this.text(cx, y + h - 12, trunc(sub, 16), { size: 10, align: "center", color: C.muted });
    } else if (title && value) {
      this.text(cx, y + 20, trunc(title, 14), { size: 13, weight: 700, align: "center", color: state === "dim" ? C.muted : C.ink });
      this.text(cx, y + h - 16, trunc(value, 20), { size: value.length > 14 ? 11 : 13, align: "center", mono: true, color: borderCol, weight: 600 });
    } else if (title) {
      this.text(cx, y + h / 2, trunc(title, 16), { size: 14, weight: 700, align: "center", color: state === "dim" ? C.muted : C.ink });
    } else if (sub) {
      this.text(cx, y + h - 14, trunc(sub, 16), { size: 11, align: "center", color: C.muted });
    }
    this._noteLayout("box", x, y, w, h, title || value || sub);
    return { cx, cy: y + h / 2, x, y, w, h, top: y, bottom: y + h, left: x, right: x + w };
  }

  /** Draw node or DB cylinder based on kind. */
  component(x, y, w, h, opts = {}) {
    if (opts.kind === "db") return this.db(x, y, w, h, opts);
    return this.node(x, y, w, h, opts);
  }

  /** A database cylinder. Returns anchor points. */
  db(x, y, w, h, opts = {}) {
    const c = this.ctx;
    const { title = "DB", value = "", color = C.ledger, state = "", active = false } = opts;
    const col = state === "err" ? C.err : state === "ok" ? C.ok : color;
    const ry = Math.min(14, h * 0.16);
    c.save();
    if (active) { c.shadowColor = withAlpha(col, 0.6); c.shadowBlur = 18; }
    c.fillStyle = C.panel;
    c.strokeStyle = col; c.lineWidth = 1.6;
    // body
    c.beginPath();
    c.moveTo(x, y + ry);
    c.lineTo(x, y + h - ry);
    c.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, 0, true);
    c.lineTo(x + w, y + ry);
    c.stroke();
    c.beginPath(); c.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, 0, Math.PI * 2); c.fillStyle = C.panel; c.fill(); c.stroke();
    // top ellipse
    c.beginPath(); c.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2);
    c.fillStyle = withAlpha(col, 0.18); c.fill(); c.stroke();
    c.restore();
    this.text(x + w / 2, y + ry + 14, title.length > 14 ? title.slice(0, 13) + "…" : title, { size: 12, weight: 700, align: "center" });
    if (value) {
      const vs = value.length > 16 ? value.slice(0, 15) + "…" : value;
      this.text(x + w / 2, y + h - ry - 10, vs, { size: value.length > 12 ? 11 : 13, align: "center", mono: true, color: col, weight: 600 });
    }
    this._noteLayout("db", x, y, w, h, title);
    return { cx: x + w / 2, cy: y + h / 2, x, y, w, h, top: y, bottom: y + h, left: x, right: x + w };
  }

  /** Straight arrow with optional dashed style, label, and partial progress. */
  arrow(x1, y1, x2, y2, opts = {}) {
    const c = this.ctx;
    const { color = C.muted, width = 2, dashed = false, label = "", head = true, progress = 1, labelBg = true, alpha = 1 } = opts;
    const ex = lerp(x1, x2, progress), ey = lerp(y1, y2, progress);
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = color; c.lineWidth = width;
    if (dashed) c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(ex, ey); c.stroke();
    c.setLineDash([]);
    if (head && progress > 0.02) {
      const ang = Math.atan2(ey - y1, ex - x1);
      const s = 9;
      c.beginPath();
      c.moveTo(ex, ey);
      c.lineTo(ex - s * Math.cos(ang - 0.4), ey - s * Math.sin(ang - 0.4));
      c.lineTo(ex - s * Math.cos(ang + 0.4), ey - s * Math.sin(ang + 0.4));
      c.closePath(); c.fillStyle = color; c.fill();
    }
    c.restore();
    if (label) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (labelBg) {
        this.font(12, { mono: true });
        const w = c.measureText(label).width + 12;
        c.save(); c.fillStyle = withAlpha(C.bg, 0.85); this._rr(mx - w / 2, my - 11, w, 22, 6); c.fill();
        c.strokeStyle = C.panelLine; c.lineWidth = 1; c.stroke(); c.restore();
      }
      this.text(mx, my, label, { size: 12, align: "center", mono: true, color, skipLayout: true });
    }
    return { ex, ey };
  }

  /** A moving token (request / message / event). */
  token(x, y, opts = {}) {
    const c = this.ctx;
    const { r = 12, color = C.accent, label = "", glow = true, text = "", skipLayout = false } = opts;
    c.save();
    if (glow) { c.shadowColor = withAlpha(color, 0.9); c.shadowBlur = 16; }
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color; c.fill();
    c.restore();
    if (text) this.text(x, y, text, { size: 10, align: "center", weight: 700, color: "#0b0f1a", skipLayout });
    if (label) this.text(x, y - r - 9, label, { size: 11, align: "center", mono: true, color, skipLayout: true });
  }

  /** Horizontal gauge with fill fraction 0..1. */
  gauge(x, y, w, h, frac, opts = {}) {
    const c = this.ctx;
    const { color = C.ok, label = "", value = "", track = "#0f1524" } = opts;
    frac = clamp(frac);
    c.save();
    this._rr(x, y, w, h, h / 2); c.fillStyle = track; c.fill();
    c.strokeStyle = C.panelLine; c.lineWidth = 1; c.stroke();
    if (frac > 0.001) { this._rr(x, y, Math.max(h, w * frac), h, h / 2); c.fillStyle = color; c.fill(); }
    c.restore();
    if (label) this.text(x, y - 10, label, { size: 12, color: C.muted, skipLayout: true });
    if (value) this.text(x + w, y - 10, value, { size: 12, align: "right", mono: true, color, skipLayout: true });
  }

  /** Vertical bar (for balances / latency etc). value in [0,max]. */
  vbar(x, yBottom, w, maxH, value, max, opts = {}) {
    const c = this.ctx;
    const { color = C.wallet, label = "", value: valLabel } = opts;
    const frac = clamp(value / max);
    const h = Math.max(2, frac * maxH);
    c.save();
    this._rr(x, yBottom - maxH, w, maxH, 6); c.fillStyle = "#0f1524"; c.fill();
    c.strokeStyle = C.panelLine; c.lineWidth = 1; c.stroke();
    this._rr(x, yBottom - h, w, h, 6); c.fillStyle = color; c.fill();
    c.restore();
    if (valLabel !== undefined) this.text(x + w / 2, yBottom - h - 12, valLabel, { size: 13, align: "center", mono: true, weight: 600, color });
    if (label) this.text(x + w / 2, yBottom + 14, label, { size: 11, align: "center", color: C.muted, skipLayout: true });
  }

  /** A small pill / badge. */
  badge(x, y, str, opts = {}) {
    const c = this.ctx;
    const { color = C.accent, filled = false, align = "left", flight = false } = opts;
    this.font(12, { weight: 700 });
    const w = c.measureText(str).width + 18;
    const bx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    c.save();
    this._rr(bx, y - 12, w, 24, 12);
    c.fillStyle = filled ? color : withAlpha(color, 0.14);
    c.fill();
    if (!filled) { c.strokeStyle = withAlpha(color, 0.5); c.lineWidth = 1; c.stroke(); }
    c.restore();
    this.text(bx + w / 2, y, str, { size: 12, align: "center", weight: 700, color: filled ? "#0b0f1a" : color });
    if (!flight) this._noteLayout("badge", bx, y - 12, w, 24, str);
    return { w, right: bx + w };
  }

  /** Lock glyph (padlock) above a point. */
  lock(x, y, opts = {}) {
    const c = this.ctx;
    const { color = C.lock, open = false, label = "" } = opts;
    c.save();
    c.strokeStyle = color; c.lineWidth = 2.4; c.fillStyle = withAlpha(color, 0.9);
    // shackle
    c.beginPath();
    if (open) c.arc(x - 3, y - 6, 6, Math.PI, Math.PI * 2.05);
    else c.arc(x, y - 6, 6, Math.PI, Math.PI * 2);
    c.stroke();
    // body
    this._rr(x - 8, y - 2, 16, 13, 3); c.fill();
    c.restore();
    if (label) this.text(x, y + 24, label, { size: 11, align: "center", mono: true, color });
  }

  /** Bezier connector (for topology / rings). */
  curve(x1, y1, x2, y2, opts = {}) {
    const c = this.ctx;
    const { color = C.muted, width = 2, dashed = false, bend = 0.3, alpha = 1 } = opts;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const cx = mx - dy * bend, cy = my + dx * bend;
    c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
    if (dashed) c.setLineDash([5, 6]);
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
    c.restore();
    return { cx, cy };
  }

  /** Quadratic curve with explicit control point; optional partial progress 0..1. */
  quadCurve(x1, y1, cx, cy, x2, y2, opts = {}) {
    const c = this.ctx;
    const { color = C.muted, width = 2, dashed = false, alpha = 1, progress = 1 } = opts;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    if (dashed) c.setLineDash([5, 6]);
    c.beginPath();
    c.moveTo(x1, y1);
    if (progress >= 0.999) {
      c.quadraticCurveTo(cx, cy, x2, y2);
    } else {
      const steps = Math.max(4, Math.floor(progress * 20));
      for (let i = 1; i <= steps; i++) {
        const t = (i / 20) * progress;
        const u = 1 - t;
        const px = u * u * x1 + 2 * u * t * cx + t * t * x2;
        const py = u * u * y1 + 2 * u * t * cy + t * t * y2;
        c.lineTo(px, py);
      }
    }
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  /** Position along a straight path at p∈[0,1]. */
  along(x1, y1, x2, y2, p) { return { x: lerp(x1, x2, p), y: lerp(y1, y2, p) }; }

  /** Rolling time-series line chart. series: [{label,color,points:[{t,v}]}] */
  timeSeriesChart(x, y, w, h, series, opts = {}) {
    const c = this.ctx;
    const { windowSec = 30, title = "" } = opts;
    c.save();
    this._rr(x, y, w, h, 8);
    c.fillStyle = "#0f1524";
    c.fill();
    c.strokeStyle = C.panelLine;
    c.lineWidth = 1;
    c.stroke();
    if (title) this.text(x + 10, y + 16, title, { size: 11, color: C.muted, weight: 600 });
    const plotY = y + (title ? 24 : 8);
    const plotH = h - (title ? 32 : 16);
    const plotX = x + 40;
    const plotW = w - 50;
    const now = series[0]?.points?.length ? series[0].points[series[0].points.length - 1].t : 0;
    const t0 = now - windowSec;
    let maxV = 1;
    series.forEach((s) => s.points.forEach((p) => { if (p.t >= t0) maxV = Math.max(maxV, p.v); }));
    maxV = Math.max(maxV, 5);
    // grid lines
    for (let i = 0; i <= 4; i++) {
      const gy = plotY + plotH - (i / 4) * plotH;
      c.strokeStyle = C.grid;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(plotX, gy);
      c.lineTo(plotX + plotW, gy);
      c.stroke();
      this.text(plotX - 6, gy + 4, String(Math.round((i / 4) * maxV)), { size: 9, align: "right", mono: true, color: C.faint });
    }
    series.forEach((s) => {
      const pts = s.points.filter((p) => p.t >= t0);
      if (pts.length === 0) return;
      c.strokeStyle = s.color || C.accent;
      c.lineWidth = 2;
      c.beginPath();
      pts.forEach((p, i) => {
        const px = plotX + ((p.t - t0) / windowSec) * plotW;
        const py = plotY + plotH - (p.v / maxV) * plotH;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      if (pts.length === 1) {
        const p = pts[0];
        const px = plotX + ((p.t - t0) / windowSec) * plotW;
        const py = plotY + plotH - (p.v / maxV) * plotH;
        c.moveTo(plotX, py);
        c.lineTo(px, py);
      }
      c.stroke();
    });
    // legend — stack vertically if labels are long
    series.forEach((s, i) => {
      const lx = plotX;
      const ly = y + h - 22 - i * 14;
      c.fillStyle = s.color || C.accent;
      c.fillRect(lx, ly - 8, 12, 3);
      this.text(lx + 16, ly - 4, s.label, { size: 10, color: C.muted });
    });
    c.restore();
  }

  /** Large counter tile (ACCEPTED / DROPPED). */
  counterTile(x, y, w, h, label, value, color = C.ok) {
    const c = this.ctx;
    c.save();
    this._rr(x, y, w, h, 8);
    c.fillStyle = withAlpha(color, 0.12);
    c.fill();
    c.strokeStyle = withAlpha(color, 0.4);
    c.lineWidth = 1.5;
    c.stroke();
    this.text(x + w / 2, y + h * 0.35, label, { size: 11, align: "center", color: C.muted, weight: 600 });
    this.text(x + w / 2, y + h * 0.72, String(value), { size: 24, align: "center", mono: true, weight: 700, color });
    this._noteLayout("counter", x, y, w, h, label);
    c.restore();
  }

  /** Visual token bucket with floating token dots. */
  tokenBucket(x, y, w, h, tokens, cap, opts = {}) {
    const c = this.ctx;
    const { label = "Tokens", refillRate } = opts;
    const frac = clamp(tokens / Math.max(1, cap));
    c.save();
    // bucket outline (U shape)
    c.strokeStyle = C.accent;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x, y + 20);
    c.lineTo(x, y + h - 10);
    c.quadraticCurveTo(x, y + h, x + 15, y + h);
    c.lineTo(x + w - 15, y + h);
    c.quadraticCurveTo(x + w, y + h, x + w, y + h - 10);
    c.lineTo(x + w, y + 20);
    c.stroke();
    // fill level
    const fillH = frac * (h - 40);
    if (fillH > 2) {
      c.fillStyle = withAlpha(C.queue, 0.35);
      this._rr(x + 8, y + h - 10 - fillH, w - 16, fillH, 4);
      c.fill();
    }
    // token dots
    const n = Math.min(Math.floor(tokens), 20);
    for (let i = 0; i < n; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const tx = x + 20 + col * ((w - 40) / 3);
      const ty = y + h - 25 - row * 18;
      c.beginPath();
      c.arc(tx, ty, 6, 0, Math.PI * 2);
      c.fillStyle = withAlpha(C.accent, 0.7);
      c.fill();
    }
    this.text(x + w / 2, y + h - 8, `${label}: ${tokens.toFixed(1)} / ${cap}`, { size: 11, align: "center", mono: true, weight: 600, color: C.ink });
    if (refillRate != null) this.text(x + w / 2, y + h + 14, `refill ${refillRate}/s`, { size: 10, align: "center", color: C.muted });
    this._noteLayout("bucket", x, y, w, h + (refillRate != null ? 28 : 14), label);
    c.restore();
  }

  /** Leaky bucket — queue fills from top, fixed leak rate at bottom. */
  leakyBucket(x, y, w, h, level, cap, opts = {}) {
    const c = this.ctx;
    const { label = "Queue depth", leakRate } = opts;
    const frac = clamp(level / Math.max(1, cap));
    c.save();
    c.strokeStyle = C.queue;
    c.lineWidth = 2.5;
    this._rr(x, y + 16, w, h - 16, 8);
    c.stroke();
    const fillH = frac * (h - 50);
    if (fillH > 2) {
      c.fillStyle = withAlpha(C.queue, 0.45);
      this._rr(x + 6, y + h - 20 - fillH, w - 12, fillH, 4);
      c.fill();
    }
    // leak drip at bottom center
    c.strokeStyle = C.accent;
    c.lineWidth = 2;
    const cx = x + w / 2;
    c.beginPath();
    c.moveTo(cx, y + h - 8);
    c.lineTo(cx, y + h + 14);
    c.stroke();
    c.beginPath();
    c.arc(cx, y + h + 18, 4, 0, Math.PI * 2);
    c.fillStyle = C.accent;
    c.fill();
    this.text(x + w / 2, y + h + 36, `${label}: ${level.toFixed(1)} / ${cap}`, { size: 13, align: "center", mono: true, weight: 600, color: C.ink });
    if (leakRate != null) this.text(x + w / 2, y + h + 52, `leak ${leakRate}/s (fixed)`, { size: 10, align: "center", color: C.muted });
    c.restore();
  }

  /** Connection pool — grid of slots. */
  poolGrid(x, y, w, h, inUse, max, opts = {}) {
    const c = this.ctx;
    const { label = "Connection pool" } = opts;
    const cols = Math.min(max, 8);
    const rows = Math.ceil(max / cols);
    const pad = 8;
    const slotW = (w - pad * 2) / cols - 4;
    const slotH = Math.min(28, (h - 40) / rows - 4);
    c.save();
    this.text(x + w / 2, y + 14, label, { size: 12, align: "center", weight: 600, color: C.muted });
    let idx = 0;
    for (let r = 0; r < rows && idx < max; r++) {
      for (let col = 0; col < cols && idx < max; col++, idx++) {
        const sx = x + pad + col * (slotW + 4);
        const sy = y + 28 + r * (slotH + 4);
        const busy = idx < inUse;
        this._rr(sx, sy, slotW, slotH, 4);
        c.fillStyle = busy ? withAlpha(C.err, 0.35) : withAlpha(C.ok, 0.2);
        c.fill();
        c.strokeStyle = busy ? C.err : C.ok;
        c.lineWidth = 1.2;
        c.stroke();
      }
    }
    this.text(x + w / 2, y + h - 8, `${inUse} / ${max} in use`, { size: 12, align: "center", mono: true, color: inUse >= max ? C.err : C.ok });
    c.restore();
  }

  /** Queue depth meter (vertical bar). */
  queueMeter(x, y, w, h, depth, max, opts = {}) {
    const c = this.ctx;
    const { label = "Queue depth" } = opts;
    const frac = clamp(depth / Math.max(1, max));
    c.save();
    this._rr(x, y, w, h, 8);
    c.fillStyle = "#0f1524";
    c.fill();
    c.strokeStyle = C.panelLine;
    c.stroke();
    const fillH = frac * (h - 24);
    if (fillH > 0) {
      c.fillStyle = frac > 0.8 ? C.err : frac > 0.5 ? C.warn : C.accent;
      this._rr(x + 8, y + h - 12 - fillH, w - 16, fillH, 4);
      c.fill();
    }
    this.text(x + w / 2, y + 16, label, { size: 11, align: "center", color: C.muted, weight: 600 });
    this.text(x + w / 2, y + h / 2 + 4, String(Math.round(depth)), { size: 22, align: "center", mono: true, weight: 700, color: C.ink });
    c.restore();
  }

  /** Code snippet panel with highlighted line. */
  codePanel(x, y, w, h, lines, highlightLine = -1) {
    const c = this.ctx;
    c.save();
    this._rr(x, y, w, h, 6);
    c.fillStyle = "#0a0e14";
    c.fill();
    c.strokeStyle = C.panelLine;
    c.lineWidth = 1;
    c.stroke();
    lines.forEach((line, i) => {
      const ly = y + 18 + i * 16;
      if (i === highlightLine) {
        c.fillStyle = withAlpha(C.accent, 0.15);
        c.fillRect(x + 4, ly - 11, w - 8, 16);
      }
      this.text(x + 10, ly, line, { size: 11, mono: true, color: i === highlightLine ? C.accent : C.muted });
    });
    c.restore();
  }

  /** Simple UML class box. */
  umlClass(x, y, w, cls) {
    const c = this.ctx;
    const headerH = 28;
    const fieldH = (cls.fields?.length || 0) * 16;
    const methodH = (cls.methods?.length || 0) * 16;
    const totalH = headerH + fieldH + methodH + 8;
    c.save();
    this._rr(x, y, w, totalH, 4);
    c.fillStyle = C.panel;
    c.fill();
    c.strokeStyle = cls.stroke || C.accent;
    c.lineWidth = 1.5;
    c.stroke();
    this.text(x + w / 2, y + 18, cls.name, { size: 12, align: "center", weight: 700, color: C.ink });
    c.strokeStyle = C.panelLine;
    c.beginPath();
    c.moveTo(x, y + headerH);
    c.lineTo(x + w, y + headerH);
    c.stroke();
    let cy = y + headerH + 14;
    (cls.fields || []).forEach((f) => {
      this.text(x + 8, cy, f, { size: 10, mono: true, color: C.muted });
      cy += 16;
    });
    if (cls.methods?.length) {
      c.beginPath();
      c.moveTo(x, cy - 6);
      c.lineTo(x + w, cy - 6);
      c.stroke();
    }
    (cls.methods || []).forEach((m) => {
      this.text(x + 8, cy, m, { size: 10, mono: true, color: C.ink });
      cy += 16;
    });
    c.restore();
    return { h: totalH };
  }
}
