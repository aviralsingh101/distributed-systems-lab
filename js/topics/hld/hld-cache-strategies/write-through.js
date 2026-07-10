// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";
// @article-v2
// @hld-gold

export const meta = { id: "write-through", title: "Write Through", category: "cache" };

export const content = {
  oneliner: `Every write updates DB and cache together — the cache layer (or app) keeps both in sync on the write path.`,
  archetype: "concept",
  sections: [
    {
      title: "What is write-through?",
      body: `<p>In <b>write-through</b>, a write request updates the database <em>and</em> the cache before returning success to the client. Reads always hit cache first; cache is kept warm with fresh values on every write.</p>
<p>Contrast with cache-aside, where the app writes DB then invalidates — write-through <em>updates</em> cache instead of deleting keys.</p>`,
    },
    {
      title: "Write path",
      body: `<pre>POST /debit
  1. UPDATE wallets SET balance = 450 WHERE id = 42   (DB)
  2. SET wallet:42 '{"balance":450}' EX 300           (cache)
  3. return 200</pre>
<p>Implementation options:</p>
<ul>
<li><b>App-level</b> — service code calls DB then Redis in sequence (still dual-write unless coordinated).</li>
<li><b>Cache product</b> — some caches or sidecars accept writes and persist to backing store (rare for custom Postgres schemas).</li>
</ul>
<p>Reads after write are fast cache hits with the new value — when both steps succeed.</p>`,
    },
    {
      title: "When cache write fails",
      body: `<p>Same dual-write trap as cache-aside: DB commits, Redis <code>SET</code> times out.</p>
<ul>
<li><b>Fallback to invalidation</b> — if <code>SET</code> fails, attempt <code>DEL wallet:42</code> so the next read loads from DB instead of serving an old cached value.</li>
<li><b>Do not rollback DB</b> — payment already recorded.</li>
<li><b>Retry async</b> — outbox or queue job to SET/DEL until cache acks.</li>
<li><b>Return 200 with warning metric</b> — client sees success; ops alerts on cache write failure rate.</li>
</ul>
<p>Write-through does not eliminate dual-write — it only changes failure mode from "stale hit" (if you SET wrong/old value) to "stale hit" (if SET fails and old entry remains). Invalidation fallback converges to cache-aside behavior on error.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> predictable read latency after write; no miss storm on hot keys immediately after update; good for read-heavy entities written infrequently.</p>
<p><b>Cons:</b> every write pays cache latency; wasted work if data is never read again (write-around may be cheaper); dual-write consistency still requires retry/TTL/reconciliation; large objects bloat cache.</p>
<p><b>Use when:</b> entity is read often after write (session, cart, live balance display); cache and DB schemas align 1:1.</p>
<p><b>Avoid when:</b> write-heavy audit logs; values too large for Redis; you cannot operate invalidation retries.</p>`,
    },
    {
      title: "Production checklist",
      body: `<ul>
<li>Define behavior when cache write fails: DEL + retry, not silent success</li>
<li>Keep cached JSON schema in sync with DB migrations</li>
<li>Compare write-through vs write-around for write-only tables</li>
<li>Cross-link Cache Consistency for incident playbooks</li>
</ul>`,
    },
  ],
  related: ["cache-aside", "write-around", "write-back", "cache-consistency", "db-cache-dual-write"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("write-through", stage, panel, stageEl);
}