/**
 * Unified content map — sim + figure assignment per topic.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OVERRIDES_PATH = join(ROOT, "scripts", "content-map-overrides.json");

const GOLD = new Set([
  "token-bucket", "leaky-bucket", "read-your-writes", "dead-letter-queue",
  "lost-update", "transactional-outbox", "circuit-breaker", "lru-cache", "dns",
]);

const FAILURE_SIM = {
  concurrency: "race",
  locking: "race",
  retry: "metrics",
  cache: "metrics",
  messaging: "queue",
  failure: "state",
  "prod-eng": "metrics",
};

const FAILURE_FIGURE = {
  concurrency: { "lost-update": "timeline", toctou: "timeline" },
  locking: { deadlock: "lockTimeline" },
  retry: {
    "retry-storm": "retryAmplification",
    "retry-amplification": "retryAmplification",
    "cache-stampede": "stampede",
    "thundering-herd": "stampede",
  },
  failure: { "circuit-breaker": "stateMachine", "cascading-failure": "domino", bulkhead: "stateMachine" },
  "prod-eng": {
    "n-plus-one": "fanOut",
    "connection-pool-exhaustion": "poolExhaustion",
  },
};

const HLD_STATIC_FIGURE = {
  "hld-architecture": "architecture",
  "hld-reliability": "requestFlow",
  "hld-security": "requestFlow",
};

/** Real A-vs-B topics only — not generic Option A/B on every data/theory page. */
const HLD_DATA_COMPARISON = new Set([
  "lambda-vs-kappa", "oltp-vs-olap", "btree-vs-lsm", "warehouse-lake-lakehouse",
]);
const HLD_THEORY_COMPARISON = new Set([
  "linearizability-vs-serializability", "distributed-transactions-comparison",
]);

const FIGURE_OPTS = {
  "lambda-vs-kappa": { left: "Lambda (batch + speed)", right: "Kappa (stream-only)" },
  "oltp-vs-olap": { left: "OLTP (row writes)", right: "OLAP (column scans)" },
  "btree-vs-lsm": { left: "B-tree (read-heavy)", right: "LSM (write-heavy)" },
  "warehouse-lake-lakehouse": { left: "Warehouse / Lake", right: "Lakehouse" },
  "linearizability-vs-serializability": { left: "Linearizability", right: "Serializability" },
  "distributed-transactions-comparison": { left: "2PC / Saga", right: "TCC / Outbox" },
};

/** Topics that keep a static figure alongside an interactive lab. */
const FIGURE_PLUS_SIM = new Set([
  "consistent-hashing", "consistent-hashing-placement", "quorum", "quorum-reads-writes",
  "consensus-raft-paxos",
]);

const HLD_CATEGORY_SIM = {
  "hld-rate-limiting": "metrics",
  "hld-cache-strategies": "clickFlow",
  "hld-consistency": "clickFlow",
  "hld-messaging-ops": "queue",
  "hld-reliability-patterns": "metrics",
  "hld-db-scaling": "algorithm",
  "hld-performance": "metrics",
  "hld-blocks": "architecture",
  "hld-classics": "architecture",
  "hld-theory": "state",
  "hld-networking": "clickFlow",
};

const LLD_CATEGORY_SIM = {
  "lld-transactions": "state",
  "lld-dist-locks": "race",
  "lld-event-ordering": "algorithm",
  "lld-idempotency": "race",
  "lld-concurrency-strategies": "state",
  "lld-dist-patterns": "clickFlow",
  "lld-async": "queue",
  "lld-classics": "algorithm",
  "lld-concurrency": "architecture",
  "lld-db": "clickFlow",
  "lld-api": "clickFlow",
};

const LLD_DDD_FIGURE = "architecture";
const LLD_UML_CATEGORIES = new Set(["lld-oop", "lld-creational", "lld-structural", "lld-behavioral"]);

function loadOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return {};
  return JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
}

function goldSim(id) {
  const m = {
    "token-bucket": "metrics", "leaky-bucket": "metrics", "read-your-writes": "clickFlow",
    "dead-letter-queue": "queue", "lost-update": "race", "transactional-outbox": "clickFlow",
    "circuit-breaker": "state", "lru-cache": "algorithm", dns: "clickFlow",
  };
  return m[id] || "metrics";
}

