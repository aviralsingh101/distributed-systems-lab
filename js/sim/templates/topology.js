import { mountSimulation } from "../controls.js";
import { C } from "../primitives.js";

/**
 * Service topology: nodes[] with optional hub, edges[], animated token along active edge.
 * cfg = { note, toggles?, nodes:[{id,x,y,title,color,value?}], edges:[{from,to,label?}], activeEdge? }
 */
export function topologyTemplate(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles,
    params: cfg.params,
    frame(ctx, t) {
      const d = ctx.d;
      const nodes = cfg.nodes(ctx);
      const edges = cfg.edges ? cfg.edges(ctx) : [];
      const pos = {};
      nodes.forEach((n) => (pos[n.id] = { x: n.x, y: n.y }));

      edges.forEach((e) => {
        const a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        const active = e.active;
        d.arrow(a.x, a.y, b.x, b.y, {
          color: active ? (e.color || C.accent) : C.faint,
          width: active ? 2.5 : 1.2,
          alpha: active ? 1 : 0.3,
          label: e.label,
        });
      });

      const active = cfg.activeEdge ? cfg.activeEdge(ctx, t) : null;
      if (active && pos[active.from] && pos[active.to]) {
        const p = (t * 0.8) % 1;
        const a = pos[active.from], b = pos[active.to];
        const pt = d.along(a.x, a.y, b.x, b.y, p);
        d.token(pt.x, pt.y, { r: 9, color: C.accent, glow: true });
      }

      nodes.forEach((n) => {
        d.node(n.x - 84, n.y - 34, 168, 68, {
          title: n.title, color: n.color || C.service, value: n.value || "",
          active: n.active, state: n.state || "",
        });
      });

      if (cfg.status) {
        const st = cfg.status(ctx, t);
        if (st) ctx.setStatus(st.text, st.cls);
      }
    },
  });
}
