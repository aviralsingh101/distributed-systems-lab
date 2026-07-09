/**
 * Migrate legacy topics to article-v2 format.
 * Run: node scripts/migrate-to-article-v2.mjs [--dry-run] [--category=catId]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { buildSections, formatSectionsJs } from "./lib/article-writer.mjs";
import { isArticleV2 } from "./lib/article-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const catFilter = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1];

let migrated = 0;
let skipped = 0;

for (const entry of FLAT_TOPICS) {
  if (catFilter && entry.category.id !== catFilter) continue;
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) continue;
  const raw = readFileSync(path, "utf8");
  if (isArticleV2(raw)) { skipped++; continue; }

  const { archetype, sections } = buildSections(
    entry.title,
    entry.blurb,
    entry.track,
    entry.category.id,
  );

  let updated = raw
    .replace(/^\/\/ @content-enriched\s*\n/, "")
    .replace(/^\/\/ @article-v2\s*\n/, "");

  const marker = "// @article-v2\n";
  if (!updated.startsWith(marker)) updated = marker + updated;

  const sectionsJs = formatSectionsJs(sections);

  // Extract related array if present
  const relatedMatch = raw.match(/related:\s*(\[[^\]]*\])/);
  const related = relatedMatch ? relatedMatch[1] : "[]";

  // Replace makeTopic content block or export const content
  if (updated.includes("makeTopic({")) {
    const simIdx = updated.search(/\s*template:|sim:/);
    if (simIdx < 0) { console.warn("SKIP (no sim):", entry.id); continue; }
    const tail = updated.slice(simIdx);
    const head = updated.slice(0, updated.indexOf("makeTopic({"));
    updated = `${head}makeTopic({
  id: "${entry.id}",
  title: "${entry.title.replace(/"/g, '\\"')}",
  category: "${entry.category.id}",
  track: "${entry.track}",
  tier: "${entry.tier || "essential"}",
  archetype: "${archetype}",
  oneliner: \`${entry.blurb}\`,
  sections: ${sectionsJs},
  related: ${related},
  ${tail}`;
  } else if (updated.includes("export const content = {")) {
    updated = updated.replace(
      /export const content = \{[\s\S]*?\};/,
      `export const content = {
  oneliner: \`${entry.blurb}\`,
  archetype: "${archetype}",
  sections: ${sectionsJs},
  related: ${related},
};`,
    );
  } else {
    console.warn("SKIP (unknown format):", entry.id);
    continue;
  }

  if (!dryRun) writeFileSync(path, updated, "utf8");
  migrated++;
}

console.log(`Migrated: ${migrated}, skipped (already v2): ${skipped}${dryRun ? " (dry-run)" : ""}`);
