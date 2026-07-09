/**
 * Verify mapped topics have valid topic-specific SVG figures.
 * Run: node scripts/verify-figures.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { INGRESS_TOPICS } from "./lib/figure-templates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "scripts", "figure-map.json");

if (!existsSync(MAP_PATH)) {
  console.error("Missing figure-map.json — run: node scripts/add-figures.mjs --generate-map");
  process.exit(1);
}

const figureMap = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const mappedIds = new Set(Object.keys(figureMap.topics).filter((id) => !figureMap.topics[id].skip));

let errors = 0;
const GENERIC_CAPTION = /payment request path/i;
const CAP_SVG = /Consistency[\s\S]*Availability[\s\S]*Partition|cap-triangle/i;

for (const entry of FLAT_TOPICS) {
  if (!mappedIds.has(entry.id)) continue;
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) {
    console.error(`MISSING FILE: ${entry.id}`);
    errors++;
    continue;
  }
  const raw = readFileSync(path, "utf8");

  if (!raw.includes("figures:")) {
    console.error(`NO FIGURES: ${entry.id}`);
    errors++;
    continue;
  }

  const figMatch = raw.match(/figures:\s*\[([\s\S]*?)\],/);
  if (!figMatch) {
    console.error(`MALFORMED figures: ${entry.id}`);
    errors++;
    continue;
  }

  const block = figMatch[1];
  const figEntries = [...block.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
  const inlineSvgs = [...block.matchAll(/svg:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
  const constRefs = [...block.matchAll(/svg:\s*([A-Z_][A-Z0-9_]*)/g)].map((m) => m[1]);
  const constSvgs = constRefs
    .map((name) => raw.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`))?.[1])
    .filter(Boolean);
  const svgs = [...inlineSvgs, ...constSvgs];
  const captions = [...block.matchAll(/caption:\s*(?:`([\s\S]*?)`|"([^"]*)")/g)].map((m) => m[1] || m[2]);

  if (!figEntries.length) {
    console.error(`EMPTY figures: ${entry.id}`);
    errors++;
    continue;
  }

  if (!svgs.length && !raw.includes("@figure-handcrafted")) {
    console.error(`NO SVG (inline or const): ${entry.id}`);
    errors++;
    continue;
  }

  for (const svg of svgs) {
    if (!svg.includes("<svg") || !svg.includes("</svg>")) {
      console.error(`INVALID SVG: ${entry.id}`);
      errors++;
    }
  }

  for (const cap of captions) {
    if (GENERIC_CAPTION.test(cap) && !INGRESS_TOPICS.has(entry.id)) {
      console.error(`GENERIC CAPTION on non-ingress: ${entry.id} — ${cap.slice(0, 60)}`);
      errors++;
    }
  }

  const isCapTopic = /^(cap-theorem|cap-theorem-framing|pacelc|quorum|eventual-consistency)/.test(entry.id)
    || entry.id.includes("consistency");
  if (!isCapTopic && svgs.some((s) => CAP_SVG.test(s)) && !entry.id.includes("cap")) {
    // Allow quorum diagrams on consistency topics
    if (!entry.id.includes("quorum") && !entry.id.includes("consistent")) {
      const hasCapTriangle = svgs.some((s) => s.includes("Consistency") && s.includes("Availability") && s.includes("Partition"));
      if (hasCapTriangle) {
        console.error(`CAP TRIANGLE MISMATCH: ${entry.id}`);
        errors++;
      }
    }
  }

  // Reject duplicate generic request-path alongside specific diagram
  if (!INGRESS_TOPICS.has(entry.id)) {
    const hasRequestPath = captions.some((c) => GENERIC_CAPTION.test(c));
    const hasSpecific = captions.some((c) => !GENERIC_CAPTION.test(c));
    if (hasRequestPath && hasSpecific) {
      console.error(`REDUNDANT request-path figure: ${entry.id}`);
      errors++;
    }
  }
}

// Also scan ALL topics for CAP on wrong topics (e.g. encapsulation)
const WRONG_CAP_IDS = new Set(["encapsulation", "abstraction", "polymorphism"]);
for (const entry of FLAT_TOPICS) {
  if (!WRONG_CAP_IDS.has(entry.id)) continue;
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  const raw = readFileSync(path, "utf8");
  if (raw.includes("figures:") && CAP_SVG.test(raw)) {
    console.error(`CAP TRIANGLE ON OOP TOPIC: ${entry.id}`);
    errors++;
  }
}

const total = mappedIds.size;
if (errors) {
  console.error(`\n${errors} figure error(s) across ${total} mapped topics`);
  if (process.argv[1]?.includes("verify-figures")) process.exit(1);
  throw new Error(`${errors} figure error(s)`);
}
console.log(`Figure verification passed: ${total} mapped topics OK`);
