/**
 * State explorer — click to advance phases (circuit breaker, 2PC, saga).
 */
import { mountLab } from "../mountLab.js";
import { C } from "../../primitives.js";
import { layoutStates } from "../layout.js";

export function stateExplorerLab(stage, panel, stageEl, cfg) {
  const rawStates = cfg.states || [
    { id: "closed", label: "Closed", x: 200, color: C.ok },
    { id: "open", label: "Open", x: 500, color: C.err },
    { id: "half", label: "Half-open", x: 800, color: C.warn },
  ];
  const states = rawStates.every((s) => s.x != null)
    ? rawStates
    : layoutStates(rawStates.map((s) => ({ ...s, w: 140, h: 64 })));
  const transitions = cfg.transitions || [];

  return mountLab(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles || [],
    params: cfg.params || [],
    init(ctx) {
      ctx.state.current = cfg.initialState || states[0].id;
      ctx.state.history = [];
      if (cfg.init) cfg.init(ctx);
    },
    actions: transitions.map((tr) => ({
      id: tr.id,
      label: tr.label,
      primary: tr.primary,
      onClick(ctx) {
        if (tr.from && ctx.state.current !== tr.from) return;
        const prev = ctx.state.current;
        if (tr.onClick) tr.onClick(ctx);
        if (ctx.state.current === prev && tr.to != null) ctx.state.current = tr.to;
        ctx.state.history.push(tr.label);
        if (tr.onTransition) tr.onTransition(ctx);
      },
    })),
    frame(ctx, t, dt) {
      const d = ctx.d;
      d.grid();

      // transition arrows between adjacent states
      for (let i = 0; i < states.length - 1; i++) {
        const a = states[i];
        const b = states[i + 1];
        const ax = (a.x ?? 0) + (a.w || 140);
        const bx = b.x ?? 0;
        const cy = (a.y ?? 220) + (a.h || 64) / 2;
        d.arrow(ax + 8, cy, bx - 8, cy, { color: C.faint, width: 1.5, head: true, alpha: 0.5 });
      }

      states.forEach((s) => {
        const x = s.x ?? 200;
        const y = s.y ?? 220;
        const w = s.w || 140;
        const h = s.h || 64;
        const peersAtSlot = states.filter((o) => (o.x ?? 200) === x && (o.y ?? 220) === y);
        if (peersAtSlot.length > 1 && ctx.state.current !== s.id) return;
        const active = ctx.state.current === s.id;
        d.node(x, y, w, h, {
          title: s.label,
          color: s.color,
          active,
          sub: s.desc || "",
        });
      });

      if (cfg.draw) cfg.draw(ctx, d, t, dt);
    },
    status(ctx) {
      if (cfg.status) return cfg.status(ctx);
      const cur = states.find((s) => s.id === ctx.state.current);
      return { text: cur ? `State: ${cur.label}` : "", cls: cur?.id === "open" || cur?.id === "aborted" || cur?.id === "comp" ? "err" : cur?.id === "closed" || cur?.id === "committed" ? "ok" : "warn" };
    },
  });
}
