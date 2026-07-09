// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf, clamp } from "../../../sim/primitives.js";

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
    { id: "dist-lock", svg: `<svg viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distributed lock">
<rect x="40" y="38" width="70" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="75" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Pod A</text>
<rect x="40" y="78" width="70" height="28" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="75" y="86" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Pod B</text><text x="75" y="106" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale</text>
<rect x="160" y="48" width="90" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="205" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Redis Lock</text><text x="205" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">token=42</text>
<rect x="290" y="38" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="335" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<text x="200" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Only token holder may write</text>
</svg>`, caption: `Distributed lock: SET key NX PX with unique token; stale holder rejected via fencing token.` },
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Deadlock in request path">
<defs><marker id="fig-deadlock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Deadlock</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-deadlock-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Deadlock</text>
</svg>`, caption: `Deadlock on the payment request path — from client charge to Ledger commit.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const A = { x: 400, y: 150 }, B = { x: 600, y: 150 }, T1 = { x: 250, y: 400 }, T2 = { x: 750, y: 400 };
  return mountSimulation(stage, panel, stageEl, {
    note: "Solid = holds lock. Dashed = waiting for lock.",
    toggles: [{ key: "fix", label: "Global lock ordering (lock A first)", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d;
      const drawNode = (n, label, color, state) => d.node(n.x - 62, n.y - 32, 124, 64, { title: label, color, state, active: state === "ok" || state === "err" });
      const link = (p, q, o) => d.arrow(p.x, p.y, q.x, q.y, o);

      if (!ctx.toggles.fix) {
        const ph = phaseOf(t, [1, 1, 1.2, 2]);
        const dead = ph.i >= 3;
        // holds
        if (ph.i >= 0) link(T1, A, { color: C.service, width: 2.4, label: "holds", progress: ph.i === 0 ? ph.p : 1 });
        if (ph.i >= 1) link(T2, B, { color: C.gateway, width: 2.4, label: "holds", progress: ph.i === 1 ? ph.p : 1 });
        // waits
        if (ph.i >= 2) link(T1, B, { color: dead ? C.err : C.warn, dashed: true, label: "wants", progress: ph.i === 2 ? ph.p : 1 });
        if (ph.i >= 2) link(T2, A, { color: dead ? C.err : C.warn, dashed: true, label: "wants", progress: ph.i === 2 ? ph.p : 1 });
        drawNode(A, "Wallet A", C.wallet, dead ? "err" : "");
        drawNode(B, "Wallet B", C.wallet, dead ? "err" : "");
        drawNode(T1, "T1: A→B", C.service, dead ? "err" : "ok");
        drawNode(T2, "T2: B→A", C.gateway, dead ? "err" : "ok");
        if (dead) d.badge(500, 500, "DEADLOCK — wait-for cycle", { color: C.err, align: "center" });
        ctx.setStatus(dead ? "deadlock (both blocked)" : "acquiring locks…", dead ? "err" : "");
      } else {
        const ph = phaseOf(t, [1, 1, 1, 1, 1.4]);
        // Ordered: everyone locks A first, then B
        const t1HasA = ph.i >= 0, t1HasB = ph.i >= 1, t1Done = ph.i >= 2;
        const t2Turn = ph.i >= 3;
        if (t1HasA && !t1Done) link(T1, A, { color: C.service, width: 2.4, label: "holds", progress: ph.i === 0 ? ph.p : 1 });
        if (t1HasB && !t1Done) link(T1, B, { color: C.service, width: 2.4, label: "holds", progress: ph.i === 1 ? ph.p : 1 });
        if (!t2Turn) link(T2, A, { color: C.warn, dashed: true, label: "waits for A", progress: 1 });
        if (t2Turn) { link(T2, A, { color: C.gateway, width: 2.4, label: "holds", progress: ph.i === 3 ? ph.p : 1 }); link(T2, B, { color: C.gateway, width: 2.4, label: "holds", progress: ph.i === 4 ? ph.p : 1 }); }
        drawNode(A, "Wallet A", C.wallet, "");
        drawNode(B, "Wallet B", C.wallet, "");
        drawNode(T1, "T1: A→B", C.service, t1Done ? "" : "ok");
        drawNode(T2, "T2: B→A", C.gateway, t2Turn ? "ok" : "warn");
        d.badge(500, 500, "ordered locks — no cycle", { color: C.ok, align: "center" });
        ctx.setStatus(t2Turn ? "both complete in order" : "T1 first, T2 waits", "ok");
      }
    },
  });
}
