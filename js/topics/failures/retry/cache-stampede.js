// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf } from "../../../sim/primitives.js";

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
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cache Stampede in request path">
<defs><marker id="fig-cache-stampede-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache Stampede</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cache-stampede-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Cache Stampede</text>
</svg>`, caption: `Cache Stampede on the payment request path — from client charge to Ledger commit.` }
  ],
  related: ["cache-aside", "cache-invalidation", "negative-cache"],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Expiry triggers expensive recompute.",
    toggles: [{ key: "fix", label: "Stale-while-revalidate + coalesce", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const fix = ctx.toggles.fix;
      const cache = { x: 500, y: 120 }, calc = { x: 500, y: 430 };
      const ph = phaseOf(t, [1.4, 1.9, 1.5]);
      const expired = ph.i >= 1;
      d.node(cache.x - 100, cache.y - 34, 200, 68, { title: "Cache: daily total", color: C.queue, state: expired ? (fix ? "warn" : "err") : "ok", active: true, value: expired ? (fix ? "stale (serving)" : "EXPIRED") : "fresh" });
      d.node(calc.x - 100, calc.y - 34, 200, 68, { title: "expensive compute", color: C.gateway, active: true });

      const N = 8; let runs = 0;
      for (let i = 0; i < N; i++) {
        const rx = 130 + i * 100, ry = 275;
        d.node(rx - 24, ry - 16, 48, 32, { title: "req", color: C.service });
        if (expired && ph.i === 1 && !fix) { const pos = d.along(rx, ry, calc.x, calc.y - 34, ph.p); d.token(pos.x, pos.y, { r: 7, color: C.err }); runs++; }
        else if (fix) { const pos = d.along(rx, ry, cache.x, cache.y + 34, ph.p); d.token(pos.x, pos.y, { r: 7, color: C.ok }); }
      }
      if (fix && expired) { const pos = d.along(cache.x + 110, cache.y, calc.x, calc.y - 34, (t % 2) / 2); d.token(pos.x, pos.y, { r: 8, color: C.warn, label: "bg refresh" }); runs = 1; }
      ctx.setStatus(fix ? "1 background recompute; readers served stale" : (expired && ph.i === 1 ? N + " parallel recomputes — stampede" : "cache fresh"), fix ? "ok" : (expired && ph.i === 1 ? "err" : ""));
    },
  });
}
