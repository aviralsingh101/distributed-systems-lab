// @article-v2
// @hld-gold
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "negative-cache", title: "Negative Cache", category: "cache" };

const NEGATIVE_CACHE_SVG = `<svg viewBox="0 0 720 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Negative caching stops repeat DB lookups">
  <defs><marker id="fig-negative-cache-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="20" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Without negative cache: repeated misses hammer DB for missing keys</text>
  <rect x="30" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="75" y="70" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Bots</text>
  <rect x="160" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="205" y="70" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API</text>
  <rect x="290" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="335" y="70" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB</text>
  <line x1="120" y1="65" x2="158" y2="65" stroke="#ff5c6c" stroke-width="1.2" marker-end="url(#fig-negative-cache-arr)"/>
  <line x1="250" y1="65" x2="288" y2="65" stroke="#ff5c6c" stroke-width="1.2" marker-end="url(#fig-negative-cache-arr)"/>
  <text x="205" y="100" text-anchor="middle" fill="#ff5c6c" font-size="10" font-family="system-ui">10k × SELECT … NOT FOUND</text>
  <text x="360" y="125" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">With negative cache: store a tombstone for "missing"</text>
  <rect x="160" y="145" width="100" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="210" y="162" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Redis</text>
  <text x="210" y="176" text-anchor="middle" fill="#ffb454" font-size="9" font-family="system-ui">nil:wallet:999</text>
  <rect x="320" y="145" width="100" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="370" y="170" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">404 fast</text>
  <line x1="260" y1="165" x2="318" y2="165" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-negative-cache-arr)"/>
  <text x="520" y="170" fill="#93a1bd" font-size="10" font-family="system-ui">short TTL (5–60s)</text>
</svg>`;

export const content = {
  oneliner: `Cache the fact that a key does not exist so repeated lookups for missing data do not hammer the database.`,
  archetype: "concept",
  figures: [
    {
      id: "negative-cache-flow",
      svg: NEGATIVE_CACHE_SVG,
      caption: "Negative caching stores a short-lived “not found” marker so scanners and retries stop issuing identical SELECTs against empty results.",
    },
  ],
  sections: [
    {
      title: "What is a negative cache?",
      body: `<p>Normal caches store <em>values</em>. A <b>negative cache</b> stores the knowledge that there is <em>no value</em> — a tombstone for “not found.”</p>
<p>Why bother? Lookups for missing keys are often the hottest path under attack or bad clients: guessing wallet IDs, probing deleted users, retrying a failed create with the wrong id. Without a negative cache, every attempt is a Redis miss <em>and</em> a Postgres <code>SELECT</code> that returns zero rows — cheap individually, lethal at 10k QPS.</p>
<p>DNS resolvers have done this for decades (NXDOMAIN caching). Application caches should too whenever “absence” is a common, expensive answer.</p>`,
    },
    {
      title: "How to implement it",
      figureAfter: "negative-cache-flow",
      body: `<pre>function getWallet(id):
  raw = redis.GET("wallet:" + id)
  if raw == "\\0":           // sentinel = negative hit
    return NOT_FOUND
  if raw != null:
    return jsonDecode(raw)

  row = db.query("SELECT … WHERE id = ?", id)
  if row == null:
    redis.SET("wallet:" + id, "\\0", EX=30)   // negative, short TTL
    return NOT_FOUND

  redis.SET("wallet:" + id, jsonEncode(row), EX=300)
  return row</pre>
<p>Use a <b>distinct sentinel</b> (special byte, separate key prefix <code>neg:wallet:id</code>, or Redis hash field) so you never confuse “cached empty string” with “missing.” Document the convention in one helper.</p>
<p><b>TTL must be short</b> — 5–60 seconds is common. A long negative TTL delays visibility when the row is created a moment later (user signed up; wallet provisioned). On create/upsert, <code>DEL</code> both the positive and negative keys.</p>
<p>Pair with <b>single-flight</b> on the first miss so 1k concurrent “is wallet 999 real?” probes issue one SELECT, then all see the negative entry.</p>`,
    },
    {
      title: "Where it fits in HLD",
      body: `<p>Negative caching belongs on any public or partner API that accepts client-supplied IDs: get payment by id, get invoice PDF, resolve short links. It is less critical for internal IDs that only your services mint and always exist.</p>
<p>Capacity example: 8k QPS of 404 probes × 2 ms DB time ≈ 16 cores busy returning emptiness. With a 30s negative TTL and good key cardinality, almost all of that becomes sub-millisecond Redis hits.</p>
<p>CDN / edge: the same idea appears as caching 404 responses for static paths. At the app layer you cache the <em>domain fact</em>, not necessarily the HTTP response body.</p>
<p>Security note: negative caching does not replace rate limits. It reduces DB cost of probes; you still need IP/API-key throttling so attackers cannot inflate Redis with endless unique missing keys (use bloom filters or capped cardinality if that is a threat).</p>`,
    },
    {
      title: "Tradeoffs and edge cases",
      body: `<ul>
<li><b>Create races:</b> request A caches negative; request B creates the row; request A still 404 until TTL or explicit invalidation on create.</li>
<li><b>Soft deletes:</b> “missing” vs “deleted” may need different sentinels if clients should see 410 Gone vs 404.</li>
<li><b>Memory:</b> unique missing keys can still fill Redis — prefer short TTL + maxmemory eviction; consider a Bloom filter of known IDs for extreme cases.</li>
<li><b>vs only TTL on positive keys:</b> positive TTL does not help when the row never existed.</li>
</ul>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Caching misses with the same TTL as hits — new creates look missing for minutes.</li>
<li>Forgetting to invalidate negative entries on create.</li>
<li>Using empty JSON <code>{}</code> as sentinel and later treating it as a real object.</li>
<li>Relying on negative cache alone against bots without rate limits.</li>
</ul>`,
    },
  ],
  related: ["read-through", "cache-aside", "cache-stampede", "cache-invalidation", "request-coalescing"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("negative-cache", stage, panel, stageEl);
}
