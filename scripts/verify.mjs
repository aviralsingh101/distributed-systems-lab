/**
 * Verify registry integrity and topic module syntax.
 * Run: node scripts/verify.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
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
    if (!m.meta || !m.content) {
      console.error("INCOMPLETE EXPORTS:", t.id);
      errors++;
    }
  } catch (e) {
    console.error("IMPORT FAIL:", t.id, e.message);
    errors++;
  }
}

if (errors) { console.error(`\n${errors} error(s)`); process.exit(1); }

try {
  const figUrl = new URL("./verify-figures.mjs", import.meta.url).href;
  await import(figUrl);
} catch (e) {
  console.error("FIGURE VERIFY FAIL:", e.message);
  process.exit(1);
}

try {
  const simQUrl = new URL("./verify-sim-quality.mjs", import.meta.url).href;
  await import(simQUrl);
} catch (e) {
  console.error("SIM QUALITY FAIL:", e.message);
  process.exit(1);
}

try {
  const simBehUrl = new URL("./verify-sim-behavior.mjs", import.meta.url).href;
  await import(simBehUrl);
} catch (e) {
  console.error("SIM BEHAVIOR FAIL:", e.message);
  process.exit(1);
}

try {
  const contentMapUrl = new URL("./verify-content-map.mjs", import.meta.url).href;
  await import(contentMapUrl);
} catch (e) {
  console.error("CONTENT MAP VERIFY FAIL:", e.message);
  process.exit(1);
}

try {
  const simLayoutUrl = new URL("./verify-sim-layout.mjs", import.meta.url).href;
  await import(simLayoutUrl);
} catch (e) {
  console.error("SIM LAYOUT FAIL:", e.message);
  process.exit(1);
}

try {
  const qual = spawnSync(process.execPath, ["scripts/verify-content-quality.mjs", "--track=hld", "--gold-only"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (qual.stdout) process.stdout.write(qual.stdout);
  if (qual.status !== 0) {
    if (qual.stderr) process.stderr.write(qual.stderr);
    process.exit(1);
  }
} catch (e) {
  console.error("CONTENT QUALITY FAIL:", e.message);
  process.exit(1);
}

console.log("All checks passed.");
