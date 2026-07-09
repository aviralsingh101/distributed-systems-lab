/**
 * Infer lab type per topic from content-map.json (source of truth).
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../../js/registry.js";
import { generateContentMap } from "./content-map-gen.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTENT_MAP_PATH = join(ROOT, "scripts", "content-map.json");

function loadContentMap() {
  if (existsSync(CONTENT_MAP_PATH)) {
    return JSON.parse(readFileSync(CONTENT_MAP_PATH, "utf8"));
  }
  return generateContentMap();
}

export function inferLabType(topic) {
  const map = loadContentMap();
  const entry = map.topics[topic.id];
  if (!entry) return { lab: "none", priority: "default" };
  return {
    lab: entry.sim || "none",
    figure: entry.figure || "none",
    priority: entry.priority || topic.track,
    category: topic.category.id,
    track: topic.track,
    title: topic.title,
  };
}

export function generateSimMap() {
  const map = loadContentMap();
  const topics = {};
  for (const t of FLAT_TOPICS) {
    const entry = map.topics[t.id] || inferLabType(t);
    topics[t.id] = {
      lab: entry.sim || entry.lab || "none",
      figure: entry.figure || "none",
      priority: entry.priority || t.track,
      category: t.category.id,
      track: t.track,
      title: t.title,
    };
  }
  return { version: 1, topics };
}
