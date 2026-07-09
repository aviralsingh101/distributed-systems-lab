// @article-v2
// @sim-lab
import { C, phaseOf } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "dogpile", title: "Dogpile Effect", category: "retry" };

export const content = {
  oneliner: `Many workers recompute together.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Many workers recompute together. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Dogpile Effect</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p><b>Dogpile Effect</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Dogpile Effect</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Dogpile Effect</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "dogpile-workers", svg: `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dogpile effect parallel recompute">
  <defs><marker id="fig-dogpile-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="180" y="44" width="88" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="224" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache</text>
  <text x="224" y="76" text-anchor="middle" fill="#ff5c6c" font-size="9" font-family="system-ui">MISS</text>
  <rect x="350" y="44" width="96" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="398" y="68" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Recompute</text>
  <rect x="30" y="20" width="56" height="30" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="58" y="40" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">W1</text>
  <rect x="30" y="58" width="56" height="30" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="58" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">W2</text>
  <rect x="30" y="96" width="56" height="30" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="58" y="116" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">W3</text>
  <line x1="86" y1="35" x2="178" y2="58" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-dogpile-arr)"/>
  <line x1="86" y1="73" x2="178" y2="64" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-dogpile-arr)"/>
  <line x1="86" y1="111" x2="178" y2="70" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-dogpile-arr)"/>
  <line x1="268" y1="64" x2="348" y2="64" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-dogpile-arr)"/>
  <line x1="268" y1="64" x2="348" y2="64" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-dogpile-arr)"/>
  <line x1="268" y1="64" x2="348" y2="64" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-dogpile-arr)"/>
  <text x="260" y="128" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">All workers recompute — use single-flight lock</text>
</svg>`, caption: `Dogpile: every worker sees the same cache miss and hits origin in parallel.` },
  ],
  related: ["cache-stampede", "thundering-herd", "request-coalescing"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("dogpile", stage, panel, stageEl);
}