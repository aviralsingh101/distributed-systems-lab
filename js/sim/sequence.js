import { C, clamp, lerp, ease, withAlpha } from "./primitives.js";
import { mountSimulation } from "./controls.js";

/**
 * Convenience wrapper for topics whose diagram is a component-interaction flow.
 * The topic supplies scenario(ctx) → { actors, steps, stepDur, status(result) }.
 * (Historically these were sequence diagrams; the renderer now draws a spatial
 * component diagram with the request actually moving between components.)
 */
export function sequenceSim(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note, params: cfg.params, toggles: cfg.toggles, selects: cfg.selects, speed: cfg.speed,
    build(ctx) { ctx.state.s = cfg.scenario(ctx); },
    frame(ctx, t) {
      const r = drawFlow(ctx.d, t, ctx.state.s);
      const st = ctx.state.s.status ? ctx.state.s.status(r) : null;
      if (st) ctx.setStatus(st.text, st.cls);
    },
  });
}

// Backwards-compatible alias (topics import drawSequence in a few places).
export const drawSequence = drawFlow;

/**
 * Component-interaction diagram. Components are boxes laid out spatially (the
 * busiest one — usually the shared DB / coordinator — sits in the centre). The
 * scenario's ordered steps play on a loop: for each step a request token travels
 * along the connection from → to, and component values update as it lands. This
 * shows "how the request actually flows between components" rather than an
 * abstract sequence chart.
 *
 * spec = {
 *   actors: [{ id, label, color, kind:'actor'|'db', value }],
 *   steps:  [{ from, to, label, self, bad, good, dashed, drop, set:{ id:'v' } }],
 *   stepDur
 * }
 */
export function drawFlow(d, t, spec) {
  const ctx = d.ctx;
  const actors = spec.actors;
  const steps = spec.steps;
  const stepDur = spec.stepDur || 1.35;
  const holdDur = 1.8;
  const total = steps.length * stepDur + holdDur;
  const local = t % total;
  let cur = Math.floor(local / stepDur);
  const inHold = cur >= steps.length;
  if (inHold) cur = steps.length - 1;
  const prog = inHold ? 1 : ease.inOut(clamp((local - Math.floor(local / stepDur) * stepDur) / (stepDur * 0.82)));

  // ---------- layout: busiest component in the centre ----------
  const deg = {};
  actors.forEach((a) => (deg[a.id] = 0));
  steps.forEach((s) => { deg[s.from] = (deg[s.from] || 0) + 1; if (s.to !== s.from) deg[s.to] = (deg[s.to] || 0) + 1; });
  let hub = actors[0].id, best = -1;
  actors.forEach((a) => { if (deg[a.id] > best) { best = deg[a.id]; hub = a.id; } });

  const cx = 500, cy = 315;
  const pos = { [hub]: { x: cx, y: cy } };
  const others = actors.filter((a) => a.id !== hub).map((a) => a.id);
  const slots = {
    1: [{ x: 190, y: cy }],
    2: [{ x: 175, y: cy }, { x: 825, y: cy }],
    3: [{ x: 175, y: cy }, { x: 825, y: cy }, { x: cx, y: 120 }],
    4: [{ x: 175, y: 250 }, { x: 825, y: 250 }, { x: 260, y: 120 }, { x: 740, y: 120 }],
  }[Math.min(4, others.length)] || [];
  others.forEach((id, i) => (pos[id] = slots[i] || { x: 175 + i * 220, y: 120 }));

  // ---------- accumulate component values up to now ----------
  const values = {};
  actors.forEach((a) => (values[a.id] = a.value ?? ""));
  for (let i = 0; i < steps.length; i++) {
    const applied = i < cur || inHold || (i === cur && prog > 0.82);
    if (applied && steps[i].set) Object.assign(values, steps[i].set);
  }

  const step = steps[cur] || {};
  const col = step.bad ? C.err : step.good ? C.ok : C.accent;

  // ---------- edges (unique connection pairs used by the scenario) ----------
  const drawn = new Set();
  steps.forEach((s) => {
    if (s.from === s.to) return;
    const key = [s.from, s.to].sort().join("|");
    if (drawn.has(key)) return; drawn.add(key);
    const a = pos[s.from], b = pos[s.to];
    ctx.save();
    ctx.strokeStyle = C.panelLine; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  });

  // ---------- active connection highlight + travelling request ----------
  const activeFrom = pos[step.from], activeTo = pos[step.to];
  if (!inHold && activeFrom && activeTo) {
    if (step.self || step.from === step.to) {
      // self-action: a small orbit loop on the component
      const p = activeFrom;
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(p.x + 96, p.y - 30, 22, -Math.PI * 0.5, -Math.PI * 0.5 + prog * Math.PI * 1.6); ctx.stroke(); ctx.restore();
      d.token(p.x + 96 + Math.cos(-Math.PI * 0.5 + prog * Math.PI * 1.6) * 22, p.y - 30 + Math.sin(-Math.PI * 0.5 + prog * Math.PI * 1.6) * 22, { r: 8, color: col });
    } else {
      // highlight edge
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3;
      if (step.dashed || step.drop) ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.moveTo(activeFrom.x, activeFrom.y); ctx.lineTo(activeTo.x, activeTo.y); ctx.stroke(); ctx.restore();
      // arrowhead near destination
      const ang = Math.atan2(activeTo.y - activeFrom.y, activeTo.x - activeFrom.x);
      const hx = lerp(activeFrom.x, activeTo.x, 0.86), hy = lerp(activeFrom.y, activeTo.y, 0.86);
      ctx.save(); ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 12 * Math.cos(ang - 0.4), hy - 12 * Math.sin(ang - 0.4)); ctx.lineTo(hx - 12 * Math.cos(ang + 0.4), hy - 12 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); ctx.restore();
      // travelling token (stops at the cross if dropped)
      const tp = step.drop ? Math.min(prog, 0.5) : prog;
      const rx = lerp(activeFrom.x, activeTo.x, tp), ry = lerp(activeFrom.y, activeTo.y, tp);
      if (step.drop && prog > 0.5) d.text(rx, ry, "✕", { size: 20, align: "center", weight: 700, color: C.err });
      else d.token(rx, ry, { r: 9, color: col });
    }
  }

  // ---------- components ----------
  actors.forEach((a) => {
    const p = pos[a.id];
    const active = !inHold && (a.id === step.from || a.id === step.to);
    const w = 168, h = 68, bx = p.x - w / 2, by = p.y - h / 2;
    const state = active ? (step.bad ? "err" : step.good ? "ok" : "") : "";
    if (a.kind === "db") d.db(bx, by, w, h, { title: a.label, value: values[a.id], color: a.color, state, active });
    else d.node(bx, by, w, h, { title: a.label, value: values[a.id], color: a.color, state, active });
  });

  // ---------- caption + step progress ----------
  if (step.label) {
    const label = (inHold ? "" : `${cur + 1}/${steps.length}  ·  `) + step.label;
    d.text(cx, 508, label, { size: 14, align: "center", mono: true, color: inHold ? C.muted : col });
  }
  const dotY = 536, gap = 16, x0 = cx - ((steps.length - 1) * gap) / 2;
  steps.forEach((s, i) => {
    const on = inHold || i <= cur;
    d.ctx.save(); d.ctx.beginPath(); d.ctx.arc(x0 + i * gap, dotY, 4, 0, Math.PI * 2);
    d.ctx.fillStyle = on ? (steps[i].bad ? C.err : steps[i].good ? C.ok : C.accent) : C.panelLine; d.ctx.fill(); d.ctx.restore();
  });

  return { activeStep: cur, values, done: inHold };
}
