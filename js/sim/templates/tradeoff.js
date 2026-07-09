import { mountSimulation } from "../controls.js";
import { C } from "../primitives.js";

/** Side-by-side A vs B architecture comparison with toggle. */
export function tradeoffTemplate(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note,
    toggles: [{ key: "pickB", label: cfg.toggleLabel || "Switch to alternative", kind: "ok", value: false }, ...(cfg.toggles || [])],
    frame(ctx, t) {
      const d = ctx.d;
      const useB = ctx.toggles.pickB;
      const side = useB ? cfg.sideB(ctx) : cfg.sideA(ctx);

      d.text(280, 80, cfg.labelA || "Option A", { size: 14, align: "center", color: useB ? C.muted : C.accent, weight: 700 });
      d.text(720, 80, cfg.labelB || "Option B", { size: 14, align: "center", color: useB ? C.accent : C.muted, weight: 700 });

      const drawSide = (nodes, cx, dim) => {
        nodes.forEach((n, i) => {
          const y = 160 + i * 90;
          d.node(cx - 100, y, 200, 56, {
            title: n.title, color: dim ? C.faint : (n.color || C.service),
            value: n.value || "", active: !dim && n.active,
          });
          if (i < nodes.length - 1) d.arrow(cx, y + 56, cx, y + 90 - 8, { color: dim ? C.faint : C.accent, width: dim ? 1 : 2 });
        });
      };

      drawSide(cfg.sideA(ctx).nodes, 280, useB);
      drawSide(cfg.sideB(ctx).nodes, 720, !useB);

      if (cfg.status) { const st = cfg.status(ctx, t, useB); if (st) ctx.setStatus(st.text, st.cls); }
    },
  });
}
