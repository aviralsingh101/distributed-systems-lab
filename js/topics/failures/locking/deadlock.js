// @article-v2
// @sim-lab
import { C, phaseOf, clamp } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "deadlock", title: "Deadlock", category: "locking" };

export const content = {
  oneliner: `A waits for B, B waits for A.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>A waits for B, B waits for A. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Deadlock</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Deadlock</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Deadlock</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "lock-timeline", svg: `<svg viewBox="0 0 560 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Deadlock lock timeline"> <defs><marker id="fig-deadlock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <text x="280" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Lock lease timeline</text> <rect x="30" y="50" width="80" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="70" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker A</text><text x="70" y="78" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">holds lock</text> <rect x="30" y="110" width="80" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="70" y="122" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker B</text><text x="70" y="138" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">waits</text> <rect x="140" y="80" width="100" height="40" rx="6" fill="#1a2236" stroke="#ffd166" stroke-width="1.5"/> <text x="190" y="94" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Redis lock</text><text x="190" y="110" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">SET NX PX</text> <rect x="270" y="50" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="315" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">lease OK</text><text x="315" y="78" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">f=1</text> <rect x="270" y="110" width="90" height="36" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/> <text x="315" y="132" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">blocked</text> <rect x="390" y="50" width="90" height="36" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/> <text x="435" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">lease expired</text> <rect x="390" y="110" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="435" y="122" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">acquires</text><text x="435" y="138" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">f=2</text> <rect x="500" y="80" width="50" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="525" y="104" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">safe</text> <line x1="110" y1="68" x2="138" y2="88" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <line x1="110" y1="128" x2="138" y2="100" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <line x1="240" y1="68" x2="268" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <line x1="240" y1="128" x2="268" y2="128" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <line x1="360" y1="68" x2="388" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <line x1="360" y1="128" x2="388" y2="128" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <line x1="480" y1="128" x2="498" y2="100" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/> <text x="330" y="38" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">TTL expires</text> </svg>`, caption: `Deadlock: lease-based lock with fencing token — stale holder must not write after expiry.` },
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("deadlock", stage, panel, stageEl);
}