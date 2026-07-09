/**
 * Verify registry integrity and topic module syntax.
 * Run: node scripts/verify.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS, TOPIC_COUNT, FAILURES_COUNT, HLD_COUNT, LLD_COUNT } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let errors = 0;
const ids = new Set();

for (const t of FLAT_TOPICS) {
  if (ids.has(t.id)) { console.error("DUPLICATE ID:", t.id); errors++; }
  ids.add(t.id);
  const path = join(ROOT, "js", t.module.replace(/^\.\//, ""));
  if (!existsSync(path)) { console.error("MISSING:", path); errors++; }
}

console.log(`Topics: ${TOPIC_COUNT} (failures ${FAILURES_COUNT}, hld ${HLD_COUNT}, lld ${LLD_COUNT})`);

// Spot-check imports across tracks
const samples = [
  FLAT_TOPICS[0],
  FLAT_TOPICS.find((t) => t.id === "transactional-outbox"),
  FLAT_TOPICS.find((t) => t.id === "api-gateway"),
  FLAT_TOPICS.find((t) => t.id === "singleton"),
  FLAT_TOPICS[FLAT_TOPICS.length - 1],
].filter(Boolean);

for (const t of samples) {
  try {
    const modUrl = new URL(`../js/${t.module.replace(/^\.\//, "")}`, import.meta.url).href;
    const m = await import(modUrl);
    if (!m.meta || !m.content || !m.createSimulation) {
      console.error("INCOMPLETE EXPORTS:", t.id);
      errors++;
    }
  } catch (e) {
    console.error("IMPORT FAIL:", t.id, e.message);
    errors++;
  }
}

if (errors) { console.error(`\n${errors} error(s)`); process.exit(1); }
console.log("All checks passed.");
