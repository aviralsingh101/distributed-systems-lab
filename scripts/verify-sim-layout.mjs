/**
 * Visual layout verification for interactive labs.
 * Mounts each sim, ticks frames, detects meaningful canvas element overlaps.
 * Run: node scripts/verify-sim-layout.mjs [--id topic-id]
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mountTopicSim, tickSim } from "./lib/sim-behavior-driver.mjs";
import { STAGE_H, STAGE_W } from "../js/sim/lab/layout.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const interactive = JSON.parse(readFileSync(join(ROOT, "scripts", "interactive-topics.json"), "utf8"));
const allIds = Object.values(interactive).flat();
const idFilter = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];
const topics = idFilter ? [idFilter] : allIds;

const EXPLAINER_ZONE = null; // reserved for queue-lab DOM overlay — not tracked on canvas
const PAD = 6;
const MIN_OVERLAP = 120;

function area(a) {
  return Math.max(0, a.w) * Math.max(0, a.h);
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function centerIn(inner, outer) {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return cx >= outer.x && cx <= outer.x + outer.w && cy >= outer.y && cy <= outer.y + outer.h;
}

function isInternalLabel(text, solid) {
  return text.kind === "text" && ["box", "db", "counter", "bucket", "badge"].includes(solid.kind) && centerIn(text, solid);
}

function findOverlaps(bounds) {
  const issues = [];
  const solids = bounds.filter((b) => ["box", "db", "counter", "bucket", "badge"].includes(b.kind));

  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      const oa = overlapArea(a, b);
      if (oa >= MIN_OVERLAP) {
        issues.push(`${a.kind}[${a.meta}] overlaps ${b.kind}[${b.meta}] (${Math.round(oa)}px²)`);
      }
    }
  }

  for (const b of bounds) {
    if (b.kind === "text") {
      for (const box of solids) {
        if (isInternalLabel(b, box)) continue;
        if (overlapArea(b, box) >= MIN_OVERLAP) {
          issues.push(`text[${b.meta}] overlaps ${box.kind}[${box.meta}]`);
        }
      }
    }
    if (b.y + b.h > STAGE_H + 2 && b.kind === "badge") {
      issues.push(`badge[${b.meta}] below stage (${Math.round(b.y + b.h)}px)`);
    }
    if (b.x + b.w > STAGE_W + 2 || b.x < -2) {
      issues.push(`${b.kind}[${b.meta}] off horizontal stage`);
    }
    if (EXPLAINER_ZONE && overlapArea(b, EXPLAINER_ZONE) >= MIN_OVERLAP && b.y < EXPLAINER_ZONE.y - 24 && b.kind === "box" && b.y + b.h > 450) {
      issues.push(`${b.kind}[${b.meta}] overlaps explainer bar`);
    }
  }

  return [...new Set(issues)];
}

let errors = 0;

for (const topicId of topics) {
  try {
    const { handle, stage, ctx } = await mountTopicSim(topicId);
    if (!ctx) {
      console.error(`FAIL ${topicId}: no ctx`);
      errors++;
      continue;
    }

    const act = handle.actions?.[0];
    if (act) act.onClick();

    const allIssues = new Set();
    for (let pass = 0; pass < 8; pass++) {
      tickSim(stage, ctx, 0.4);
      ctx.d.trackLayout = true;
      ctx.d.layoutBounds = [];
      stage._tick?.(0.05);
      ctx.d.trackLayout = false;
      for (const issue of findOverlaps(ctx.d.layoutBounds)) allIssues.add(issue);
    }

    const map = JSON.parse(readFileSync(join(ROOT, "scripts", "sim-map.json"), "utf8")).topics;
    const lab = map[topicId]?.lab;
    if (lab === "metrics" && (ctx.state.accepted ?? 0) < 1) {
      allIssues.add("metrics accepted counter not incrementing");
    }

    if (allIssues.size) {
      console.error(`FAIL ${topicId}:`);
      for (const issue of allIssues) console.error(`  - ${issue}`);
      errors++;
    }

    handle?.dispose?.();
    stage.dispose();
  } catch (e) {
    console.error(`FAIL ${topicId}: ${e.message}`);
    errors++;
  }
}

if (errors) {
  console.error(`\n${errors} layout verification failure(s)`);
  process.exit(1);
}
console.log(`Layout verification passed: ${topics.length} topic(s)`);
