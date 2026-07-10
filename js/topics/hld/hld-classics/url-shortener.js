// @article-v2
// @sim-lab
// @hld-gold
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const URL_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="URL shortener architecture">
  <defs><marker id="fig-url-shortener-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="60" width="70" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <rect x="110" y="60" width="90" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="2"/>
  <text x="155" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Redirect Svc</text>
  <rect x="230" y="45" width="80" height="30" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="270" y="64" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Redis cache</text>
  <rect x="230" y="85" width="80" height="30" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="270" y="104" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">SQL store</text>
  <rect x="340" y="35" width="90" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="385" y="53" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Create API</text>
  <rect x="340" y="95" width="90" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="385" y="113" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">ID generator</text>
  <rect x="460" y="60" width="100" height="36" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/>
  <text x="510" y="82" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Analytics (async)</text>
  <line x1="90" y1="78" x2="108" y2="78" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-url-shortener-arr)"/>
  <line x1="200" y1="78" x2="228" y2="60" stroke="#ffb454" stroke-width="1.5" marker-end="url(#fig-url-shortener-arr)"/>
  <line x1="200" y1="78" x2="228" y2="100" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-url-shortener-arr)"/>
  <text x="360" y="155" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Read path: GET /abc123 → cache → 302 (100:1 read:write)</text>
</svg>`;

const topic = makeTopic({
  id: "url-shortener",
  title: "URL Shortener",
  category: "hld-classics",
  track: "hld",
  tier: "essential",
  archetype: "classic",
  oneliner: "Map short codes to long URLs — optimize for massive read-heavy redirect traffic with minimal write path latency.",
  sections: [
    {
      title: "Functional requirements",
      body: `<ul>
<li><b>Create:</b> accept long URL, return short code (e.g. <code>https://go.co/abc12X</code>). Optional custom alias.</li>
<li><b>Redirect:</b> <code>GET /{code}</code> → HTTP 301 (permanent) or 302 (temporary) to long URL.</li>
<li><b>Analytics (optional):</b> click count, referrer, geo — async, must not slow redirect.</li>
<li><b>Expiration:</b> TTL on mappings; abuse reporting.</li>
</ul>
<p><b>Scale assumption:</b> read:write ≈ <b>100:1</b> (redirects dominate). Redirect latency target &lt; 50ms p99.</p>`,
    },
    {
      title: "Capacity estimation",
      body: `<p>100M new URLs/month, 5-year retention → 6B rows. Avg long URL 500 bytes → ~3TB raw URL storage (compresses well).</p>
<p>Redirect QPS: 100M DAU × 10 redirects/day ÷ 86400 ≈ <b>12k RPS</b> average, <b>60k RPS</b> peak.</p>
<p>Cache: 20% of codes get 80% of traffic (Pareto). Cache top 20M hot codes in Redis (~2GB).</p>`,
    },
    {
      title: "High-level design",
      figureAfter: "url-arch",
      body: `<p><b>Separate read and write paths:</b></p>
<ol>
<li><b>Create API</b> (write) — validate URL, generate ID, insert DB, warm cache.</li>
<li><b>Redirect service</b> (read) — stateless, horizontally scaled, cache-first.</li>
<li><b>SQL / NoSQL store</b> — durable mapping <code>short_code → long_url, user_id, created_at, expires_at</code>.</li>
<li><b>Redis cache</b> — hot mappings; cache-aside on read miss.</li>
<li><b>Analytics pipeline</b> — redirect service fires async event (Kafka); never blocks 302.</li>
</ol>`,
    },
    {
      title: "ID generation — key design decision",
      body: `<p><b>Option 1: Base62 counter (Snowflake / DB sequence)</b></p>
<ul><li>Pros: no collisions, short codes, sortable by time.</li><li>Cons: reveals volume; single ID generator can be bottleneck — use range allocation per server (server 1 gets 1–1M, server 2 gets 1M–2M).</li></ul>
<p><b>Option 2: MD5/SHA hash of URL + truncate</b></p>
<ul><li>Pros: same long URL → same short URL (dedup free).</li><li>Cons: collisions — must check DB and rehash with salt on collision.</li></ul>
<p><b>Option 3: Random 7-char base62</b> — 62^7 ≈ 3.5 trillion space; collision probability low until billions of URLs. Retry on unique constraint violation.</p>
<p>Interview answer: start with <b>base62 counter + range allocator</b> for simplicity; add hash dedup if storage cost matters.</p>`,
    },
    {
      title: "Redirect path (hot path)",
      body: `<pre>GET /abc12X:
  code = path_param
  url = redis.get("u:" + code)
  if url: return 302 Location: url
  row = db.query("SELECT long_url FROM urls WHERE code=?", code)
  if row: redis.setex("u:"+code, 3600, row.long_url); return 302
  else: return 404</pre>
<p>Use <b>301</b> if mapping is immutable (browser caches — reduces repeat hits). <b>302</b> if you need analytics accuracy or mutable targets.</p>
<p>CDN can cache 301 responses at edge for celebrity links — further reduces origin load.</p>`,
    },
    {
      title: "Database schema & scaling",
      body: `<pre>urls (
  code        VARCHAR(10) PRIMARY KEY,
  long_url    TEXT NOT NULL,
  user_id     BIGINT,
  created_at  TIMESTAMP,
  expires_at  TIMESTAMP NULL,
  INDEX (user_id)
)</pre>
<p>Shard by <code>code</code> hash when single Postgres exceeds write ceiling. Reads follow redirects to any shard via consistent hashing on code.</p>
<p>Or use DynamoDB / Cassandra with <code>code</code> as partition key — natural fit for key-value access pattern.</p>`,
    },
    {
      title: "Bottlenecks & failure modes",
      body: `<ul>
<li><b>Hot URLs</b> — viral link melts one cache key; replicate hot key across Redis nodes or local LRU in redirect pod.</li>
<li><b>Cache stampede</b> on expiry — single-flight refresh or probabilistic early expiration.</li>
<li><b>ID generator SPOF</b> — range allocation from DB <code>sequences</code> table with row lock per range.</li>
<li><b>Malicious long URLs</b> — scan for phishing; rate-limit create API per user.</li>
</ul>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>No read/write split — treating create and redirect as same service tier.</li>
<li>Hash-only IDs without collision handling.</li>
<li>Blocking redirect on analytics write.</li>
<li>Forgetting 301 vs 302 tradeoff.</li>
</ul>`,
    },
  ],
  figures: [
    { id: "url-arch", svg: URL_SVG, caption: "Write path through Create API + ID generator; read path through Redirect service with Redis cache-first and async analytics." },
  ],
  related: ["rate-limiter-service", "cdn", "cache-aside", "consistent-hashing"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("url-shortener", stage, panel, stageEl);
}
