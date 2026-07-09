/**
 * Verify content: article-v2 schema + forbidden boilerplate.
 * Run: node scripts/verify-content.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import {
  hasForbidden, isArticleV2, hasSections, validateArticleV2, wordCount, sectionWordCount,
} from "./lib/article-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let errors = 0;
const byTrack = { failures: { v2: 0, legacy: 0, fail: 0 }, hld: { v2: 0, legacy: 0, fail: 0 }, lld: { v2: 0, legacy: 0, fail: 0 } };
const failures = [];

for (const entry of FLAT_TOPICS) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  const issues = [];

  if (!existsSync(path)) {
    issues.push("file missing");
  } else {
    const raw = readFileSync(path, "utf8");

    if (hasForbidden(raw)) issues.push("forbidden boilerplate detected");

    if (isArticleV2(raw)) {
      issues.push(...validateArticleV2(raw));
      if (!issues.length) byTrack[entry.track].v2++;
    } else if (hasSections(raw)) {
      issues.push("has sections[] but missing @article-v2 marker");
      byTrack[entry.track].legacy++;
    } else {
      byTrack[entry.track].legacy++;
    }
  }

  if (issues.length) {
    errors++;
    byTrack[entry.track].fail++;
    failures.push({ id: entry.id, track: entry.track, issues });
  }
}

const v2Total = Object.values(byTrack).reduce((n, s) => n + s.v2, 0);
const legacyTotal = Object.values(byTrack).reduce((n, s) => n + s.legacy, 0);

console.log("Content verification:");
console.log(`  article-v2: ${v2Total} / ${FLAT_TOPICS.length}`);
console.log(`  legacy (pending rewrite): ${legacyTotal}`);
for (const [track, stats] of Object.entries(byTrack)) {
  console.log(`  ${track}: v2=${stats.v2} legacy=${stats.legacy} fail=${stats.fail}`);
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  failures.slice(0, 30).forEach((f) => console.log(`  ${f.id} [${f.track}]: ${f.issues.join("; ")}`));
  if (failures.length > 30) console.log(`  ... and ${failures.length - 30} more`);
  process.exit(1);
}

console.log("\nAll content checks passed.");
process.exit(0);
