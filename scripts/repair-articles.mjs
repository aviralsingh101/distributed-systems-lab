/**
 * Repair migrated article-v2 files: fix broken sections arrays, add production checklist.
 * Run: node scripts/repair-articles.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { buildSections } from "./lib/article-writer.mjs";
import { isArticleV2, sectionWordCount } from "./lib/article-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLD = new Set(["dns", "lost-update", "reverse-proxy", "transactional-outbox", "singleton"]);

let repaired = 0;

for (const entry of FLAT_TOPICS) {
  if (GOLD.has(entry.id)) continue;
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) continue;
  let raw = readFileSync(path, "utf8");
  if (!isArticleV2(raw)) continue;

  // Fix broken makeTopic: `},` followed by `related:` without closing `]`
  if (/\},\s*\n\s*related:/.test(raw) && !/\],\s*\n\s*related:/.test(raw)) {
    raw = raw.replace(/(\},\s*\n)(\s*related:)/, "$1  ],\n$2");
    repaired++;
  }

  // Re-generate sections if word count low
  if (sectionWordCount(raw) < 400) {
    const { archetype, sections } = buildSections(
      entry.title, entry.blurb, entry.track, entry.category.id,
    );
    const relatedMatch = raw.match(/related:\s*(\[[^\]]*\])/);
    const related = relatedMatch ? relatedMatch[1] : "[]";

    if (raw.includes("makeTopic({")) {
      const simIdx = raw.search(/\s*template:|sim:/);
      const tail = raw.slice(simIdx);
      const head = raw.slice(0, raw.indexOf("makeTopic({"));
      const sectionsJs = sections.map((s) => {
        const body = s.body.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
        const title = s.title.replace(/`/g, "\\`");
        return `    { title: \`${title}\`, body: \`${body}\` }`;
      }).join(",\n");
      raw = `${head}makeTopic({
  id: "${entry.id}",
  title: "${entry.title.replace(/"/g, '\\"')}",
  category: "${entry.category.id}",
  track: "${entry.track}",
  tier: "${entry.tier || "essential"}",
  archetype: "${archetype}",
  oneliner: \`${entry.blurb}\`,
  sections: [
${sectionsJs}
  ],
  related: ${related},
  ${tail}`;
    } else if (raw.includes("export const content = {")) {
      const sectionsJs = sections.map((s) => {
        const body = s.body.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
        const title = s.title.replace(/`/g, "\\`");
        return `    { title: \`${title}\`, body: \`${body}\` }`;
      }).join(",\n");
      raw = raw.replace(
        /export const content = \{[\s\S]*?\};/,
        `export const content = {
  oneliner: \`${entry.blurb}\`,
  archetype: "${archetype}",
  sections: [
${sectionsJs}
  ],
  related: ${related},
};`,
      );
    }
    repaired++;
  }

  writeFileSync(path, raw, "utf8");
}

console.log(`Repaired/expanded: ${repaired} files`);
