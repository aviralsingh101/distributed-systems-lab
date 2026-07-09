import { sequenceSim } from "../sequence.js";

/** Declarative flow diagram — wraps sequenceSim. */
export function flowTemplate(stage, panel, stageEl, cfg) {
  return sequenceSim(stage, panel, stageEl, cfg);
}
