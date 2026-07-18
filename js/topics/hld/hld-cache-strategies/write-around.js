// @article-v2
// @hld-gold
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "write-around", title: "Write Around", category: "cache" };

const WRITE_AROUND_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Write-around: write skips cache">
  <defs><marker id="fig-write-around-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="22" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Write-around: write goes to DB only; cache fills on later read</text>
  <rect x="40" y="50" width="100" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="90" y="77" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">App</text>
  <rect x="280" y="40" width="110" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="335" y="67" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Redis</text>
  <rect x="520" y="50" width="110" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="575" y="77" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Postgres</text>
  <line x1="140" y1="72" x2="518" y2="72" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-write-around-arr)"/>
  <text x="330" y="64" text-anchor="middle" fill="#5b9dff" font-size="10" font-family="system-ui">WRITE (skip cache)</text>
  <line x1="140" y1="120" x2="278" y2="84" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#fig-write-around-arr)"/>
  <text x="180" y="118" fill="#93a1bd" font-size="10" font-family="system-ui">later READ miss</text>
  <line x1="390" y1="84" x2="518" y2="84" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#fig-write-around-arr)"/>
  <text x="450" y="102" fill="#93a1bd" font-size="10" font-family="system-ui">load + SET</text>
  <text x="360" y="165" text-anchor="middle" fill="#ffb454" font-size="11" font-family="system-ui">Best for write-heavy, rarely-read data (audit rows, one-shot tokens)</text>
  <text x="360" y="185" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Tradeoff: first read after write always pays a DB round-trip</text>
</svg>`;

export const content = {
  oneliner: `Writes go straight to the database and leave the cache alone; the next read miss loads fresh data into Redis.`,
  archetype: "concept",
  figures: [
    {
      id: "write-around-flow",
      svg: WRITE_AROUND_SVG,
      caption: "Write-around: the write path never touches Redis. Cache is populated lazily when something actually reads the key.",
    },
  ],
  sections: [
    {
      title: "What is write-around?",
      body: `<p>Imagine your payment platform logs every ledger mutation. Those rows are written constantly and almost never read again — until someone opens an audit trail weeks later. If you use <b>write-through</b>, every insert also writes Redis: you pay cache latency and fill memory with data nobody will hit.</p>
<p><b>Write-around</b> flips that: on write, update <b>only the database</b>. Do not <code>SET</code> or even <code>DEL</code> the cache entry as part of the success path (or, if an old entry might exist, invalidate — but do not populate). The cache learns about the new value the first time a reader asks for it and misses.</p>
<p>Think of Redis as a <em>reading room</em>, not a filing cabinet. Write-around puts new documents in the archive (Postgres) and only photocopies them into the reading room when someone requests them.</p>`,
    },
    {
      title: "How the write and read paths work",
      figureAfter: "write-around-flow",
      body: `<p><b>Write path</b> (e.g. append audit event):</p>
<pre>BEGIN;
  INSERT INTO ledger_events (payment_id, payload, created_at) VALUES (...);
COMMIT;
-- no Redis SET
return 201</pre>
<p><b>Read path</b> (rare audit lookup):</p>
<pre>GET audit:payment:9912 from Redis
  → HIT: return cached JSON
  → MISS:
       SELECT * FROM ledger_events WHERE payment_id = 9912
       SET audit:payment:9912 JSON EX 600
       return rows</pre>
<p>If a <em>previous</em> version of the key might still sit in Redis (you used to cache this entity), prefer <code>DEL</code> after the DB commit so readers never see a stale pre-write snapshot. That is still write-around: you are clearing, not updating, the cache on write.</p>
<p>Compared to <b>cache-aside</b>: cache-aside also lets the app own logic, but typically <em>invalidates</em> on every write of hot entities. Write-around is the specialization for “we don’t expect a read soon, so don’t bother warming or even touching cache on the write path.”</p>`,
    },
    {
      title: "When write-around wins (and when it hurts)",
      body: `<p><b>Use write-around when:</b></p>
<ul>
<li>Write:read ratio is high (telemetry, append-only logs, one-time OTP records).</li>
<li>Values are large and would thrash Redis if written eagerly.</li>
<li>Reads are optional or delayed (ops dashboards, compliance export).</li>
</ul>
<p><b>Avoid write-around when:</b></p>
<ul>
<li>The client immediately reads what it wrote (wallet balance after debit) — the next GET will miss and add latency right when UX feels slowest.</li>
<li>You need read-your-writes across instances without sticky routing — a miss is fine, but a lingering stale hit after a partial invalidation is not.</li>
</ul>
<p><b>Capacity sketch:</b> 20k ledger inserts/s with write-through at 0.3 ms Redis RTT burns ~6 CPU-seconds of wait per second on the write fleet, plus memory. Write-around removes that cost; the rare audit read pays one Postgres query (~2–5 ms) and then caches for minutes.</p>`,
    },
    {
      title: "HLD placement in a payment system",
      body: `<p>Place write-around on <b>cold / write-dominated</b> stores: ledger event tables, webhook delivery logs, idempotency-key tombstones after expiry windows. Keep <b>cache-aside or write-through</b> for hot path entities (wallet balance, session, FX rates).</p>
<p>In a diagram, draw two arrows from Order Service: a solid line to Postgres for writes, and a separate dashed loop App → Redis → Postgres only on read miss. Interviewers look for that split — one cache policy for the whole system is a red flag.</p>
<p>Operationally: monitor <code>cache_miss_rate</code> per key prefix. A sudden miss spike on a “write-around” prefix after a product change (UI started polling) means you should switch that entity to cache-aside/write-through.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Saying “we cache everything write-through” for audit logs — wastes Redis and write latency.</li>
<li>Forgetting that the <b>first read after write</b> is always a miss — bad for “update then redirect to detail page.”</li>
<li>Leaving an old cached value without <code>DEL</code> when the key schema used to be cached.</li>
<li>Confusing write-around with write-back (write-back writes cache <em>first</em> and risks data loss).</li>
</ul>`,
    },
  ],
  related: ["cache-aside", "write-through", "write-back", "cache-invalidation", "cache-consistency"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("write-around", stage, panel, stageEl);
}
