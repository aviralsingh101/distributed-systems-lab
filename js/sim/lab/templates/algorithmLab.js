/**
 * Algorithm lab — click keys/operations; visualize data structure (LRU, hash ring).
 */
import { mountLab } from "../mountLab.js";
import { C } from "../../primitives.js";

export function algorithmLab(stage, panel, stageEl, cfg) {
  return mountLab(stage, panel, stageEl, {
    note: cfg.note,
    params: cfg.params || [],
    init(ctx) {
      if (cfg.init) cfg.init(ctx);
    },
    actions: cfg.actions || [],
    frame(ctx, t, dt) {
      ctx.d.grid();
      if (cfg.draw) cfg.draw(ctx, ctx.d, t, dt);
    },
    status: cfg.status || (() => ({ text: "", cls: "" })),
  });
}
