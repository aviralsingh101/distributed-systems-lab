import { mountSimulation } from "../controls.js";
import { C, clamp } from "../primitives.js";

/** Linear pipeline stages with fill/progress. stages:[{title,color}] */
export function pipelineTemplate(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles,
    params: cfg.params,
    frame(ctx, t) {
      const d = ctx.d;
      const stages = cfg.stages(ctx);
      const n = stages.length;
      const gap = 820 / Math.max(1, n);
      const x0 = 90;
      const activeIdx = cfg.activeIndex ? cfg.activeIndex(ctx, t) : Math.floor((t * 0.5) % n);

      stages.forEach((s, i) => {
        const x = x0 + i * gap;
        const on = i <= activeIdx;
        d.node(x, 220, Math.min(140, gap - 16), 64, {
          title: s.title, color: s.color || C.service, active: i === activeIdx,
          state: on ? "ok" : "", value: s.value || "",
        });
        if (i < n - 1) {
          const prog = i < activeIdx ? 1 : i === activeIdx ? clamp((t * 0.5) % 1) : 0;
          d.arrow(x + 70, 252, x + gap - 70, 252, { color: prog > 0 ? C.accent : C.faint, width: prog > 0 ? 2 : 1 });
          if (prog > 0 && prog < 1) {
            const pt = d.along(x + 70, 252, x + gap - 70, 252, prog);
            d.token(pt.x, pt.y, { r: 7, color: C.queue });
          }
        }
      });

      if (cfg.status) { const st = cfg.status(ctx, t); if (st) ctx.setStatus(st.text, st.cls); }
    },
  });
}
