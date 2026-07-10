/**
 * Print subagent mandate for deep HLD article rewrites.
 * Run: node scripts/run-hld-deep-wave.mjs [--category=hld-classics]
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cat = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1];
const topics = FLAT_TOPICS.filter((t) => t.track === "hld" && (!cat || t.category.id === cat));

const gold = [
  "hld-classics/rate-limiter-service.js",
  "hld-classics/url-shortener.js",
  "hld-tradeoffs/rate-limit-algorithms.js",
  "hld-rate-limiting/token-bucket.js",
  "hld-rate-limiting/leaky-bucket.js",
  "hld-blocks/edge-rate-limiting.js",
  "hld-blocks/reverse-proxy.js",
  "hld-networking/dns.js",
  "hld-cache-strategies/cache-aside.js",
  "hld-cache-strategies/write-through.js",
];

console.log(`# HLD deep rewrite wave${cat ? `: ${cat}` : ""}\n`);
console.log("Gold references:", gold.join(", "));
console.log(`
Each topic needs:
- Functional requirements specific to the system
- Capacity math (QPS, storage)
- High-level design with named components + flow diagram
- Deep dives: algorithms, APIs, schemas, partitioning
- Bottlenecks / failure modes
- Short interview pitfalls section at END only
- // @hld-gold marker
- 400+ words of technical content; pseudocode/config where relevant
`);

let pending = 0;
for (const t of topics) {
  const path = join(ROOT, "js", t.module.replace(/^\.\//, ""));
  if (!existsSync(path)) continue;
  const raw = readFileSync(path, "utf8");
  if (raw.includes("@hld-gold")) continue;
  console.log(`- ${t.id} — ${t.title} (${t.category.id})`);
  pending++;
}
console.log(`\n${pending} topic(s) pending deep rewrite.`);
