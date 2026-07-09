// @article-v2
// @sim-lab
// @figure-handcrafted
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "db-cache-dual-write",
  title: "DB + Cache Dual Write",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Postgres and Redis have no shared transaction — treat cache updates like outbox relay, not a second synchronous commit.",
  sections: [
    {
      title: "Motivation — same problem as outbox, different second system",
      body: `<p>After a wallet debit, you must update Postgres <i>and</i> Redis. They are independent systems — no XA transaction spans both. Commit DB and crash before <code>DEL</code> → stale balance on cache hit. Invalidate cache first and DB rolls back → cache briefly showed money that never existed.</p>
<p>This is the <b>dual-write problem</b>. Transactional Outbox solves it for DB + message broker. This pattern applies the same idea to DB + cache.</p>`,
    },
    {
      title: "What not to do",
      body: `<ul>
<li><b>Rollback DB when cache fails</b> — payment already committed; creates lost-update / duplicate-charge chaos on retry.</li>
<li><b>Update cache before DB commit</b> — phantom reads if transaction aborts.</li>
<li><b>Ignore failed DEL in catch block</b> — silent staleness until TTL.</li>
<li><b>Assume write-through magically atomizes</b> — two network calls are still two writes unless coordinated.</li>
</ul>`,
    },
    {
      title: "Pattern A — invalidate on write + retry (most common)",
      figureAfter: "cache-outbox-flow",
      body: `<pre>-- Single DB transaction
BEGIN;
  UPDATE wallets SET balance = 450 WHERE id = 42;
  INSERT INTO cache_invalidation (id, cache_key, created_at)
    VALUES (gen_random_uuid(), 'wallet:42', now());
COMMIT;

-- Separate worker (like outbox relay)
SELECT * FROM cache_invalidation
  WHERE processed_at IS NULL
  FOR UPDATE SKIP LOCKED LIMIT 100;
-- for each row: DEL cache_key in Redis; UPDATE processed_at</pre>
<p>Business truth and <em>intent to invalidate</em> commit atomically. Redis failure only delays purge — worker retries until <code>DEL</code> succeeds. Staleness window shrinks to relay lag, not TTL hours.</p>
<p>Simpler variant without a table: fire-and-forget retry queue (SQS job) after DB commit — weaker durability if the process dies before enqueue.</p>`,
    },
    {
      title: "Pattern B — cache-aside with best-effort DEL + TTL backstop",
      body: `<pre>COMMIT;
try { redis.del("wallet:42"); }
catch (e) { metrics.cacheInvalidationFail.inc(); retryQueue.enqueue("wallet:42"); }</pre>
<p>Acceptable for lower-criticality data when you also run short TTL (30–60s) and reconciliation jobs. Not sufficient alone for wallet balances at scale — pair with Pattern A for money paths.</p>`,
    },
    {
      title: "Pattern C — read-your-writes escape hatch",
      body: `<p>After a write, route that user's next read to DB (or a replica that caught up) for N seconds — bypass cache for confirm-payment screens. Does not fix cache for other readers; combine with invalidation.</p>`,
    },
    {
      title: "Schema sketch",
      body: `<pre>CREATE TABLE cache_invalidation (
  id UUID PRIMARY KEY,
  cache_key TEXT NOT NULL,
  aggregate_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ NULL
);
CREATE INDEX cache_inv_pending ON cache_invalidation (created_at)
  WHERE processed_at IS NULL;</pre>
<p>Mirror outbox ops: alert on oldest-unprocessed age, scale workers with <code>SKIP LOCKED</code>, archive processed rows.</p>`,
    },
    {
      title: "Payment platform example",
      body: `<p>Order Service debits wallet: one transaction updates <code>ledger_entries</code> and inserts <code>cache_invalidation('wallet:' || wallet_id)</code>. Cache Relay worker DELs Redis keys within ~200ms. Wallet API read path: cache miss → SELECT balance. Integration test: kill Redis during write, assert worker eventually DELs and read matches DB.</p>
<p>Chaos: relay duplicate DEL is idempotent. Missing invalidation row is the bug class — monitor pending queue depth.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> no distributed 2PC; DB remains source of truth; same operational playbook as transactional outbox; works with any Redis client.</p>
<p><b>Cons:</b> eventual cache coherence (relay lag); extra table and worker; must still set TTL and reconciliation as defense in depth; multi-key fan-out (user + list caches) needs careful key catalog.</p>
<p><b>Use when:</b> cache-aside or write-through on critical entities; stale reads have customer impact; you already operate outbox relay patterns.</p>
<p><b>Avoid when:</b> cache is optional decoration with long TTL acceptable; single-process in-memory cache in one JVM (use synchronized invalidation instead).</p>`,
    },
  ],
  figures: [
    {
      id: "cache-outbox-flow",
      svg: `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DB cache dual write outbox flow"><defs><marker id="fig-db-cache-dual-write-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="20" y="50" width="80" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="60" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Wallet API</text><text x="60" y="80" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">txn</text><rect x="130" y="35" width="70" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="165" y="47" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text><text x="165" y="63" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">UPDATE</text><rect x="130" y="85" width="70" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="165" y="97" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache inv</text><text x="165" y="113" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">INSERT</text><rect x="240" y="60" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="285" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">COMMIT</text><text x="285" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">both</text><rect x="360" y="60" width="80" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="400" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Relay</text><text x="400" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">worker</text><rect x="470" y="60" width="70" height="40" rx="6" fill="#1a2236" stroke="#ff8fab" stroke-width="1.5"/><text x="505" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Redis</text><text x="505" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">DEL</text><line x1="100" y1="53" x2="128" y2="53" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-db-cache-dual-write-arr)"/><line x1="100" y1="103" x2="128" y2="103" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-db-cache-dual-write-arr)"/><line x1="200" y1="80" x2="238" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-db-cache-dual-write-arr)"/><line x1="330" y1="80" x2="358" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-db-cache-dual-write-arr)"/><line x1="440" y1="80" x2="468" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-db-cache-dual-write-arr)"/><text x="165" y="28" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">single DB transaction</text></svg>`,
      caption: `Ledger update and cache invalidation intent commit together; a relay worker DELs Redis asynchronously.`,
    },
  ],
  related: ["transactional-outbox", "cache-aside", "cache-consistency", "write-through", "inbox-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("db-cache-dual-write", stage, panel, stageEl);
}
