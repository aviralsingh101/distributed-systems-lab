/**
 * Inject topic-specific figures from figure-map.json + figure-templates.mjs.
 * Run: node scripts/add-figures.mjs [--wave failures|hld|lld|gold] [--id topic-id] [--generate-map]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { buildFigure, INGRESS_TOPICS } from "./lib/figure-templates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "scripts", "figure-map.json");

const WAVE_CATEGORIES = {
  failures: {
    concurrency: "timeline",
    locking: "lockTimeline",
    retry: "retryAmplification",
    cache: "stampede",
    messaging: "messagingLoop",
    failure: "stateMachine",
    "prod-eng": "fanOut",
  },
  "hld-networking": { "*": "requestFlow" },
  "hld-blocks": { "*": "requestFlow" },
  "hld-consistency": { "*": "quorum" },
  "hld-theory": { "*": "comparison" },
  "hld-db-scaling": { "*": "hashRing" },
  "hld-cache-strategies": { "*": "cacheFlow" },
  "hld-rate-limiting": { "*": "tokenBucket" },
  "hld-messaging-ops": { "*": "messagingLoop" },
  "hld-reliability-patterns": { "*": "retryAmplification" },
  "hld-classics": { "*": "architecture" },
  "lld-transactions": { "*": "twoPc" },
  "lld-dist-locks": { "*": "lockTimeline" },
  "lld-event-ordering": { "*": "clock" },
  "lld-idempotency": { "*": "timeline" },
  "lld-concurrency-strategies": { "*": "comparison" },
  "lld-dist-patterns": { "*": "outboxFlow" },
  "lld-async": { "*": "messagingLoop" },
  "lld-classics": { "*": "architecture" },
};

const TOPIC_OVERRIDES = {
  dns: { diagramType: "requestFlow", skip: true },
  "lost-update": { diagramType: "timeline" },
  toctou: { diagramType: "timeline", variant: "toctou" },
  "reverse-proxy": { diagramType: "requestFlow", highlight: "Reverse Proxy" },
  "transactional-outbox": { diagramType: "outboxFlow" },
  singleton: { diagramType: "comparison", left: "One instance", right: "Duplicates" },
  "circuit-breaker": { diagramType: "stateMachine", single: true },
  "cap-theorem": { diagramType: "capTriangle" },
  "cap-theorem-framing": { diagramType: "capTriangle" },
  pacelc: { diagramType: "capTriangle" },
  "consistent-hashing": { diagramType: "hashRing" },
  "consistent-hashing-placement": { diagramType: "hashRing" },
  "api-gateway": { diagramType: "requestFlow", highlight: "API Gateway", fanOut: true },
  "n-plus-one": { diagramType: "fanOut", single: true },
  "cascading-failure": { diagramType: "domino", single: true },
  "bulkhead": { diagramType: "stateMachine", single: true },
  saga: { diagramType: "saga" },
  "saga-choreography": { diagramType: "saga" },
  "saga-orchestration": { diagramType: "saga" },
  "two-pc": { diagramType: "twoPc" },
  "three-pc": { diagramType: "twoPc" },
  "lamport-clock": { diagramType: "clock", kind: "lamport" },
  "vector-clock": { diagramType: "clock", kind: "vector" },
  "redis-lock": { diagramType: "lockTimeline" },
  redlock: { diagramType: "lockTimeline" },
  "cache-stampede": { diagramType: "stampede", single: true },
  "thundering-herd": { diagramType: "stampede" },
  "retry-storm": { diagramType: "retryAmplification" },
  "retry-amplification": { diagramType: "retryAmplification" },
  "poison-message": { diagramType: "messagingLoop" },
  "slow-consumer": { diagramType: "slowConsumer" },
  "backpressure": { diagramType: "slowConsumer" },
  "connection-pool-exhaustion": { diagramType: "poolExhaustion" },
  deadlock: { diagramType: "lockTimeline" },
  quorum: { diagramType: "quorum" },
  "quorum-reads-writes": { diagramType: "quorum" },
  "cache-aside": { diagramType: "cacheFlow", mode: "aside" },
  "write-through": { diagramType: "cacheFlow", mode: "through" },
  "read-through": { diagramType: "cacheFlow", mode: "through" },
  "token-bucket": { diagramType: "tokenBucket" },
  "leaky-bucket": { diagramType: "tokenBucket" },
  "url-shortener": { diagramType: "architecture", components: ["Client", "API", "Hash DB", "Redirect"] },
  "pagination-offset-cursor": { diagramType: "comparison", left: "OFFSET pages", right: "Cursor keyset" },
  "inbox-pattern": { diagramType: "outboxFlow" },
  "outbox-inbox-combo": { diagramType: "outboxFlow" },
};

const FAILURE_CAT_IDS = new Set(["concurrency", "locking", "retry", "cache", "messaging", "failure", "prod-eng"]);
const HLD_WAVE_CATS = new Set([
  "hld-networking", "hld-blocks", "hld-consistency", "hld-theory",
  "hld-db-scaling", "hld-cache-strategies", "hld-rate-limiting",
  "hld-messaging-ops", "hld-reliability-patterns", "hld-classics",
]);
const LLD_WAVE_CATS = new Set([
  "lld-transactions", "lld-dist-locks", "lld-event-ordering", "lld-idempotency",
  "lld-concurrency-strategies", "lld-dist-patterns", "lld-async", "lld-classics",
]);

function inferDiagramType(topic) {
  if (TOPIC_OVERRIDES[topic.id]) {
    const o = TOPIC_OVERRIDES[topic.id];
    if (o.skip) return null;
    return o;
  }
  if (topic.track === "failures") {
    const dt = WAVE_CATEGORIES.failures[topic.category.id] || "timeline";
    return { diagramType: dt };
  }
  const catRules = WAVE_CATEGORIES[topic.category.id];
  if (catRules) return { diagramType: catRules["*"] };
  if (topic.id === "pagination-offset-cursor") return { diagramType: "comparison" };
  return null;
}

export function generateFigureMap() {
  const topics = {};
  for (const t of FLAT_TOPICS) {
    const cfg = inferDiagramType(t);
    if (!cfg) continue;
    topics[t.id] = { ...cfg, category: t.category.id, track: t.track };
  }
  return { version: 1, topics };
}

function escBacktick(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function formatFiguresJs(figures) {
  const items = figures.map((f) => {
    const svg = escBacktick(f.svg.replace(/\s+/g, " ").trim());
    const cap = escBacktick(f.caption);
    return `    { id: "${f.id}", svg: \`${svg}\`, caption: \`${cap}\` }`;
  });
  return `  figures: [\n${items.join(",\n")},\n  ],`;
}

function injectFigures(raw, figuresJs) {
  if (raw.includes("@figure-handcrafted") && raw.includes("figures:")) {
    return raw; // keep handcrafted figures
  }
  if (raw.includes("figures:")) {
    return raw.replace(/  figures:\s*\[[\s\S]*?\],/, figuresJs);
  }
  // Insert after sections block
  const secEnd = raw.search(/\n  related:/);
  if (secEnd >= 0) {
    return raw.slice(0, secEnd) + "\n" + figuresJs + raw.slice(secEnd);
  }
  const contentSecEnd = raw.search(/\n  related:|\n};/);
  if (contentSecEnd >= 0 && raw.includes("export const content")) {
    return raw.slice(0, contentSecEnd) + "\n" + figuresJs.replace(/^  /, "  ") + raw.slice(contentSecEnd);
  }
  return null;
}

function topicInWave(topic, wave) {
  if (wave === "gold") {
    return ["dns", "lost-update", "reverse-proxy", "transactional-outbox", "singleton",
      "toctou", "circuit-breaker", "cap-theorem", "cap-theorem-framing",
      "consistent-hashing", "api-gateway"].includes(topic.id);
  }
  if (wave === "failures") return topic.track === "failures";
  if (wave === "hld") return HLD_WAVE_CATS.has(topic.category.id);
  if (wave === "lld") return LLD_WAVE_CATS.has(topic.category.id) || topic.id === "pagination-offset-cursor";
  if (wave.startsWith("hld-")) return topic.category.id === wave;
  return false;
}

function processTopic(entry, mapEntry, force = false) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) return { status: "missing" };
  let raw = readFileSync(path, "utf8");
  if (raw.includes("@figure-handcrafted") && !force) return { status: "handcrafted" };

  const { diagramType, ...opts } = mapEntry;
  let figures = [];
  const fig = buildFigure(diagramType, entry.id, entry.title, opts);
  figures.push(fig);

  // Remove generic request-path duplicate unless ingress topic
  if (!INGRESS_TOPICS.has(entry.id) && !opts.single && diagramType !== "requestFlow") {
    // only one figure
  } else if (INGRESS_TOPICS.has(entry.id) && diagramType === "requestFlow" && !opts.fanOut) {
    // single ingress figure is fine
  }

  if (opts.single) {
    figures = [fig];
  }

  const figuresJs = formatFiguresJs(figures);
  const updated = injectFigures(raw, figuresJs);
  if (!updated) return { status: "inject-fail" };
  if (updated === raw) return { status: "unchanged" };
  writeFileSync(path, updated, "utf8");
  return { status: "updated" };
}

// CLI
const args = process.argv.slice(2);
if (args.includes("--generate-map")) {
  const map = generateFigureMap();
  writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), "utf8");
  console.log(`Wrote ${Object.keys(map.topics).length} entries to figure-map.json`);
  process.exit(0);
}

if (!existsSync(MAP_PATH)) {
  const map = generateFigureMap();
  writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), "utf8");
}

const figureMap = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const wave = args.find((a) => a.startsWith("--wave="))?.split("=")[1];
const idFilter = args.find((a) => a.startsWith("--id="))?.split("=")[1];
const force = args.includes("--force");

let updated = 0, skipped = 0, failed = 0;

for (const entry of FLAT_TOPICS) {
  if (idFilter && entry.id !== idFilter) continue;
  if (wave && !topicInWave(entry, wave)) continue;
  const mapEntry = figureMap.topics[entry.id];
  if (!mapEntry) { skipped++; continue; }
  if (mapEntry.skip) { skipped++; continue; }

  const result = processTopic(entry, mapEntry, force);
  if (result.status === "updated") { updated++; console.log("OK:", entry.id); }
  else if (result.status === "handcrafted" || result.status === "unchanged") skipped++;
  else { failed++; console.warn("FAIL:", entry.id, result.status); }
}

console.log(`Done: ${updated} updated, ${skipped} skipped, ${failed} failed`);
