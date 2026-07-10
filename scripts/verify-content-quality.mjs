/**
 * Rubric-based content quality verification for @article-v2 topics.
 * Run: node scripts/verify-content-quality.mjs [--track hld|lld|failures]
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import {
  isArticleV2, validateArticleV2, hasForbidden, sectionWordCount,
} from "./lib/article-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const trackFilter = process.argv.find((a) => a.startsWith("--track="))?.split("=")[1];
const goldOnly = process.argv.includes("--gold-only");

let v2Count = 0;
const failures = [];
const legacySkipped = [];

const topics = trackFilter
  ? FLAT_TOPICS.filter((t) => t.track === trackFilter)
  : FLAT_TOPICS;

for (const entry of topics) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) {
    failures.push({ id: entry.id, track: entry.track, issues: ["missing file"] });
    continue;
  }

  const raw = readFileSync(path, "utf8");
  if (!isArticleV2(raw)) {
    legacySkipped.push(entry.id);
    continue;
  }

  if (goldOnly && !raw.includes("@hld-gold")) continue;

  v2Count++;
  const issues = validateArticleV2(raw, entry.track, entry.category?.id || "");
  if (hasForbidden(raw)) issues.push("forbidden boilerplate");

  if (issues.length) failures.push({ id: entry.id, track: entry.track, issues: [...new Set(issues)] });
}

console.log(`Quality rubric: ${v2Count} article-v2 topics checked, ${legacySkipped.length} legacy skipped`);

if (failures.length) {
  console.error(`${failures.length} quality failure(s):`);
  failures.forEach((f) => console.error(`  ${f.id}: ${f.issues.join("; ")}`));
  process.exit(1);
}

if (v2Count === 0) {
  console.log("No article-v2 topics yet — rubric deferred.");
} else {
  console.log(`Quality rubric passed for all ${v2Count} article-v2 topics.`);
}
