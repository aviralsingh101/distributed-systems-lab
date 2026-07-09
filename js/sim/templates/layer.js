import { mountSimulation } from "../controls.js";
import { C } from "../primitives.js";

/** Layered architecture — horizontal bands with components. */
export function layerTemplate(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles,
    frame(ctx, t) {
      const d = ctx.d;
      const layers = cfg.layers(ctx);
      const lh = 380 / layers.length;

      layers.forEach((layer, i) => {
        const y = 100 + i * lh;
        d.ctx.save();
        d.ctx.fillStyle = "rgba(91,157,255,0.06)";
        d._rr(60, y, 880, lh - 8, 8);
        d.ctx.fill();
        d.ctx.restore();
        d.text(80, y + 18, layer.name, { size: 12, color: C.muted, weight: 600 });

        const comps = layer.components || [];
        const cw = 760 / Math.max(1, comps.length);
        comps.forEach((c, j) => {
          const x = 140 + j * cw;
          d.node(x, y + 30, Math.min(160, cw - 12), 48, {
            title: c.title, color: c.color || C.service, active: c.active,
            value: c.value || "",
          });
        });
      });

      if (cfg.status) { const st = cfg.status(ctx, t); if (st) ctx.setStatus(st.text, st.cls); }
    },
  });
}