function inferHldSim(topic, ov) {
  const cat = topic.category.id;
  if (cat === "hld-tradeoffs") return "none";
  if (cat === "hld-foundations") return "none";
  if (HLD_STATIC_FIGURE[cat]) return "none";

  if (cat === "hld-rate-limiting") {
    if (ov.hldRateLimitingStatic?.includes(topic.id)) return "none";
    return "metrics";
  }
  if (cat === "hld-networking") {
    return ov.hldNetworkingInteractive?.includes(topic.id) ? "clickFlow" : "none";
  }
  if (cat === "hld-theory") {
    if (topic.id === "consistent-hashing-placement") return "algorithm";
    return ov.hldTheoryInteractive?.includes(topic.id) ? "state" : "none";
  }
  if (cat === "hld-blocks") {
    return ov.hldBlocksInteractive?.includes(topic.id) ? "architecture" : "none";
  }
  if (cat === "hld-classics") {
    return ov.hldClassicsInteractive?.includes(topic.id) ? "architecture" : "none";
  }
  return HLD_CATEGORY_SIM[cat] || "none";
}

function inferHldFigure(topic, ov) {
  const cat = topic.category.id;
  if (ov.proseOnly?.includes(topic.id)) return "none";
  if (cat === "hld-tradeoffs") return "comparison";
  if (cat === "hld-foundations") {
    if (ov.figureOnly?.[topic.id]) return ov.figureOnly[topic.id];
    return "none";
  }
  if (HLD_STATIC_FIGURE[cat]) return HLD_STATIC_FIGURE[cat];
  if (cat === "hld-data") {
    return HLD_DATA_COMPARISON.has(topic.id) ? "comparison" : "none";
  }

  if (cat === "hld-rate-limiting") {
    if (ov.hldRateLimitingStatic?.includes(topic.id)) return "architecture";
    return topic.id === "token-bucket" || topic.id === "leaky-bucket" ? "tokenBucket" : "none";
  }
  if (cat === "hld-networking") {
    if (topic.id === "dns") return "none";
    return ov.hldNetworkingInteractive?.includes(topic.id) ? "none" : "requestFlow";
  }
  if (cat === "hld-theory") {
    if (topic.id === "cap-theorem-framing" || topic.id === "pacelc") return "capTriangle";
    if (topic.id === "consistent-hashing-placement") return "hashRing";
    if (topic.id === "quorum-reads-writes") return "quorum";
    if (topic.id === "consensus-raft-paxos") return "consensus";
    if (HLD_THEORY_COMPARISON.has(topic.id)) return "comparison";
    return "none";
  }
  if (cat === "hld-blocks") {
    return ov.hldBlocksInteractive?.includes(topic.id) ? "none" : "requestFlow";
  }
  if (cat === "hld-classics") {
    return ov.hldClassicsInteractive?.includes(topic.id) ? "none" : "architecture";
  }
  if (cat === "hld-consistency") {
    if (topic.id === "cap-theorem") return "capTriangle";
    if (topic.id === "quorum") return "quorum";
    return "none";
  }
  if (cat === "hld-cache-strategies") return "none";
  if (cat === "hld-db-scaling") return topic.id === "consistent-hashing" ? "hashRing" : "none";
  if (cat === "hld-messaging-ops" || cat === "hld-reliability-patterns" || cat === "hld-performance") return "none";
  return "none";
}

function inferLldSim(topic, ov) {
  const cat = topic.category.id;
  if (ov.proseOnly?.includes(topic.id)) return "none";
  if (LLD_UML_CATEGORIES.has(cat)) {
    return ov.lldGoFInteractive?.includes(topic.id) ? "clickFlow" : "none";
  }
  if (cat === "lld-ddd" || cat === "lld-testing") return "none";
  if (cat === "lld-db") {
    if (ov.lldDbInteractive?.includes(topic.id)) {
      return ov.lldDbSimTypes?.[topic.id] || LLD_CATEGORY_SIM[cat];
    }
    return "none";
  }
  if (cat === "lld-dist-patterns") {
    return ov.lldDistPatternsInteractive?.includes(topic.id) ? "clickFlow" : "none";
  }
  if (cat === "lld-async") {
    return ov.lldAsyncInteractive?.includes(topic.id) ? "queue" : "none";
  }
  if (cat === "lld-concurrency") {
    return ov.lldConcurrencyInteractive?.includes(topic.id) ? "architecture" : "none";
  }
  if (cat === "lld-api") {
    return ov.lldApiInteractive?.includes(topic.id) ? "clickFlow" : "none";
  }
  return LLD_CATEGORY_SIM[cat] || "none";
}

