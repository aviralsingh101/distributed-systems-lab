/**
 * @deprecated DISABLED — use article-v2 authoring per docs/ARTICLE_GUIDE.md
 * Run: node scripts/apply-enrichment.mjs
 */
console.error("apply-enrichment.mjs is disabled. Use hand-written article-v2 content (docs/ARTICLE_GUIDE.md).");
console.error("To migrate legacy topics: node scripts/migrate-to-article-v2.mjs");
process.exit(1);

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { richContent, esc } from "./lib/enrich-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const trackFilter = args.includes("--track") ? args[args.indexOf("--track") + 1] : null;
const catFilter = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;

const GOLD_IDS = new Set(["reverse-proxy", "transactional-outbox", "lost-update"]);

let enriched = 0;
let skipped = 0;

function tradeoffsBlock(tr) {
  return `  tradeoffs: {
    pros: ${JSON.stringify(tr.pros)},
    cons: ${JSON.stringify(tr.cons)},
    whenToUse: ${JSON.stringify(tr.whenToUse)},
    whenNotToUse: ${JSON.stringify(tr.whenNotToUse)},
  },`;
}

function patchMakeTopicFile(path, topic, track, catId) {
  const c = richContent(topic, track, catId);
  let raw = readFileSync(path, "utf8");

  if (!raw.startsWith("// @content-enriched")) {
    raw = "// @content-enriched\n" + raw.replace(/^\/\/ @content-enriched\n/, "");
  }

  if (raw.includes("plainEnglish:")) {
    raw = raw
      .replace(/plainEnglish:\s*`[\s\S]*?`/, `plainEnglish: \`${esc(c.plainEnglish)}\``)
      .replace(/technical:\s*`[\s\S]*?`/, `technical: \`${esc(c.technical)}\``);
  } else {
    raw = raw.replace(
      /(oneliner:\s*(?:`[^`]*`|"[^"]*"),)\n/,
      `$1\n  plainEnglish: \`${esc(c.plainEnglish)}\`,\n  technical: \`${esc(c.technical)}\`,\n`
    );
  }

  raw = raw
    .replace(/problem:\s*`[\s\S]*?`/, `problem: \`${esc(c.problem)}\``)
    .replace(/solution:\s*`[\s\S]*?`/, `solution: \`${esc(c.solution)}\``)
    .replace(/after:\s*`[\s\S]*?`/, `after: \`${esc(c.after)}\``)
    .replace(/example:\s*`[\s\S]*?`/, `example: \`${esc(c.example)}\``)
    .replace(/tradeoffs:\s*\{[\s\S]*?\},/, tradeoffsBlock(c.tradeoffs));

  writeFileSync(path, raw);
}

function patchBackendFile(path, topic, catId) {
  const c = richContent(topic, "backend", catId);
  let raw = readFileSync(path, "utf8");

  if (!raw.startsWith("// @content-enriched")) {
    raw = "// @content-enriched\n" + raw.replace(/^\/\/ @content-enriched\n/, "");
  }

  const contentBlock = `export const content = {
  oneliner: ${JSON.stringify(c.oneliner)},
  plainEnglish: \`${esc(c.plainEnglish)}\`,
  technical: \`${esc(c.technical)}\`,
  problem: \`${esc(c.problem)}\`,
  solution: \`${esc(c.solution)}\`,
  tradeoffs: {
    pros: ${JSON.stringify(c.tradeoffs.pros)},
    cons: ${JSON.stringify(c.tradeoffs.cons)},
    whenToUse: ${JSON.stringify(c.tradeoffs.whenToUse)},
    whenNotToUse: ${JSON.stringify(c.tradeoffs.whenNotToUse)},
  },
  after: \`${esc(c.after)}\`,
  example: \`${esc(c.example)}\`,
  related: ${JSON.stringify(c.related || [])},
};`;

  raw = raw.replace(/export const content = \{[\s\S]*?\};/, contentBlock);
  writeFileSync(path, raw);
}

for (const entry of FLAT_TOPICS) {
  if (trackFilter && entry.track !== trackFilter) continue;
  if (catFilter && entry.category.id !== catFilter) continue;

  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) { console.error("MISSING", path); continue; }

  const raw = readFileSync(path, "utf8");
  if (GOLD_IDS.has(entry.id)) {
    skipped++;
    continue;
  }

  if (raw.includes("@content-enriched") && raw.includes("plainEnglish") && !raw.includes("payment platform hits limits") && !args.includes("--force")) {
    skipped++;
    continue;
  }

  const topic = { id: entry.id, title: entry.title, blurb: entry.blurb, related: entry.related, tier: entry.tier };

  if (entry.track === "backend") {
    patchBackendFile(path, topic, entry.category.id);
  } else {
    patchMakeTopicFile(path, topic, entry.track, entry.category.id);
  }
  enriched++;
}

console.log(`Done: enriched ${enriched}, skipped ${skipped}`);
