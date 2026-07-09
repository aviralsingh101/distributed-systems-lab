import { mountSimulation } from "../controls.js";
import { C } from "../primitives.js";

/** Database schema tables side by side. tables:[{name, cols:[{name,pk?,fk?}]}] */
export function dataModelTemplate(stage, panel, stageEl, cfg) {
  return mountSimulation(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles,
    params: cfg.params,
    frame(ctx, t) {
      const d = ctx.d;
      const tables = cfg.tables(ctx);
      const tw = 880 / Math.max(1, tables.length);

      tables.forEach((tbl, i) => {
        const x = 60 + i * tw;
        const rows = tbl.cols.length;
        const h = 50 + rows * 28;
        d.db(x, 120, Math.min(220, tw - 20), h, { title: tbl.name, color: tbl.color || C.ledger, value: "" });
        tbl.cols.forEach((col, j) => {
          const yy = 168 + j * 28;
          const mark = col.pk ? "PK " : col.fk ? "FK " : "   ";
          d.text(x + 14, yy, mark + col.name, { size: 12, mono: true, color: col.pk ? C.warn : col.fk ? C.accent : C.muted });
        });
      });

      (cfg.relations || []).forEach((rel) => {
        const a = tables.findIndex((t) => t.name === rel.from);
        const b = tables.findIndex((t) => t.name === rel.to);
        if (a >= 0 && b >= 0) {
          d.arrow(60 + a * tw + 110, 120, 60 + b * tw + 110, 120, { color: C.accent, width: 1.5, dashed: true });
        }
      });

      if (cfg.status) { const st = cfg.status(ctx, t); if (st) ctx.setStatus(st.text, st.cls); }
    },
  });
}
