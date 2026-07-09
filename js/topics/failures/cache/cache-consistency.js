// @article-v2
// @sim-lab
// @figure-handcrafted
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "cache-consistency", title: "Cache Consistency", category: "cache" };

export const content = {
  oneliner: `DB write succeeds but cache update fails — readers see stale values until TTL expires or someone repairs the cache.`,
  archetype: "failure",
  sections: [
    {
      title: "Symptom",
      body: `<p>A customer debits their wallet successfully. The API returns <code>200 OK</code>. A second later, <code>GET /v1/wallets/{id}/balance</code> still shows the old balance. Support sees "money disappeared" tickets even though Ledger rows are correct.</p>
<p>Metrics: cache hit rate stays high (bad sign here), stale-read counters or reconciliation drift between Redis and Postgres, spike in "balance mismatch" alerts from nightly jobs comparing cache snapshots to DB truth.</p>`,
    },
    {
      title: "Root cause — the DB + cache dual-write problem",
      body: `<p>The application performs <b>two independent writes</b> with no shared transaction:</p>
<ol>
<li><code>UPDATE wallets SET balance = balance - 50 WHERE id = ?</code> — commits in Postgres</li>
<li><code>DEL wallet:42</code> or <code>SET wallet:42 '{"balance":450}'</code> — best-effort in Redis</li>
</ol>
<p>Postgres and Redis do not participate in one ACID boundary. There is no two-phase commit that spans both. If step 1 succeeds and step 2 fails (Redis timeout, network blip, wrong key, rate limit), the system enters a <b>split-brain window</b>: DB is authoritative and correct; cache is wrong but still served on hits.</p>
<p>This is the same <em>dual-write</em> class of bug as "commit DB then publish to Kafka" — except the second system is a cache, not a message broker. See <b>DB + Cache Dual Write</b> and <b>Transactional Outbox</b> for structured fixes.</p>`,
    },
    {
      title: "How the failure unfolds",
      figureAfter: "dual-write-timeline",
      body: `<pre>T0  Client POST /debit  $50
T1  App → DB: UPDATE balance 500 → 450     ✅ COMMIT
T2  App → Redis: DEL wallet:42            ❌ timeout / connection reset
T3  Client GET /balance
T4  App → Redis: GET wallet:42             HIT → {"balance": 500}  ← stale
T5  (hours later) TTL expires or manual purge → finally consistent</pre>
<p>Each step alone looks fine in logs. The bug is the <em>gap between T1 and T2</em>. Retries on the HTTP handler make it worse: the client may retry the debit (idempotency saves money) but the cache still never got invalidated.</p>
<p>Reproduce: write to DB, block or drop Redis DEL (iptables, toxiproxy), then read — you'll get stale data every time until TTL.</p>`,
    },
    {
      title: "Fixes",
      body: `<p><b>Do not roll back the DB</b> because cache failed. The payment already committed; undoing the ledger write creates a worse failure (lost money). Treat cache as an optional acceleration layer — DB remains source of truth.</p>
<ul>
<li><b>Invalidate on write (cache-aside write path)</b> — after DB commit, <code>DEL</code> the key (preferred over <code>SET</code> with new value: simpler, avoids racing with concurrent writers). Next read misses cache and reloads from DB.</li>
<li><b>Retry invalidation</b> — enqueue a background job or use an outbox row: <code>cache_invalidation { key, wallet_id }</code> committed with the business txn; a worker retries <code>DEL</code> until Redis acks (same pattern as transactional outbox, different relay target).</li>
<li><b>Short TTL on hot keys</b> — caps staleness window (e.g. 30–60s on balance keys). Not a substitute for invalidation; a safety net.</li>
<li><b>Read-through on critical paths</b> — for "confirm payment" screens, bypass cache or use <code>read-your-writes</code> routing to DB/replica that saw the write.</li>
<li><b>Write-through with fallback</b> — if synchronous cache update fails, fall back to <code>DEL</code> + async retry rather than leaving a known-stale entry.</li>
</ul>
<div class="callout"><p><b>Anti-patterns:</b> rolling back DB on cache failure; updating cache <em>before</em> DB commit (cache shows money that DB never recorded); long TTL with no invalidation on financial keys; ignoring failed <code>DEL</code> in logs.</p></div>`,
    },
    {
      title: "Prevention",
      body: `<p>Instrument every write path:</p>
<ul>
<li><code>cache_invalidation_total{result="ok|fail"}</code> — alert on fail rate</li>
<li>Reconciliation job: sample wallet IDs, compare Redis vs DB, page on drift</li>
<li>Integration test: commit DB write, simulate Redis failure, assert next read eventually matches DB (or returns fresh DB value on critical endpoint)</li>
</ul>
<p>Code review checklist: every <code>UPDATE/INSERT/DELETE</code> on a cached entity has a matching invalidation or TTL strategy documented in the runbook.</p>`,
    },
    {
      title: "Production checklist",
      body: `<ul>
<li>Write path: DB commit → <code>DEL</code> (or outbox row) — never silent cache failure</li>
<li>Alert on cache invalidation failures and reconciliation drift</li>
<li>TTL as backstop, not primary consistency mechanism for balances</li>
<li>Runbook: "stale balance" → verify DB truth, purge key <code>wallet:{id}</code>, root-cause invalidation pipeline</li>
<li>Link related patterns: Cache Aside (write path), Write Through, Cache Invalidation, DB + Cache Dual Write, Transactional Outbox</li>
</ul>
<p>Interview tip: draw DB commit ✅, cache ❌, stale GET — then explain why you don't rollback DB and how outbox-style retry fixes it.</p>`,
    },
  ],
  figures: [
    {
      id: "dual-write-timeline",
      svg: `<svg viewBox="0 0 560 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DB cache dual write failure timeline"><defs><marker id="fig-cache-consistency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="20" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="65" y="52" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">App</text><rect x="140" y="20" width="80" height="56" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="180" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">DB</text><text x="180" y="58" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">COMMIT ✓</text><rect x="140" y="90" width="80" height="56" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/><text x="180" y="112" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Redis</text><text x="180" y="128" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">DEL ✗</text><rect x="260" y="55" width="90" height="46" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="305" y="75" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">GET balance</text><text x="305" y="91" text-anchor="middle" fill="#ffb454" font-size="9" font-family="system-ui">cache HIT stale</text><rect x="390" y="55" width="150" height="46" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/><text x="465" y="75" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">User sees $500</text><text x="465" y="91" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">DB has $450</text><line x1="110" y1="48" x2="138" y2="40" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/><line x1="110" y1="48" x2="138" y2="118" stroke="#ff6b6b" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#fig-cache-consistency-arr)"/><line x1="220" y1="118" x2="258" y2="85" stroke="#ffb454" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/><line x1="350" y1="78" x2="388" y2="78" stroke="#ffb454" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/></svg>`,
      caption: `After DB commit succeeds, a failed cache invalidation leaves readers on stale hits until TTL or repair.`,
    },
  ],
  related: ["cache-aside", "write-through", "cache-invalidation", "db-cache-dual-write", "transactional-outbox"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("cache-consistency", stage, panel, stageEl);
}
