/**
 * Append relocated backend topics to registry-hld.js and registry-lld.js
 * Run: node scripts/append-hld-lld-registries.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BACKEND_CATEGORIES } from "../js/registry-backend.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { topics } = JSON.parse(readFileSync(join(ROOT, "scripts/topic-relocation.json"), "utf8"));

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

function topicList(track, categoryId) {
  const out = [];
  for (const cat of BACKEND_CATEGORIES) {
    for (const t of cat.topics) {
      const m = topics[t.id];
      if (m.track === track && m.category === categoryId) out.push(t);
    }
  }
  return out;
}

function fmtTopic(t) {
  return `      {
        "id": "${t.id}",
        "title": "${t.title}",
        "blurb": "${t.blurb}",
        "tier": "essential",
        "related": []
      }`;
}

function fmtCategory(cat, track) {
  const list = topicList(track, cat.id);
  const topicsStr = list.map(fmtTopic).join(",\n");
  return `  {
    "id": "${cat.id}",
    "num": ${cat.num},
    "title": "${cat.title}",
    "desc": "${cat.desc}",
    "topics": [
${topicsStr}
    ],
    "track": "${track}"
  }`;
}

function appendToRegistry(file, newCats, track) {
  let src = readFileSync(join(ROOT, file), "utf8");
  const append = newCats.map((c) => fmtCategory(c, track)).join(",\n");
  src = src.replace(/\n];[\s]*$/, `,\n${append}\n];`);
  writeFileSync(join(ROOT, file), src);
  console.log(`Appended ${newCats.length} categories to ${file}`);
}

appendToRegistry("js/registry-hld.js", HLD_NEW_CATS, "hld");
appendToRegistry("js/registry-lld.js", LLD_NEW_CATS, "lld");
