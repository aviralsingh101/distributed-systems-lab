/**
 * Verify simulation quality against lab standards.
 * Run: node scripts/verify-sim-quality.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "scripts", "sim-map.json");

if (!existsSync(MAP_PATH)) {
  console.error("Missing sim-map.json — run: node scripts/gen-sim-map.mjs");
  process.exit(1);
}

const simMap = JSON.parse(readFileSync(MAP_PATH, "utf8"));
let errors = 0;
const GENERIC_PATH = /Client.*Order.*Gateway|payment request path/i;
const FORBIDDEN_TRANSPORT = /playBtn|Step.*Reset|mountSimulation\(stage, panel, stageEl,\s*\{[^}]*autoplay/s;

const INTERACTIVE_LABS = new Set(["metrics", "race", "queue", "clickFlow", "state", "algorithm", "architecture"]);

for (const entry of FLAT_TOPICS) {
  const mapEntry = simMap.topics[entry.id];
  if (!mapEntry) continue;

  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) {
    console.error(`MISSING: ${entry.id}`);
    errors++;
    continue;
  }

  const raw = readFileSync(path, "utf8");

  if (!raw.includes("createSimulation") && !raw.includes("createTopicSim")) {
    continue;
  }

  const lab = mapEntry.lab;
  if (lab === "none") continue;

  if (!INTERACTIVE_LABS.has(lab)) continue;

  // Migrated topics should use lab registry
  if (!raw.includes("createTopicSim") && !raw.includes("@sim-gold") && !raw.includes("@sim-handcrafted") && !raw.includes("mountLab")) {
    console.error(`NOT MIGRATED TO LAB: ${entry.id}`);
    errors++;
  }

  // Reject old mountSimulation with transport on migrated lab topics
  if (raw.includes("@sim-lab") && raw.includes("mountSimulation") && !raw.includes("createTopicSim")) {
    console.error(`STILL USES mountSimulation: ${entry.id}`);
    errors++;
  }

  if (GENERIC_PATH.test(raw) && !entry.id.includes("gateway") && !entry.id.includes("payment-system")) {
    const inSim = raw.match(/createSimulation[\s\S]*?^}/m)?.[0] || "";
    if (GENERIC_PATH.test(inSim)) {
      console.error(`GENERIC PAYMENT PATH IN SIM: ${entry.id}`);
      errors++;
    }
  }
}

// Gold topics must use registry (gold handlers inside)
const GOLD = ["token-bucket", "leaky-bucket", "read-your-writes", "dead-letter-queue",
  "lost-update", "transactional-outbox", "circuit-breaker", "lru-cache", "dns"];
for (const id of GOLD) {
  const entry = FLAT_TOPICS.find((t) => t.id === id);
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  const raw = readFileSync(path, "utf8");
  if (!raw.includes("createTopicSim")) {
    console.error(`GOLD NOT WIRED: ${id}`);
    errors++;
  }
}

const interactiveCount = Object.values(simMap.topics).filter((t) => t.lab !== "none").length;
if (errors) {
  console.error(`\n${errors} sim quality error(s) across ${interactiveCount} interactive topics`);
  process.exit(1);
}
console.log(`Sim quality verification passed: ${interactiveCount} interactive topics OK`);
