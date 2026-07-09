/**
 * One-shot generator for scripts/topic-relocation.json
 * Run: node scripts/gen-relocation-json.mjs
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BACKEND_CATEGORIES } from "../js/registry-backend.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const HLD_MOVES = {
  consistency: "hld-consistency",
  "db-scaling": "hld-db-scaling",
  performance: "hld-performance",
};

const HLD_TOPIC_MOVES = {
  "write-through": "hld-cache-strategies",
  "write-around": "hld-cache-strategies",
  "write-back": "hld-cache-strategies",
  "read-through": "hld-cache-strategies",
  "cache-aside": "hld-cache-strategies",
  "negative-cache": "hld-cache-strategies",
  "dead-letter-queue": "hld-messaging-ops",
  "visibility-timeout": "hld-messaging-ops",
  "consumer-rebalancing": "hld-messaging-ops",
  "exponential-backoff": "hld-reliability-patterns",
  "token-bucket": "hld-rate-limiting",
  "leaky-bucket": "hld-rate-limiting",
  "load-shedding": "hld-rate-limiting",
  "admission-control": "hld-rate-limiting",
  "hedged-requests": "hld-rate-limiting",
  "request-coalescing": "hld-rate-limiting",
  "shuffle-sharding": "hld-rate-limiting",
  "cell-architecture": "hld-rate-limiting",
  "sticky-sessions": "hld-rate-limiting",
  "adaptive-concurrency": "hld-rate-limiting",
  "gossip-protocols": "hld-rate-limiting",
  watermarking: "hld-rate-limiting",
};

const LLD_MOVES = {
  transactions: "lld-transactions",
  "dist-lock": "lld-dist-locks",
  ordering: "lld-event-ordering",
  idempotency: "lld-idempotency",
  "opt-pess": "lld-concurrency-strategies",
};

const FAILURES_PARTIAL = {
  retry: new Set([
    "retry-storm", "thundering-herd", "cache-stampede", "dogpile",
    "retry-amplification", "coordinated-omission",
  ]),
  messaging: new Set([
    "poison-message", "slow-consumer", "backpressure", "head-of-line-blocking",
  ]),
  cache: new Set([
    "cache-invalidation", "cache-consistency", "cache-pollution", "hot-key",
  ]),
  "prod-eng": new Set([
    "connection-pool-exhaustion", "ephemeral-port-exhaustion", "n-plus-one",
    "slow-query-amplification", "noisy-neighbor", "priority-queue-starvation",
  ]),
};

const STAY_CATS = new Set(["concurrency", "locking", "failure"]);

const topics = {};

for (const cat of BACKEND_CATEGORIES) {
  for (const t of cat.topics) {
    const oldCat = cat.id;
    let track;
    let category;

    if (STAY_CATS.has(cat.id)) {
      track = "failures";
      category = cat.id;
    } else if (HLD_MOVES[cat.id]) {
      track = "hld";
      category = HLD_MOVES[cat.id];
    } else if (LLD_MOVES[cat.id]) {
      track = "lld";
      category = LLD_MOVES[cat.id];
    } else if (HLD_TOPIC_MOVES[t.id]) {
      track = "hld";
      category = HLD_TOPIC_MOVES[t.id];
    } else if (FAILURES_PARTIAL[cat.id]?.has(t.id)) {
      track = "failures";
      category = cat.id;
    } else {
      throw new Error(`Unmapped topic: ${oldCat}/${t.id}`);
    }

    topics[t.id] = {
      track,
      category,
      oldCategory: oldCat,
      oldPath: `js/topics/${oldCat}/${t.id}.js`,
      newPath: `js/topics/${track}/${category}/${t.id}.js`,
      module: `./topics/${track}/${category}/${t.id}.js`,
    };
  }
}

const counts = { failures: 0, hld: 0, lld: 0 };
for (const m of Object.values(topics)) counts[m.track]++;

const out = {
  version: 1,
  description: "Phase 0 relocation — 114 backend topics → failures | hld | lld",
  counts,
  topics,
};

const outPath = join(ROOT, "scripts/topic-relocation.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(`Topics: ${Object.keys(topics).length} (failures ${counts.failures}, hld ${counts.hld}, lld ${counts.lld})`);