function inferLldFigure(topic, ov) {
  const cat = topic.category.id;
  if (ov.proseOnly?.includes(topic.id)) return "none";
  if (LLD_UML_CATEGORIES.has(cat)) {
    return ov.lldGoFInteractive?.includes(topic.id) ? "umlClass" : "umlClass";
  }
  if (cat === "lld-ddd") return LLD_DDD_FIGURE;
  if (cat === "lld-testing") return "none";
  if (cat === "lld-db") {
    return ov.lldDbInteractive?.includes(topic.id) ? "none" : "er";
  }
  if (cat === "lld-dist-patterns") {
    return ov.lldDistPatternsInteractive?.includes(topic.id) ? "none" : "outboxFlow";
  }
  if (cat === "lld-async") {
    return ov.lldAsyncInteractive?.includes(topic.id) ? "none" : "messagingLoop";
  }
  if (cat === "lld-concurrency") {
    return ov.lldConcurrencyInteractive?.includes(topic.id) ? "none" : "architecture";
  }
  if (cat === "lld-api") {
    if (topic.id === "pagination-offset-cursor") return "comparison";
    return ov.lldApiInteractive?.includes(topic.id) ? "none" : "requestFlow";
  }
  if (cat === "lld-transactions") return topic.id === "two-pc" || topic.id === "three-pc" ? "twoPc" : "none";
  if (cat === "lld-dist-locks") return "none";
  if (cat === "lld-event-ordering") return topic.id === "lamport-clock" || topic.id === "vector-clock" ? "clock" : "none";
  if (cat === "lld-idempotency") return "none";
  if (cat === "lld-concurrency-strategies") return "comparison";
  if (cat === "lld-classics") return "none";
  return "none";
}

function inferFailures(topic) {
  const cat = topic.category.id;
  const sim = FAILURE_SIM[cat] || "race";
  const catFig = FAILURE_FIGURE[cat] || {};
  const figure = catFig[topic.id] || "none";
  return { sim, figure };
}

export function inferContentMapEntry(topic, ov = loadOverrides()) {
  if (GOLD.has(topic.id)) {
    const goldFigures = {
      "lost-update": "timeline", toctou: "timeline", dns: "none",
      singleton: "umlClass", "circuit-breaker": "stateMachine", "transactional-outbox": "outboxFlow",
    };
    const figure = goldFigures[topic.id] || "none";
    return {
      sim: goldSim(topic.id),
      figure,
      track: topic.track,
      category: topic.category.id,
      title: topic.title,
      priority: "gold",
    };
  }

  if (topic.track === "failures") {
    const { sim, figure } = inferFailures(topic);
    const entry = { sim, figure: figure === "none" ? "none" : figure, track: topic.track, category: topic.category.id, title: topic.title };
    if (topic.id === "circuit-breaker") entry.figure = "stateMachine";
    if (topic.id === "lost-update" || topic.id === "toctou") entry.figure = "timeline";
    return entry;
  }

  if (topic.track === "hld") {
    const sim = inferHldSim(topic, ov);
    let figure = inferHldFigure(topic, ov);
    const allowBoth = FIGURE_PLUS_SIM.has(topic.id) || ov.goldFigureSim?.includes(topic.id);
    if (sim !== "none" && figure !== "none" && !allowBoth) {
      figure = "none";
    }
    const entry = { sim, figure, track: topic.track, category: topic.category.id, title: topic.title };
    if (FIGURE_OPTS[topic.id]) entry.figureOpts = FIGURE_OPTS[topic.id];
    return entry;
  }

  if (topic.track === "lld") {
    const sim = inferLldSim(topic, ov);
    let figure = inferLldFigure(topic, ov);
    if (sim !== "none" && figure !== "none" && !ov.goldFigureSim?.includes(topic.id)) {
      if (topic.id === "singleton") figure = "umlClass";
      else figure = "none";
    }
    return { sim, figure, track: topic.track, category: topic.category.id, title: topic.title };
  }

  return { sim: "none", figure: "none", track: topic.track, category: topic.category.id, title: topic.title };
}

export function generateContentMap() {
  const ov = loadOverrides();
  const topics = {};
  for (const t of FLAT_TOPICS) {
    topics[t.id] = inferContentMapEntry(t, ov);
  }
  return { version: 1, topics };
}
