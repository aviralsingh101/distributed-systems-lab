// @article-v2
// @sim-lab
import { C } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "retry-amplification", title: "Retry Amplification", category: "retry" };

export const content = {
  oneliner: `Retries multiply down the chain.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Retries multiply down the chain. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Retry Amplification</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p>Retries amplify load when backends are degraded. Exponential backoff with full jitter spreads retry timing. Circuit breakers stop retry storms; single-flight refresh prevents cache stampede on hot merchant config keys.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Retry Amplification</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Retry Amplification</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "retry-chain", svg: `<svg viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Retry amplification across service chain">
  <defs><marker id="fig-retry-amplification-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="24" y="44" width="52" height="32" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="50" y="64" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C1</text>
  <rect x="24" y="84" width="52" height="32" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="50" y="104" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C2</text>
  <rect x="120" y="58" width="72" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="156" y="80" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
  <rect x="230" y="58" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="270" y="80" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order svc</text>
  <rect x="350" y="58" width="80" height="36" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="390" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
  <text x="390" y="88" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">leaf hot</text>
  <line x1="76" y1="60" x2="118" y2="72" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-retry-amplification-arr)"/>
  <line x1="76" y1="100" x2="118" y2="82" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-retry-amplification-arr)"/>
  <line x1="192" y1="76" x2="228" y2="76" stroke="#ffb454" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
  <text x="210" y="68" text-anchor="middle" fill="#ffb454" font-size="9" font-family="system-ui">retry</text>
  <line x1="310" y1="76" x2="348" y2="76" stroke="#ffb454" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
  <text x="329" y="68" text-anchor="middle" fill="#ffb454" font-size="9" font-family="system-ui">retry</text>
  <text x="260" y="28" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">N clients × R retries × hops → leaf overload</text>
</svg>`, caption: `Retry amplification: each tier retries on timeout — load multiplies down the call chain to the leaf service.` },
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("retry-amplification", stage, panel, stageEl);
}