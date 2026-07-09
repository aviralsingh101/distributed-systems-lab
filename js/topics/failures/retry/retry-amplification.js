// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C } from "../../../sim/primitives.js";

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
    { id: "retry-amplify", svg: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Retry storm">
<rect x="30" y="20" width="50" height="24" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="55" y="36" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">C1</text><rect x="30" y="50" width="50" height="24" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="55" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">C2</text><rect x="30" y="80" width="50" height="24" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="55" y="96" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">C3</text>
<rect x="150" y="45" width="80" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="190" y="59" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API</text><text x="190" y="79" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">slow</text>
<rect x="280" y="20" width="50" height="24" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="305" y="36" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">retry</text><rect x="280" y="50" width="50" height="24" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="305" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">retry</text><rect x="280" y="80" width="50" height="24" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="305" y="96" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">retry</text>
<rect x="360" y="45" width="50" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="385" y="59" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB</text><text x="385" y="79" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">overload</text>
<text x="210" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">retries amplify load × N clients</text>
</svg>`, caption: `Retry storm: each client retries a slow service, multiplying load on an already degraded backend.` },
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Retry Amplification in request path">
<defs><marker id="fig-retry-amplification-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Retry Amplifi…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-retry-amplification-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Retry Amplification</text>
</svg>`, caption: `Retry Amplification on the payment request path — from client charge to Ledger commit.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const layers = ["API", "Order", "Payment", "Ledger"];
  return mountSimulation(stage, panel, stageEl, {
    note: "Retries at each hop multiply down the chain.",
    params: [{ key: "r", label: "Retries per hop", min: 1, max: 4, step: 1, value: 3, unit: "×", live: true }],
    toggles: [{ key: "fix", label: "Retry at edge only", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const r = ctx.params.r; const fix = ctx.toggles.fix;
      let count = 1;
      layers.forEach((name, i) => {
        const y = 90 + i * 110;
        const mult = i === 0 ? 1 : (fix ? (i === 1 ? r : 1) : r);
        count *= mult;
        const overload = count > 12;
        d.node(500 - 90, y, 180, 60, { title: name, color: i === layers.length - 1 ? C.ledger : C.service, state: overload ? "err" : "", active: i === layers.length - 1 });
        d.badge(720, y + 30, count + (count === 1 ? " call" : " calls"), { color: overload ? C.err : C.ok, filled: overload, align: "left" });
        if (i < layers.length - 1) {
          const nextY = y + 60, ny = 90 + (i + 1) * 110;
          const arrows = Math.min(6, fix ? (i === 0 ? r : 1) : r);
          for (let k = 0; k < arrows; k++) {
            const off = (k - (arrows - 1) / 2) * 26;
            d.arrow(500 + off, nextY, 500 + off, ny, { color: arrows > 1 ? C.warn : C.faint, width: 1.6, head: true });
          }
        }
      });
      const leaf = fix ? r : Math.pow(r, layers.length - 1);
      ctx.setStatus(fix ? `leaf gets ${r} calls (linear)` : `leaf gets ${leaf} calls (amplified)`, fix ? "ok" : (leaf > 12 ? "err" : "warn"));
    },
  });
}
