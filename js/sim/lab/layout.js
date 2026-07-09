/** Shared layout constants for interactive lab diagrams (1000×560 logical stage). */
export const STAGE_W = 1000;
export const STAGE_H = 560;
export const CONTENT_TOP = 56;
export const CONTENT_BOTTOM = 544;

/** Standard horizontal row of N nodes, evenly spaced. */
export function layoutRow(count, opts = {}) {
  const {
    y = 240,
    w = 130,
    h = 56,
    margin = 60,
    totalW = STAGE_W - margin * 2,
  } = opts;
  const gap = count > 1 ? (totalW - count * w) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: margin + i * (w + gap),
    y,
    w,
    h,
  }));
}

/** Metrics lab: bucket + counters left, chart right. */
export const METRICS_LAYOUT = {
  bucket: { x: 40, y: CONTENT_TOP + 12, w: 200, h: 148 },
  accepted: { x: 260, y: CONTENT_TOP + 12, w: 168, h: 68 },
  dropped: { x: 260, y: CONTENT_TOP + 88, w: 168, h: 68 },
  chart: { x: 460, y: CONTENT_TOP + 12, w: 520, h: 340 },
};

/** State machine nodes on a horizontal track. */
export function layoutStates(states, y = 220) {
  const positions = layoutRow(states.length, { y, w: 140, h: 64, margin: 80 });
  return states.map((s, i) => ({ ...s, ...positions[i] }));
}
