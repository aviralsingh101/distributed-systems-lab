/**
 * Audit interactive lab pedagogical coverage.
 * Run: node scripts/audit-sim-pedagogy.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const interactive = JSON.parse(readFileSync(join(ROOT, "scripts", "interactive-topics.json"), "utf8"));
const specs = JSON.parse(readFileSync(join(ROOT, "scripts", "sim-behavior-specs.json"), "utf8")).topics;
const factories = readFileSync(join(ROOT, "js", "sim", "lab", "topicLabFactories.mjs"), "utf8");
const topicConfigs = readFileSync(join(ROOT, "js", "sim", "lab", "topicConfigs.mjs"), "utf8");
const registry = readFileSync(join(ROOT, "js", "sim", "lab", "registry.js"), "utf8");

const GOLD = new Set(["token-bucket", "leaky-bucket", "read-your-writes", "dead-letter-queue", "lost-update", "transactional-outbox", "circuit-breaker", "lru-cache", "dns"]);

const LOCK_STEP_IDS = [...factories.matchAll(/^\s{2}"([\w-]+)":\s*\[/gm)]
  .filter((m) => factories.indexOf(`"${m[1]}": [`) < factories.indexOf("function raceStepsFor"))
  .map((m) => m[1]);

const RACE_STEP_IDS = ["aba", "double-spend", "write-skew", "dirty-read", "phantom-read", "non-repeatable-read", "read-skew",
  "idempotency-key", "exactly-once", "deduplication"];

function hasCustomConfig(topicId, lab) {
  if (GOLD.has(topicId)) return "gold";
  if (LOCK_STEP_IDS.includes(topicId) || RACE_STEP_IDS.includes(topicId)) return "custom";
  if (topicId === "deadlock" || topicId === "toctou") return "custom";
  const patterns = [
    new RegExp(`["']${topicId}["']:\\s*\\{`),
    new RegExp(`["']${topicId}["']:\\s*\\(\\(\\)`),
    new RegExp(`["']${topicId}["']:\\s*cacheFlowConfig`),
  ];
  if (patterns.some((p) => p.test(factories))) return "custom";
  if (lab === "architecture" && new RegExp(`["']${topicId}["']:\\s*\\{`).test(topicConfigs)) return "custom";
  return "generic";
}

function specStrength(topicId) {
  const cases = specs[topicId]?.cases || [];
  if (!cases.length) return "none";
  const weak = cases.every((c) => !c.expect || Object.keys(c.expect).length === 0);
  const stub = cases.every((c) => c.action === "start" && !c.expect);
  if (stub) return "stub";
  if (weak) return "weak";
  return "strong";
}

const report = { gold: [], custom: [], generic: [], weakSpecs: [], noSpecs: [] };

for (const [lab, ids] of Object.entries(interactive)) {
  for (const id of ids) {
    const kind = hasCustomConfig(id, lab);
    report[kind].push({ id, lab });
    const strength = specStrength(id);
    if (strength === "none") report.noSpecs.push(id);
    else if (strength === "stub" || strength === "weak") report.weakSpecs.push({ id, strength });
  }
}

console.log("# Interactive Lab Pedagogy Audit\n");
console.log(`| Tier | Count |`);
console.log(`|------|-------|`);
console.log(`| Gold handlers | ${report.gold.length} |`);
console.log(`| Custom MAP configs | ${report.custom.length} |`);
console.log(`| Generic fallbacks | ${report.generic.length} |`);
console.log(`| Weak/missing behavior specs | ${report.weakSpecs.length + report.noSpecs.length} |\n`);

if (report.generic.length) {
  console.log("## Generic fallbacks (need domain-specific models)\n");
  for (const { id, lab } of report.generic.sort((a, b) => a.lab.localeCompare(b.lab) || a.id.localeCompare(b.id))) {
    console.log(`- ${id} (${lab})`);
  }
  console.log();
}

const byLab = {};
for (const { id, lab } of report.generic) (byLab[lab] ||= []).push(id);
console.log("## Generic by lab type\n");
for (const [lab, ids] of Object.entries(byLab)) console.log(`- ${lab}: ${ids.length}`);

process.exit(report.generic.length > 20 ? 1 : 0);
