/**
 * Click-flow lab — ordered action buttons with animated request dots.
 */
import { mountLab } from "../mountLab.js";
import { C, clamp } from "../../primitives.js";

export function clickFlowLab(stage, panel, stageEl, cfg) {
  const components = cfg.components || [];
  const flows = cfg.flows || {};

  return mountLab(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles || [],
    params: cfg.params || [],
    init(ctx) {
      ctx.state.phase = "idle";
      ctx.state.anim = null;
      ctx.state.values = { ...(cfg.initialValues || {}) };
      if (cfg.init) cfg.init(ctx);
    },
    actions: (cfg.actions || []).map((a) => ({
      ...a,
      onClick(ctx) {
        if (a.disabled && a.disabled(ctx)) return;
        if (a.onClick) a.onClick(ctx);
        if (a.flowKey) {
          const flow = flows[a.flowKey];
          const steps = typeof flow === "function" ? flow(ctx) : flow;
          if (steps) runFlow(ctx, steps);
        }
      },
    })),
    frame(ctx, t, dt) {
      const d = ctx.d;
      d.grid();
      if (ctx.state.anim && dt > 0) {
        ctx.state.anim.p = clamp(ctx.state.anim.p + dt * 2);
        if (ctx.state.anim.p >= 1) {
          const onDone = ctx.state.anim.onDone;
          ctx.state.anim = null;
          if (onDone) onDone(ctx);
        }
      }

      components.forEach((c) => {
        const val = ctx.state.values[c.id] ?? c.value ?? "";
        const w = c.w || 130;
        const h = c.h || 56;
        d.component(c.x, c.y, w, h, { title: c.title, color: c.color || C.service, value: val, kind: c.kind, active: ctx.state.lastTarget === c.id });
      });

      if (ctx.state.anim) {
        const a = components.find((c) => c.id === ctx.state.anim.from);
        const b = components.find((c) => c.id === ctx.state.anim.to);
        if (a && b) {
          const p = ctx.state.anim.p;
          const pos = d.along(a.x + (a.w || 120) / 2, a.y + 25, b.x + (b.w || 120) / 2, b.y + 25, p);
          d.token(pos.x, pos.y, { r: 8, color: ctx.state.anim.color || C.accent, glow: true });
        }
      }

      if (cfg.draw) cfg.draw(ctx, d, t);
    },
    status: cfg.status || (() => ({ text: "", cls: "" })),
  });

  function runFlow(ctx, steps) {
    let i = 0;
    function next() {
      if (i >= steps.length) return;
      const s = steps[i++];
      ctx.state.anim = {
        from: s.from,
        to: s.to,
        p: 0,
        color: s.color,
        onDone: () => {
          if (s.set) Object.assign(ctx.state.values, s.set);
          ctx.state.lastTarget = s.to;
          if (s.onArrive) s.onArrive(ctx);
          next();
        },
      };
    }
    next();
  }
}
