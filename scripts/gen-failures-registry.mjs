/**
 * Generate registry-failures.js and append blocks for HLD/LLD registries.
 * Run: node scripts/gen-failures-registry.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BACKEND_CATEGORIES } from "../js/registry-backend.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const map = JSON.parse(
  readFileSync(join(ROOT, "scripts/topic-relocation.json"), "utf8")
);

const { topics } = map;

function topicsForTrackCategory(track, categoryId) {
  const out = [];
  for (const cat of BACKEND_CATEGORIES) {
    for (const t of cat.topics) {
      const m = topics[t.id];
      if (m.track === track && m.category === categoryId) {
        out.push({ ...t });
      }
    }
  }
  return out;
}

const FAILURES_CAT_ORDER = [
  { id: "concurrency", num: 1, title: "Concurrency & Race Conditions", desc: "Two requests touch the same wallet at once and money goes missing." },
  { id: "locking", num: 2, title: "Locking Problems", desc: "Locks protect the wallet but create their own failure modes." },
  { id: "retry", num: 3, title: "Retry Problems", desc: "The pay endpoint slows down and retries make it worse." },
  { id: "cache", num: 4, title: "Cache Problems", desc: "Caching the wallet balance and keeping it correct." },
  { id: "messaging", num: 5, title: "Messaging Failures", desc: "Payment events on a queue and everything that jams it." },
  { id: "failure", num: 6, title: "Failure Handling", desc: "The payment gateway degrades and you contain the blast." },
  { id: "prod-eng", num: 7, title: "Production Engineering Failures", desc: "Operating the payment platform at scale — when things break." },
];

const HLD_NEW_CATS = [
  { id: "hld-consistency", num: 11, title: "Consistency Models", desc: "How fresh a balance read is across replicas." },
  { id: "hld-db-scaling", num: 12, title: "Database Scaling", desc: "Sharding wallets and the skew that follows." },
  { id: "hld-performance", num: 13, title: "Performance & Capacity", desc: "Where latency hides in the payment path." },
  { id: "hld-cache-strategies", num: 14, title: "Cache Strategies", desc: "Write/read patterns for keeping cache correct." },
  { id: "hld-rate-limiting", num: 15, title: "Rate Limiting & Traffic Control", desc: "Operating the payment platform at scale." },
  { id: "hld-messaging-ops", num: 16, title: "Messaging Operations", desc: "Queue mechanics for reliable event delivery." },
  { id: "hld-reliability-patterns", num: 17, title: "Reliability Patterns", desc: "Backoff, jitter, and coordinated retry design." },
];

const LLD_NEW_CATS = [
  { id: "lld-transactions", num: 13, title: "Transactions", desc: "Ordering a purchase: reserve stock, charge wallet, ship." },
  { id: "lld-dist-locks", num: 14, title: "Distributed Locking", desc: "Locks across machines while settling a single payment." },
  { id: "lld-event-ordering", num: 15, title: "Event Ordering", desc: "Payment events arrive out of order, duplicated, or missing." },
  { id: "lld-idempotency", num: 16, title: "Idempotency", desc: "A retried POST /pay must not charge the wallet twice." },
  { id: "lld-concurrency-strategies", num: 17, title: "Concurrency Strategies", desc: "Optimistic vs pessimistic guarding under contention." },
];

function fmtCat(cat, track) {
  const topicList = topicsForTrackCategory(track, cat.id);
  const topicsStr = topicList
    .map((t) => `      { id: "${t.id}", title: "${t.title}", blurb: "${t.blurb}" },`)
    .join("\n");
  return `  {
    id: "${cat.id}", num: ${cat.num}, title: "${cat.title}",
    desc: "${cat.desc}",
    topics: [
${topicsStr}
    ],
  }`;
}

const failuresBody = FAILURES_CAT_ORDER.map((c) => fmtCat(c, "failures")).join(",\n");

const failuresFile = `/**
 * Production Failures track — failure modes and production depth.
 * Each topic module lives at ./topics/failures/<category.id>/<topic.id>.js
 */
export const FAILURES_CATEGORIES = [
${failuresBody},
];
`;

writeFileSync(join(ROOT, "js/registry-failures.js"), failuresFile);
console.log("Wrote js/registry-failures.js");

// Print HLD/LLD append blocks for manual merge
const hldAppend = HLD_NEW_CATS.map((c) => fmtCat(c, "hld")).join(",\n");
const lldAppend = LLD_NEW_CATS.map((c) => fmtCat(c, "lld")).join(",\n");

console.log("\n--- HLD categories to append ---");
console.log(hldAppend);
console.log("\n--- LLD categories to append ---");
console.log(lldAppend);
