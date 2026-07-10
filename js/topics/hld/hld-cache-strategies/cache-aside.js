// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";
// @article-v2
// @hld-gold

export const meta = { id: "cache-aside", title: "Cache Aside", category: "cache" };

export const content = {
  oneliner: `The application owns cache logic: read on miss from DB, write to DB then invalidate cache.`,
  archetype: "concept",
  sections: [
    {
      title: "What is cache-aside?",
      body: `<p><b>Cache-aside</b> (a.k.a. lazy loading) means the cache is <em>not</em> the source of truth — the app explicitly decides when to read from cache vs database. Redis sits beside the DB; the application code orchestrates both.</p>
<p>Most payment platforms use cache-aside for wallet balances, user profiles, and idempotency-key lookups: fast reads from Redis, durable writes to Postgres.</p>`,
    },
    {
      title: "Read path",
      body: `<pre>GET wallet:42 from Redis
  → HIT: return cached JSON
  → MISS: SELECT * FROM wallets WHERE id = 42
           SET wallet:42 JSON EX 300
           return row</pre>
<p>On miss, one thread loads from DB and populates cache. Under stampede, use locking or request coalescing so only one loader hits DB (see Cache Stampede).</p>`,
    },
    {
      title: "Write path — where consistency breaks",
      body: `<pre>BEGIN;
  UPDATE wallets SET balance = 450 WHERE id = 42;
COMMIT;
DEL wallet:42          -- preferred: invalidate, don't SET</pre>
<p><b>Order matters:</b> commit DB first, then invalidate cache. Never populate cache before the transaction commits — a rolled-back payment would leave a phantom balance in Redis.</p>
<p><b>Prefer <code>DEL</code> over <code>SET</code> on write:</b> invalidation avoids racing with another writer who also updates DB. The next read reloads authoritative state. If you must <code>SET</code>, include a version or updated_at and reject stale writes.</p>
<p><b>If <code>DEL</code> fails:</b> do not rollback DB. Log, metric, retry async (outbox row or queue job). Stale reads persist until TTL or repair — see <b>Cache Consistency</b>.</p>`,
    },
    {
      title: "Compared to other cache patterns",
      body: `<ul>
<li><b>Write-through</b> — cache layer writes DB and cache synchronously; simpler mental model, cache must participate in failure handling.</li>
<li><b>Write-around</b> — write DB only; cache populated on read. Good for write-heavy, rarely-read data.</li>
<li><b>Write-back</b> — write cache first, flush to DB later; higher throughput, risk of data loss on crash.</li>
</ul>
<p>Cache-aside is the default when you already have an ORM/repository layer and want full control over invalidation keys.</p>`,
    },
    {
      title: "Production checklist",
      body: `<ul>
<li>Every cached entity type has a documented key schema (<code>wallet:{id}</code>, <code>user:{id}:profile</code>)</li>
<li>Write handlers call a single <code>invalidateWallet(id)</code> helper — no scattered DEL strings</li>
<li>TTL on all keys as staleness backstop (30s–5m depending on sensitivity)</li>
<li>Monitor miss rate, invalidation failures, and cache-vs-DB reconciliation samples</li>
</ul>
<p>Interview tip: draw read miss path, then write path with DEL — mention what happens when DEL fails.</p>`,
    },
  ],
  related: ["write-through", "write-around", "cache-invalidation", "cache-consistency", "db-cache-dual-write"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("cache-aside", stage, panel, stageEl);
}