// @article-v2
// @hld-gold
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "read-through", title: "Read Through", category: "cache" };

const READ_THROUGH_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Read-through cache">
  <defs><marker id="fig-read-through-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="22" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Read-through: app talks only to cache; cache loads DB on miss</text>
  <rect x="50" y="70" width="110" height="48" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="105" y="98" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">App</text>
  <rect x="280" y="60" width="160" height="68" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="360" y="88" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Cache library</text>
  <text x="360" y="106" text-anchor="middle" fill="#ffb454" font-size="9" font-family="system-ui">loader / read-through</text>
  <rect x="560" y="70" width="110" height="48" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="615" y="98" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">DB</text>
  <line x1="160" y1="94" x2="278" y2="94" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-through-arr)"/>
  <text x="215" y="84" fill="#5b9dff" font-size="10" font-family="system-ui">get(key)</text>
  <line x1="440" y1="94" x2="558" y2="94" stroke="#5b9dff" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#fig-read-through-arr)"/>
  <text x="495" y="84" fill="#93a1bd" font-size="10" font-family="system-ui">on miss</text>
  <text x="360" y="165" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">App never calls SELECT on the hot path — the cache owns miss handling</text>
  <text x="360" y="185" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Often paired with write-through in the same cache product</text>
</svg>`;

export const content = {
  oneliner: `The application only talks to the cache; on a miss the cache itself loads the database and fills the entry before returning.`,
  archetype: "concept",
  figures: [
    {
      id: "read-through-flow",
      svg: READ_THROUGH_SVG,
      caption: "Read-through hides the DB behind the cache API. Miss handling and population live in the cache layer / library, not scattered repository code.",
    },
  ],
  sections: [
    {
      title: "What is read-through?",
      body: `<p>In <b>cache-aside</b>, your service code does: check Redis → if miss, query Postgres → write Redis → return. Every team reimplements that dance, often differently.</p>
<p><b>Read-through</b> moves miss handling into the cache layer. The app calls something like <code>cache.get("wallet:42")</code>. On hit, Redis returns the value. On miss, a configured <b>loader</b> runs <code>SELECT</code>, stores the result, and returns it — the app never sees the miss.</p>
<p>You have used this idea if you met Hibernate second-level cache, Spring <code>@Cacheable</code> with a CacheLoader, Caffeine <code>LoadingCache</code>, or CDN origin fetch: the “cache” is responsible for filling itself.</p>`,
    },
    {
      title: "How it works end to end",
      figureAfter: "read-through-flow",
      body: `<pre>// application
Wallet w = walletCache.get(walletId);  // always this API

// inside read-through cache
function get(key):
  val = redis.GET(key)
  if val != null: return deserialize(val)
  with singleFlight(key):          // coalesce stampedes
    val = redis.GET(key)           // double-check
    if val != null: return deserialize(val)
    row = db.query("SELECT … WHERE id = ?", key)
    if row == null: storeNegative(key); return null
    redis.SET(key, serialize(row), EX=ttl)
    return row</pre>
<p><b>Single-flight / request coalescing</b> matters: without it, 5k concurrent misses for the same cold key stampede the DB. Read-through libraries often bake this in; hand-rolled cache-aside frequently forgets it.</p>
<p><b>Writes:</b> read-through alone does not define writes. Teams usually pair it with <b>write-through</b> (cache API updates DB + cache) or still invalidate via cache-aside on write. Mixing “read-through reads” with “forgotten invalidations” produces classic stale bugs.</p>`,
    },
    {
      title: "Read-through vs cache-aside",
      body: `<p>Both can hit the same Redis. The difference is <b>who owns the miss path</b>.</p>
<ul>
<li><b>Cache-aside</b> — full control in app code; easy to customize per endpoint; easy to diverge across services.</li>
<li><b>Read-through</b> — one loader policy; harder to special-case; great when many call sites need the same entity.</li>
</ul>
<p>Example: twenty microservices need merchant config. A shared read-through library with one loader prevents twenty slightly wrong TTL/invalidation implementations.</p>
<p>Latency: first miss pays DB + SET (same as cache-aside). Subsequent hits are identical. The win is consistency of behavior and stampede protection, not magic speed.</p>`,
    },
    {
      title: "HLD placement and production notes",
      body: `<p>Put read-through in a <b>shared client library</b> or sidecar used by Order Service, Payment Gateway, and risk workers for reference data (FX rates, merchant flags, product catalog snippets).</p>
<p>Keep the loader <b>idempotent and cheap</b>: parameterized SQL, timeouts, and circuit breakers around the DB. If the loader hangs, every miss blocks an app thread — you have moved the failure mode into the cache API.</p>
<p>Observability: expose <code>hit</code>, <code>miss</code>, <code>load_success</code>, <code>load_error</code>, <code>load_latency</code>. A rising <code>load_error</code> rate is a DB incident showing up as cache failures.</p>
<p>Negative caching (separate topic) often ships inside the same read-through loader: cache “missing merchant” for 30s so bots probing bad IDs do not melt Postgres.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Describing read-through but drawing cache-aside boxes (app calling DB directly on miss).</li>
<li>No stampede control on the loader.</li>
<li>No write/invalidation story — “reads are through cache” is incomplete.</li>
<li>Loader without timeouts — miss path becomes an unbounded DB queue.</li>
</ul>`,
    },
  ],
  related: ["cache-aside", "write-through", "negative-cache", "cache-stampede", "request-coalescing"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("read-through", stage, panel, stageEl);
}
