// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "cache-consistency", title: "Cache Consistency", category: "cache" };

export const content = {
  oneliner: `Cache update failed after DB write.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Cache update failed after DB write. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Cache Consistency</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p>Edge caches store responses closer to clients. Cache keys typically include hostname, path, and query string. Purge APIs and short TTLs on dynamic payment status endpoints prevent stale balance displays.</p>
<p>Default database isolation (Read Committed) and naive application patterns do not prevent this without explicit design — the bug is often invisible in unit tests.</p>` },
    { title: `How the failure unfolds`, body: `<p>Two or more workers interleave operations on the same wallet or shared resource. Each step looks valid in isolation; the combined timeline violates an invariant (balance, idempotency, ordering, or lock discipline).</p>
<p>Reproduce with parallel load tests on the same <code>wallet_id</code> — low concurrency in dev hides the race until Black Friday traffic.</p>` },
    { title: `Fixes`, body: `<p>Choose a fix matching contention and UX:</p>
<ul>
<li><b>Atomic operations</b> — express updates in single SQL statements where possible (<code>UPDATE ... SET x = x + ?</code>).</li>
<li><b>Explicit locking</b> — <code>SELECT ... FOR UPDATE</code> or distributed lock with fencing token for cross-service sections.</li>
<li><b>Idempotency</b> — deduplicate retried requests with <code>Idempotency-Key</code> and unique constraints.</li>
<li><b>Isolation upgrade</b> — Serializable or explicit version columns with bounded retry on conflict.</li>
</ul>
<p>Document the chosen fix in the service runbook and add an integration test that fails without it.</p>` },
    { title: `Prevention`, body: `<p>Add alerts before customers notice: reconciliation jobs, conflict counters, lock wait time p99, retry rate dashboards. Run game-days with parallel charge scripts. Code review checklist: no read-modify-write without version check; no external HTTP inside DB transactions; lock ordering documented.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Cache Consistency</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Cache Consistency</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "replica-lag", svg: `<svg viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replication lag">
<defs><marker id="fig-cache-consistency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="40" y="40" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="85" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Primary</text><text x="85" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">writes</text>
<rect x="180" y="25" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="45" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 1</text>
<rect x="180" y="70" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="90" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 2</text>
<rect x="300" y="40" width="80" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="340" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Reader</text><text x="340" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale?</text>
<line x1="130" y1="55" x2="178" y2="41" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<line x1="130" y1="60" x2="178" y2="86" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<line x1="260" y1="41" x2="298" y2="52" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
</svg>`, caption: `Primary accepts writes; replicas converge asynchronously — reads may be stale.` },
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cache Consistency in request path">
<defs><marker id="fig-cache-consistency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache Consist…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-consistency-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Cache Consistency</text>
</svg>`, caption: `Cache Consistency on the payment request path — from client charge to Ledger commit.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "DB commit succeeds; cache update may fail.",
    toggles: [{ key: "fix", label: "Outbox + CDC (retried invalidation)", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "app", label: "Writer", color: C.service },
        { id: "db", label: "Database", color: C.ledger, kind: "db", value: "100" },
        { id: "c", label: "Cache", color: C.queue, kind: "db", value: "100" },
      ];
      let steps = [
        { from: "app", to: "db", label: "UPDATE balance=60", good: true, set: { db: fix ? "60 +outbox" : "60" } },
      ];
      if (!fix) {
        steps.push(
          { from: "app", to: "c", label: "SET balance=60 ✗", bad: true, dashed: true, set: { c: "100 (stale)" } },
          { from: "app", to: "app", label: "give up", self: true, bad: true, set: { app: "cache stale" } },
        );
      } else {
        steps.push(
          { from: "db", to: "c", label: "CDC → invalidate", set: { c: "empty" } },
          { from: "db", to: "c", label: "retry until ok ✓", good: true, set: { c: "reloads 60" } },
        );
      }
      return {
        actors, steps, stepDur: 1.1,
        status: (r) => !r.done ? { text: "dual write…", cls: "" } : { text: fix ? "cache reconciled to 60 via CDC" : "cache stuck at stale 100", cls: fix ? "ok" : "err" },
      };
    },
  });
}
