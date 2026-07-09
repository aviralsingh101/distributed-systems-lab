// @article-v2
// @sim-lab
import { C, clamp } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "connection-pool-exhaustion", title: "Connection Pool Exhaustion", category: "prod-eng" };

export const content = {
  oneliner: `All DB connections busy.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>All DB connections busy. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Connection Pool Exhaustion</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p><b>Connection Pool Exhaustion</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Connection Pool Exhaustion</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Connection Pool Exhaustion</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "pool-exhaustion", svg: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Connection Pool Exhaustion pool"> <rect x="30" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="72" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="114" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="156" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="198" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="240" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="282" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/><rect x="324" y="40" width="36" height="36" rx="4" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/> <text x="200" y="30" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">connection pool: 8/8 in use</text> <rect x="30" y="85" width="120" height="28" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="90" y="93" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">waiting clients</text><text x="90" y="109" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">timeout</text> </svg>`, caption: `Connection Pool Exhaustion: all connections checked out — new requests block until timeout.` },
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("connection-pool-exhaustion", stage, panel, stageEl);
}