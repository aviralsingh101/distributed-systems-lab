// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "clock-skew", title: "Clock Skew", category: "ordering" };

export const content = {
  oneliner: `Machine clocks disagree.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Machine clocks disagree.</p>
<p>Without <b>Clock Skew</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Clock Skew</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Clock Skew</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Clock Skew</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Clock Skew</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
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
</svg>`, caption: `Distributed lock: SET key NX PX with unique token; stale holder rejected via fencing token.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "A causes an event on B; compare timestamps.",
    params: [{ key: "skew", label: "B clock behind", min: 0, max: 6, step: 1, value: 4, unit: "s", live: true }],
    toggles: [{ key: "fix", label: "Use Lamport logical clock", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const fix = ctx.toggles.fix; const skew = ctx.params.skew;
      const A = { x: 260, y: 260 }, B = { x: 740, y: 260 };
      const aTs = 3, bWall = aTs - skew;
      const aStamp = fix ? 1 : aTs;
      const bStamp = fix ? aStamp + 1 : bWall;
      d.node(A.x - 90, A.y - 40, 180, 80, { title: "Server A", color: C.service, active: true, value: (fix ? "L=" : "clock ") + aStamp + (fix ? "" : "s") });
      d.node(B.x - 90, B.y - 40, 180, 80, { title: "Server B", color: C.gateway, active: true, value: (fix ? "L=" : "clock ") + bStamp + (fix ? "" : "s") });
      const bad = !fix && bStamp <= aStamp;
      d.arrow(A.x + 90, A.y, B.x - 90, B.y, { color: bad ? C.err : C.ok, width: 2.4, label: "causes →", progress: 1 });
      d.text(A.x, A.y + 70, "send stamped " + aStamp + (fix ? "" : "s"), { size: 12, align: "center", color: C.muted });
      d.text(B.x, B.y + 70, "receive stamped " + bStamp + (fix ? "" : "s"), { size: 12, align: "center", color: bad ? C.err : C.ok });
      d.badge(500, 460, bad ? "receive ≤ send — effect before cause!" : "send < receive — causal order holds", { color: bad ? C.err : C.ok, align: "center" });
      ctx.setStatus(fix ? "logical clock preserves causality" : (bad ? "wall-clock skew broke ordering" : "no skew yet — raise it"), fix ? "ok" : (bad ? "err" : "warn"));
    },
  });
}
