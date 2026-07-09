/**
 * Generate scripts/content-map.json from category rules + overrides.
 * Run: node scripts/gen-content-map.mjs
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateContentMap } from "./lib/content-map-gen.mjs";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const map = generateContentMap();
writeFileSync(join(ROOT, "scripts", "content-map.json"), JSON.stringify(map, null, 2), "utf8");

const simCount = Object.values(map.topics).filter((t) => t.sim !== "none").length;
const figCount = Object.values(map.topics).filter((t) => t.figure !== "none").length;
const proseCount = Object.values(map.topics).filter((t) => t.sim === "none" && t.figure === "none").length;
console.log(`Wrote ${FLAT_TOPICS.length} topics: ${simCount} interactive, ${figCount} figures, ${proseCount} prose-only`);
