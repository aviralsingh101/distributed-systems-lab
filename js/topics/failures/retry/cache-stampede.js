// @article-v2
// @sim-lab
import { C, phaseOf } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "cache-stampede", title: "Cache Stampede", category: "retry" };

export const content = {
  oneliner: `Coalesce recomputation.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Coalesce recomputation. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Cache Stampede</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Cache Stampede</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Cache Stampede</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "cache-flow", svg: `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cache stampede parallel fetches"> <defs><marker id="fig-cache-stampede-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <rect x="24" y="22" width="44" height="28" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/><text x="46" y="40" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C1</text> <rect x="24" y="58" width="44" height="28" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/><text x="46" y="76" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C2</text> <rect x="24" y="94" width="44" height="28" rx="5" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/><text x="46" y="112" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C3</text> <rect x="130" y="50" width="80" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="170" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache</text><text x="170" y="78" text-anchor="middle" fill="#ff5c6c" font-size="9" font-family="system-ui">MISS</text> <rect x="250" y="50" width="70" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="285" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Origin</text> <rect x="360" y="30" width="130" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="425" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">single-flight</text> <rect x="360" y="78" width="130" height="32" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/> <text x="425" y="98" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">parallel miss</text> <line x1="68" y1="36" x2="128" y2="58" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-cache-stampede-arr)"/> <line x1="68" y1="72" x2="128" y2="68" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-cache-stampede-arr)"/> <line x1="68" y1="108" x2="128" y2="78" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-cache-stampede-arr)"/> <line x1="210" y1="58" x2="248" y2="58" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/> <line x1="210" y1="68" x2="248" y2="68" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/> <line x1="210" y1="78" x2="248" y2="78" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/> </svg>`, caption: `Cache stampede: parallel origin fetches on miss — coalesce with single-flight.` },
  ],
  related: ["cache-aside", "cache-invalidation", "negative-cache"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("cache-stampede", stage, panel, stageEl);
}