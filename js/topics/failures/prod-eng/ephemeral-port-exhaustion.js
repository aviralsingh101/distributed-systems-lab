// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, clamp } from "../../../sim/primitives.js";

export const meta = { id: "ephemeral-port-exhaustion", title: "Ephemeral Port Exhaustion", category: "prod-eng" };

export const content = {
  oneliner: `TIME_WAIT eats ports.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>TIME_WAIT eats ports. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Ephemeral Port Exhaustion</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p><b>Ephemeral Port Exhaustion</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Ephemeral Port Exhaustion</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Ephemeral Port Exhaustion</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "timeline", svg: `<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ephemeral Port Exhaustion timeline">
<defs><marker id="fig-ephemeral-port-exhaustion-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<text x="260" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Concurrent timeline — time flows right</text>
<rect x="20" y="40" width="70" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="55" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker A</text>
<rect x="20" y="90" width="70" height="32" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="55" y="110" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker B</text>
<rect x="120" y="65" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="165" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shared row</text><text x="165" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Ledger</text>
<rect x="240" y="40" width="80" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="280" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">read 100</text>
<rect x="340" y="40" width="80" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="380" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">write 120</text>
<rect x="240" y="90" width="80" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="280" y="110" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">read 100</text>
<rect x="340" y="90" width="80" height="32" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="380" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">write 130</text><text x="380" y="120" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale!</text>
<rect x="440" y="65" width="70" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="475" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">130 ✗</text><text x="475" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lost +20</text>
<line x1="90" y1="56" x2="118" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="90" y1="106" x2="118" y2="88" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="210" y1="80" x2="238" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="210" y1="88" x2="238" y2="106" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="320" y1="56" x2="338" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="320" y1="106" x2="338" y2="106" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="420" y1="56" x2="438" y2="78" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="420" y1="106" x2="438" y2="92" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
</svg>`, caption: `How Ephemeral Port Exhaustion unfolds — two workers interleave on the same resource; the second write can overwrite the first.` },
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ephemeral Port Exhaustion in request path">
<defs><marker id="fig-ephemeral-port-exhaustion-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ephemeral Por…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ephemeral-port-exhaustion-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Ephemeral Port Exhaustion</text>
</svg>`, caption: `Ephemeral Port Exhaustion on the payment request path — from client charge to Ledger commit.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const MAX = 28000;
  return mountSimulation(stage, panel, stageEl, {
    note: "Outbound ports used, including TIME_WAIT.",
    params: [{ key: "rate", label: "New conns/s", min: 100, max: 3000, step: 100, value: 1600, unit: "", live: true }],
    toggles: [{ key: "fix", label: "Keep-alive / connection pool", kind: "ok", value: false }],
    frame(ctx) {
      const d = ctx.d; const rate = ctx.params.rate; const fix = ctx.toggles.fix;
      // TIME_WAIT ~60s window; ports in use ≈ rate * 60 (no reuse) vs small pool (reuse)
      const used = fix ? Math.min(MAX, 200) : Math.min(MAX * 1.4, rate * 60);
      const frac = clamp(used / MAX);
      const exhausted = used >= MAX;
      d.node(300, 110, 400, 60, { title: fix ? "connection pool (reused)" : "new connection per request", color: fix ? C.ledger : C.warn, active: true, value: fix ? "~200 conns reused" : rate + " new/s" });
      d.gauge(250, 280, 500, 26, frac, { color: exhausted ? C.err : frac > 0.7 ? C.warn : C.ok, label: "ephemeral ports used (incl. TIME_WAIT)", value: Math.round(used) + " / " + MAX });
      d.text(500, 360, fix ? "ports reused → usage flat" : "each request burns a port for ~60s (TIME_WAIT)", { size: 13, align: "center", color: exhausted ? C.err : C.muted });
      if (exhausted) d.badge(500, 420, "EADDRNOTAVAIL — cannot assign requested address", { color: C.err, align: "center" });
      ctx.setStatus(fix ? "connection reuse — ports plentiful" : (exhausted ? "port range exhausted — new conns fail" : "port usage climbing"), fix ? "ok" : (exhausted ? "err" : "warn"));
    },
  });
}
