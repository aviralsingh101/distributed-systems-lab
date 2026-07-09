/**
 * Verify interactive sim behavior against specs.
 * Run: node scripts/verify-sim-behavior.mjs [--id topic-id]
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mountTopicSim, setToggle, setParam, setSelect, tickSim, getStatusText, getStatusClass } from "./lib/sim-behavior-driver.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPECS_PATH = join(ROOT, "scripts", "sim-behavior-specs.json");

if (!existsSync(SPECS_PATH)) {
  console.error("Missing sim-behavior-specs.json");
  process.exit(1);
}

const specs = JSON.parse(readFileSync(SPECS_PATH, "utf8"));
const idFilter = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];

let errors = 0;
const topics = idFilter ? [idFilter] : Object.keys(specs.topics);

for (const topicId of topics) {
  const topicSpec = specs.topics[topicId];
  if (!topicSpec?.cases?.length) continue;

  for (const [i, spec] of topicSpec.cases.entries()) {
    const { handle, stage, stageEl, ctx } = await mountTopicSim(topicId);
    if (!ctx) {
      console.error(`FAIL ${topicId}[${i}]: no ctx`);
      errors++;
      continue;
    }

    try {
      for (const [k, v] of Object.entries(spec.setup?.toggles || {})) setToggle(ctx, k, v);
      for (const [k, v] of Object.entries(spec.setup?.params || {})) setParam(ctx, k, v);
      for (const [k, v] of Object.entries(spec.setup?.selects || {})) setSelect(ctx, k, v);

      if (spec.action) {
        const act = handle.actions?.find((a) => a.id === spec.action);
        if (!act) {
          console.error(`FAIL ${topicId}[${i}]: action ${spec.action} not found`);
          errors++;
          continue;
        }
        act.onClick();
      }

      if (spec.actions) {
        for (const actId of spec.actions) {
          const act = handle.actions?.find((a) => a.id === actId);
          if (act) act.onClick();
        }
      }

      tickSim(stage, ctx, spec.tickSeconds ?? 3);

      const exp = spec.expect || {};
      let failed = false;
      if (exp.lastTarget !== undefined && ctx.state.lastTarget !== exp.lastTarget) {
        console.error(`FAIL ${topicId}[${i}] lastTarget: expected ${exp.lastTarget}, got ${ctx.state.lastTarget}`);
        failed = true;
      }
      if (exp.state) {
        for (const [k, v] of Object.entries(exp.state)) {
          if (ctx.state[k] !== v) {
            console.error(`FAIL ${topicId}[${i}] state.${k}: expected ${v}, got ${ctx.state[k]}`);
            failed = true;
          }
        }
      }
      if (exp.statusIncludes) {
        const text = getStatusText(stageEl);
        if (!text.includes(exp.statusIncludes)) {
          console.error(`FAIL ${topicId}[${i}] status: expected includes "${exp.statusIncludes}", got "${text}"`);
          failed = true;
        }
      }
      if (exp.statusCls) {
        const cls = getStatusClass(stageEl);
        if (cls !== exp.statusCls) {
          console.error(`FAIL ${topicId}[${i}] statusCls: expected ${exp.statusCls}, got ${cls}`);
          failed = true;
        }
      }
      if (exp.tokensGte !== undefined && (ctx.state.tokens ?? 0) < exp.tokensGte) {
        console.error(`FAIL ${topicId}[${i}] tokens: expected >= ${exp.tokensGte}, got ${ctx.state.tokens}`);
        failed = true;
      }
      if (exp.acceptedGte !== undefined && (ctx.state.accepted ?? 0) < exp.acceptedGte) {
        console.error(`FAIL ${topicId}[${i}] accepted: expected >= ${exp.acceptedGte}, got ${ctx.state.accepted}`);
        failed = true;
      }
      if (exp.amplificationGte !== undefined && (ctx.state.amplification ?? 0) < exp.amplificationGte) {
        console.error(`FAIL ${topicId}[${i}] amplification: expected >= ${exp.amplificationGte}, got ${ctx.state.amplification}`);
        failed = true;
      }
      if (exp.droppedGte !== undefined && (ctx.state.dropped ?? 0) < exp.droppedGte) {
        console.error(`FAIL ${topicId}[${i}] dropped: expected >= ${exp.droppedGte}, got ${ctx.state.dropped}`);
        failed = true;
      }
      if (failed) errors++;
    } finally {
      handle?.dispose?.();
      stage.dispose();
    }
  }
}

if (errors) {
  console.error(`\n${errors} behavior test failure(s)`);
  process.exit(1);
}
console.log(`Behavior verification passed: ${topics.length} topic(s), ${topics.reduce((n, id) => n + (specs.topics[id]?.cases?.length || 0), 0)} cases`);
