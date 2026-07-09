/**
 * Sync figure-map.json from content-map.json.
 * Run: node scripts/sync-figure-map.mjs
 */
import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentMap = JSON.parse(readFileSync(join(ROOT, "scripts", "content-map.json"), "utf8"));

const topics = {};
for (const t of FLAT_TOPICS) {
  const entry = contentMap.topics[t.id];
  if (!entry || entry.figure === "none") continue;
  topics[t.id] = {
    diagramType: entry.figure === "umlClass" ? "umlClass" : entry.figure === "er" ? "er" : entry.figure,
    category: t.category.id,
    track: t.track,
  };
}

writeFileSync(join(ROOT, "scripts", "figure-map.json"), JSON.stringify({ version: 1, topics }, null, 2), "utf8");
console.log(`Synced ${Object.keys(topics).length} figure-map entries from content-map`);
