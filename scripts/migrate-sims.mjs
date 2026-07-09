/**
 * Migrate topic simulations to lab registry.
 * Run: node scripts/migrate-sims.mjs [--wave gold|failures|hld|lld] [--id topic-id]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "scripts", "sim-map.json");

function depthToRegistry(modulePath) {
  const parts = modulePath.replace(/^\.\//, "").split("/");
  const depth = parts.length - 1;
  return "../".repeat(depth) + "sim/lab/registry.js";
}

function replaceCreateSimulation(raw, topicId, registryImport) {
  if (raw.includes("@sim-handcrafted") || raw.includes("@sim-gold")) return raw;

  const importLine = `import { createTopicSim } from "${registryImport}";`;
  let updated = raw;

  if (!updated.includes("createTopicSim")) {
    const firstImport = updated.match(/^import .+$/m);
    if (firstImport) {
      updated = updated.replace(firstImport[0], firstImport[0] + "\n" + importLine);
    } else {
      updated = importLine + "\n" + updated;
    }
  }

  const newSim = `
export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("${topicId}", stage, panel, stageEl);
}`;

  if (updated.includes("export function createSimulation")) {
    updated = updated.replace(
      /export function createSimulation\([^)]*\)\s*\{[\s\S]*?\n\}/,
      newSim.trim(),
    );
  } else if (updated.includes("export function createSimulation(stage, panel, stageEl)")) {
    updated = updated.replace(/export function createSimulation[\s\S]*$/, newSim.trim());
  } else {
    updated = updated.trimEnd() + "\n" + newSim;
  }

  if (!updated.includes("@sim-lab")) {
    updated = updated.replace(/^(\/\/ @article-v2\n)?/, (m) => (m || "") + "// @sim-lab\n");
  }

  return updated;
}

function topicInWave(topic, wave) {
  if (!wave) return true;
  if (wave === "gold") {
    return ["token-bucket", "leaky-bucket", "read-your-writes", "dead-letter-queue",
      "lost-update", "transactional-outbox", "circuit-breaker", "lru-cache", "dns"].includes(topic.id);
  }
  if (wave === "failures") return topic.track === "failures";
  if (wave === "hld") return topic.track === "hld";
  if (wave === "lld") return topic.track === "lld";
  return topic.category.id === wave;
}

const wave = process.argv.find((a) => a.startsWith("--wave="))?.split("=")[1];
const idFilter = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];

if (!existsSync(MAP_PATH)) {
  console.error("Run: node scripts/gen-sim-map.mjs first");
  process.exit(1);
}

let updated = 0, skipped = 0;

for (const entry of FLAT_TOPICS) {
  if (idFilter && entry.id !== idFilter) continue;
  if (wave && !topicInWave(entry, wave)) continue;

  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) continue;

  const raw = readFileSync(path, "utf8");
  if (raw.includes("@sim-handcrafted")) { skipped++; continue; }

  const registryImport = depthToRegistry(entry.module.replace(/^\.\//, ""));
  const next = replaceCreateSimulation(raw, entry.id, registryImport);
  if (next === raw) { skipped++; continue; }

  writeFileSync(path, next, "utf8");
  updated++;
  console.log("OK:", entry.id);
}

console.log(`Done: ${updated} updated, ${skipped} skipped`);
