import { mountSimulation } from "../controls.js";
import { C } from "../primitives.js";

/** State machine: states[] with positions, transitions driven by time or toggle. */
export function stateMachineTemplate(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles,
    params: cfg.params,
    frame(ctx, t) {
      const d = ctx.d;
      const states = cfg.states(ctx);
      const cur = cfg.currentState ? cfg.currentState(ctx, t) : states[Math.floor((t * 0.4) % states.length)].id;

      states.forEach((s) => {
        const on = s.id === cur;
        d.node(s.x - 70, s.y - 28, 140, 56, {
          title: s.label, color: s.color || C.service, active: on,
          state: on ? (s.bad ? "err" : s.good ? "ok" : "") : "",
        });
      });

      (cfg.transitions || []).forEach((tr) => {
        const a = states.find((s) => s.id === tr.from);
        const b = states.find((s) => s.id === tr.to);
        if (a && b) d.arrow(a.x, a.y + 28, b.x, b.y - 28, { color: C.faint, width: 1.2, dashed: true, label: tr.label });
      });

      if (cfg.status) { const st = cfg.status(ctx, t); if (st) ctx.setStatus(st.text, st.cls); }
    },
  });
}
