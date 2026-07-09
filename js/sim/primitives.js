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
  constructor(stage) { this.s = stage; }
  get ctx() { return this.s.ctx; }
  get W() { return this.s.W; }
  get H() { return this.s.H; }

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
    const { size = 15, color = C.ink, align = "left", baseline = "middle", weight = 400, mono = false, alpha = 1 } = opts;
    c.save();
    c.globalAlpha = alpha;
    this.font(size, { weight, mono });
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = baseline;
    c.fillText(str, x, y);
    c.restore();
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
    if (title) this.text(cx, y + (value ? 22 : h / 2), title, { size: 14, weight: 700, align: "center", color: state === "dim" ? C.muted : C.ink });
    if (value) this.text(cx, y + h - 20, value, { size: 15, align: "center", mono: true, color: borderCol, weight: 600 });
    if (sub) this.text(cx, y + h - 20, sub, { size: 12, align: "center", color: C.muted });
    return { cx, cy: y + h / 2, x, y, w, h, top: y, bottom: y + h, left: x, right: x + w };
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
    this.text(x + w / 2, y + h * 0.52, title, { size: 13, weight: 700, align: "center" });
    if (value) this.text(x + w / 2, y + h * 0.52 + 20, value, { size: 14, align: "center", mono: true, color: col, weight: 600 });
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
      this.text(mx, my, label, { size: 12, align: "center", mono: true, color });
    }
    return { ex, ey };
  }

  /** A moving token (request / message / event). */
  token(x, y, opts = {}) {
    const c = this.ctx;
    const { r = 12, color = C.accent, label = "", glow = true, text = "" } = opts;
    c.save();
    if (glow) { c.shadowColor = withAlpha(color, 0.9); c.shadowBlur = 16; }
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color; c.fill();
    c.restore();
    if (text) this.text(x, y, text, { size: 10, align: "center", weight: 700, color: "#0b0f1a" });
    if (label) this.text(x, y - r - 9, label, { size: 11, align: "center", mono: true, color });
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
    if (label) this.text(x, y - 10, label, { size: 12, color: C.muted });
    if (value) this.text(x + w, y - 10, value, { size: 12, align: "right", mono: true, color });
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
    if (label) this.text(x + w / 2, yBottom + 16, label, { size: 12, align: "center", color: C.muted });
  }

  /** A small pill / badge. */
  badge(x, y, str, opts = {}) {
    const c = this.ctx;
    const { color = C.accent, filled = false, align = "left" } = opts;
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
  }

  /** Position along a straight path at p∈[0,1]. */
  along(x1, y1, x2, y2, p) { return { x: lerp(x1, x2, p), y: lerp(y1, y2, p) }; }
}
