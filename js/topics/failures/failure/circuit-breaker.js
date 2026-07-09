// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, clamp } from "../../../sim/primitives.js";

export const meta = { id: "circuit-breaker", title: "Circuit Breaker", category: "failure" };

export const content = {
  oneliner: `Open / Half-open / Closed.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Open / Half-open / Closed. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Circuit Breaker</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p><b>Circuit Breaker</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>
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
    { title: `Production checklist`, body: `<p>Before shipping <b>Circuit Breaker</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Circuit Breaker</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "cb-states", svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Circuit breaker states">
<rect x="30" y="40" width="100" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="80" y="56" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Closed</text><text x="80" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">requests pass</text>
<rect x="190" y="40" width="100" height="44" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="240" y="56" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Open</text><text x="240" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">fail fast</text>
<rect x="350" y="40" width="110" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="405" y="56" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Half-open</text><text x="405" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">test probe</text>
<text x="130" y="30" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">failures ↑</text>
<text x="270" y="30" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">timeout</text>
<text x="400" y="30" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">success → closed</text>
</svg>`, caption: `Circuit breaker states: Closed (normal) → Open (fail fast) → Half-open (probe).` },
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Circuit Breaker in request path">
<defs><marker id="fig-circuit-breaker-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Circuit Break…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-circuit-breaker-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-circuit-breaker-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-circuit-breaker-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-circuit-breaker-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-circuit-breaker-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Circuit Breaker</text>
</svg>`, caption: `Circuit Breaker on the payment request path — from client charge to Ledger commit.` }
  ],
  related: ["bulkhead", "retry-backoff", "timeout-cascade"],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Breaker state follows the downstream error rate.",
    params: [{ key: "err", label: "Gateway error rate", min: 0, max: 100, step: 5, value: 10, unit: "%", live: true }],
    frame(ctx, t) {
      const d = ctx.d; const errRate = ctx.params.err;
      // decide state
      let state;
      if (errRate >= 50) state = "OPEN";
      else if (errRate >= 30) state = "HALF-OPEN";
      else state = "CLOSED";
      const states = [
        { id: "CLOSED", x: 250, y: 150, c: C.ok, desc: "calls pass" },
        { id: "OPEN", x: 750, y: 150, c: C.err, desc: "reject instantly" },
        { id: "HALF-OPEN", x: 500, y: 360, c: C.warn, desc: "trial calls" },
      ];
      // transitions
      d.arrow(340, 150, 660, 150, { color: C.faint, label: "failures > threshold", head: true });
      d.arrow(700, 210, 560, 320, { color: C.faint, label: "cooldown", head: true });
      d.arrow(440, 320, 320, 200, { color: C.faint, label: "probe ok", head: true });
      d.arrow(590, 330, 720, 210, { color: C.faint, label: "probe fails", head: true, dashed: true });
      states.forEach((s) => d.node(s.x - 90, s.y - 34, 180, 68, { title: s.id, color: s.c, state: s.id === state ? "" : "dim", active: s.id === state, value: s.desc }));
      // call outcomes
      d.gauge(320, 470, 360, 16, errRate / 100, { color: errRate >= 50 ? C.err : errRate >= 30 ? C.warn : C.ok, label: "downstream error rate", value: errRate + "%" });
      ctx.setStatus("breaker: " + state + (state === "OPEN" ? " — failing fast" : state === "CLOSED" ? " — healthy" : " — probing"), state === "OPEN" ? "err" : state === "CLOSED" ? "ok" : "warn");
    },
  });
}
