/**
 * Rewrite HLD topic articles to interview-grade sections.
 * Run: node scripts/rewrite-hld-articles.mjs [--id topic-id] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import {
  buildHldSections, formatHldSectionsJs, shouldSkipHldRewrite, isShallowHldContent,
} from "./lib/hld-article-writer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const idFilter = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const allowShallow = process.argv.includes("--allow-shallow");

if (force && !allowShallow) {
  console.error("ERROR: --force disabled. Bulk shallow rewrites produce low-quality articles.");
  console.error("Hand-author topics with @hld-gold or use subagent waves. Pass --allow-shallow to override.");
  process.exit(1);
}

const hldTopics = FLAT_TOPICS.filter((t) => t.track === "hld" && (!idFilter || t.id === idFilter));

let rewritten = 0;
let skipped = 0;

function replaceSections(raw, sectionsJs) {
  if (raw.includes("sections:")) {
    return raw.replace(/sections:\s*\[[\s\S]*?\],\s*\n/, `sections: ${sectionsJs},\n`);
  }
  return null;
}

for (const entry of hldTopics) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) {
    console.warn("SKIP missing:", entry.id);
    skipped++;
    continue;
  }

  let raw = readFileSync(path, "utf8");
  if (!raw.includes("@article-v2")) {
    console.warn("SKIP not article-v2:", entry.id);
    skipped++;
    continue;
  }

  if (shouldSkipHldRewrite(entry.id, raw, force)) {
    skipped++;
    continue;
  }

  if (!raw.includes("sections:")) {
    console.warn("SKIP no sections block:", entry.id);
    skipped++;
    continue;
  }

  const archetypeMatch = raw.match(/archetype:\s*["'](\w+)["']/);
  const archetype = archetypeMatch?.[1];
  const { archetype: newArchetype, sections } = buildHldSections({
    id: entry.id,
    title: entry.title,
    blurb: entry.blurb || "",
    catId: entry.category.id,
    archetype,
  });

  const sectionsJs = formatHldSectionsJs(sections);
  const updated = replaceSections(raw, sectionsJs);
  if (!updated) {
    console.warn("SKIP sections replace failed:", entry.id);
    skipped++;
    continue;
  }
  raw = updated;

  if (archetype !== newArchetype && raw.includes("archetype:")) {
    raw = raw.replace(/archetype:\s*["']\w+["']/, `archetype: "${newArchetype}"`);
  }

  if (!dryRun) writeFileSync(path, raw, "utf8");
  rewritten++;
}

console.log(`HLD rewrite: ${rewritten} updated, ${skipped} skipped${dryRun ? " (dry-run)" : ""}`);
