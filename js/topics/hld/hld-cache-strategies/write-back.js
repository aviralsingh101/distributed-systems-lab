// @article-v2
// @hld-gold
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "write-back", title: "Write Back", category: "cache" };

const WRITE_BACK_SVG = `<svg viewBox="0 0 720 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Write-back cache flush">
  <defs><marker id="fig-write-back-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="20" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Write-back (write-behind): ack from cache, flush to DB asynchronously</text>
  <rect x="40" y="55" width="100" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="90" y="82" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Client</text>
  <rect x="220" y="55" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="280" y="75" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Cache</text>
  <text x="280" y="90" text-anchor="middle" fill="#ffb454" font-size="9" font-family="system-ui">dirty buffer</text>
  <rect x="420" y="55" width="100" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="470" y="82" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Flusher</text>
  <rect x="560" y="55" width="110" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="615" y="82" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">DB</text>
  <line x1="140" y1="77" x2="218" y2="77" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-write-back-arr)"/>
  <text x="175" y="68" fill="#3ddc97" font-size="9" font-family="system-ui">WRITE ack</text>
  <line x1="340" y1="77" x2="418" y2="77" stroke="#5b9dff" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#fig-write-back-arr)"/>
  <text x="375" y="68" fill="#5b9dff" font-size="9" font-family="system-ui">async</text>
  <line x1="520" y1="77" x2="558" y2="77" stroke="#5b9dff" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#fig-write-back-arr)"/>
  <rect x="200" y="130" width="320" height="50" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.2"/>
  <text x="360" y="152" text-anchor="middle" fill="#ff5c6c" font-size="11" font-family="system-ui">Crash before flush = lost writes unless WAL / mirrored dirty set</text>
  <text x="360" y="170" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Use only when durability is optional or protected by battery-backed / replicated cache</text>
</svg>`;

export const content = {
  oneliner: `Writes land in the cache first and return success; a background flusher eventually persists them to the database.`,
  archetype: "concept",
  figures: [
    {
      id: "write-back-flow",
      svg: WRITE_BACK_SVG,
      caption: "Write-back acknowledges from the cache (fast), then a flusher drains dirty entries to Postgres. Durability depends on surviving until flush.",
    },
  ],
  sections: [
    {
      title: "What is write-back (write-behind)?",
      body: `<p>Most application caches are <b>look-aside</b>: the database is the source of truth. <b>Write-back</b> (also called write-behind) inverts that for a moment — the cache becomes a <em>write buffer</em>.</p>
<p>When the client writes, you update Redis (or an in-process cache) immediately and return 200. A flusher thread, queue consumer, or cache product later batches those dirty keys into Postgres. Reads hit the cache and see the latest value even before the DB catches up.</p>
<p>Hardware CPU caches do this for decades; distributed systems copy the idea for throughput. The catch is brutal: if the cache node dies with dirty data unflushed, those writes vanish unless you engineered durability around the buffer.</p>`,
    },
    {
      title: "Mechanics and a concrete flow",
      figureAfter: "write-back-flow",
      body: `<p>Sketch for a high-volume counter (page views, not money):</p>
<pre>// request path — must be fast
INCR views:{article_id}          // Redis, mark key dirty
return 200

// flusher every 100ms or 1000 dirty keys
PIPELINED:
  for each dirty key:
    GET views:{id} → n
    UPDATE articles SET views = n WHERE id = ...
  clear dirty flags</pre>
<p>Batching turns 50k Redis increments/s into ~500 SQL updates/s. That is the whole point.</p>
<p>For <b>wallet balances</b>, write-back is usually the wrong tool: finance needs the ledger durable before you tell the user “paid.” Prefer DB-first (cache-aside invalidate) or a proper queue with at-least-once consumers and idempotent upserts — that is “async persistence,” not classic write-back that acks from RAM alone.</p>
<p>If you still need write-behind for durable data, the dirty set must live on replicated storage (Redis AOF/RDB with sync, or a Kafka log of mutations) so a single node crash does not erase money movement.</p>`,
    },
    {
      title: "Failure modes you must design for",
      body: `<ul>
<li><b>Cache crash</b> — dirty entries gone. Mitigate: AOF <code>everysec</code>/<code>always</code>, replica promotion, or dual-write dirty keys to a queue before ack.</li>
<li><b>Flush lag</b> — DB shows old values for analytics, backups, or other services reading Postgres directly. Document the lag SLO (e.g. &lt; 1s) and never let unpaid side effects read the DB as truth.</li>
<li><b>Reorder / partial flush</b> — two fields on one entity flushed out of order. Use version numbers or flush whole object snapshots.</li>
<li><b>Poison key</b> — one UPDATE fails forever, blocking the flusher. Dead-letter dirty keys; isolate bad rows.</li>
</ul>
<p><b>Read-your-writes:</b> clients that read from the cache are fine. Clients or jobs that read from the DB must tolerate lag or be routed to the cache / a read-your-writes sticky path.</p>`,
    },
    {
      title: "HLD placement and tradeoffs",
      body: `<p><b>Pros:</b> huge write throughput; smooths spikes into steady DB load; excellent for aggregations and metrics.</p>
<p><b>Cons:</b> durability risk; operational complexity; harder multi-writer consistency; backups of DB alone are incomplete.</p>
<p><b>Place write-back behind:</b> analytics counters, feed ranking signals, session touch timestamps — data you can afford to lose a few seconds of, or that you protect with a durable log.</p>
<p><b>Do not place write-back on:</b> payments, inventory reservations, auth permission grants — anything where “I told the user yes” must match durable state.</p>
<p>Interview framing: draw Client → Cache (ack) → async Flusher → DB, then circle the crash window and say what you lose. That one sentence separates a senior answer from “we’ll use Redis.”</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Proposing write-back for payment ledger without a durability story.</li>
<li>Ignoring other readers of the DB that see stale data during flush lag.</li>
<li>No dirty-set size limits — memory blowup under write storm.</li>
<li>Confusing write-back with write-through (write-through waits for DB before ack).</li>
</ul>`,
    },
  ],
  related: ["write-through", "write-around", "cache-aside", "cache-consistency", "db-cache-dual-write"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("write-back", stage, panel, stageEl);
}
