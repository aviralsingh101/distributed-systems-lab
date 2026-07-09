// @article-v2
// @sim-lab
import { C, clamp } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "coordinated-omission", title: "Coordinated Omission", category: "retry" };

export const content = {
  oneliner: `Benchmarks hide stalls.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Benchmarks hide stalls. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Coordinated Omission</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p><b>Coordinated Omission</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Coordinated Omission</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Coordinated Omission</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "coord-omit", svg: `<svg viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Coordinated omission hides stalls">
  <defs><marker id="fig-coord-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="40" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="80" y="58" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Load gen</text>
  <text x="80" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">waits</text>
  <rect x="200" y="40" width="100" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="250" y="58" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Backend</text>
  <text x="250" y="72" text-anchor="middle" fill="#ff5c6c" font-size="9" font-family="system-ui">stalled</text>
  <rect x="360" y="24" width="130" height="28" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="425" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Reported p99: 100ms</text>
  <rect x="360" y="68" width="130" height="28" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="425" y="86" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">True p99: 280ms</text>
  <line x1="130" y1="60" x2="198" y2="60" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="164" y="52" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">blocked</text>
  <text x="260" y="108" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Closed-loop benchmark omits stall from metrics</text>
</svg>`, caption: `Coordinated omission: the generator waits during stalls, so reported latency looks fine while true tail latency spikes.` },
  ],
  related: ["tail-latency", "coordinated-omission-perf"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("coordinated-omission", stage, panel, stageEl);
}