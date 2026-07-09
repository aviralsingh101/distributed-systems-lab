// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf } from "../../../sim/primitives.js";

export const meta = { id: "vector-clock", title: "Vector Clock", category: "ordering" };

export const content = {
  oneliner: `Detect concurrent writes.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Detect concurrent writes.</p>
<p>Without <b>Vector Clock</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Vector Clock</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Vector Clock</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Vector Clock</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Vector Clock</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
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
    note: "Receive = element-wise max, then bump own entry.",
    frame(ctx, t) {
      const d = ctx.d;
      const A = { x: 280, color: C.service, label: "Replica A" };
      const B = { x: 720, color: C.gateway, label: "Replica B" };
      // events
      const events = [
        { p: 0, k: "local" },          // A [1,0]
        { p: 1, k: "local" },          // B [0,1] concurrent with above
        { p: 0, k: "send", to: 1 },    // A [2,0]
        { p: 1, k: "recv", from: 0 },  // B max([0,1],[2,0])+own = [2,2]
        { p: 1, k: "local" },          // B [2,3]
      ];
      const ph = phaseOf(t, events.map(() => 1.2));
      const V = [[0, 0], [0, 0]];
      const stamps = [];
      const sendVecs = {};
      for (let i = 0; i <= ph.i && i < events.length; i++) {
        const e = events[i];
        if (e.k === "recv") {
          const sv = sendVecs[e.from] || [0, 0];
          V[e.p][0] = Math.max(V[e.p][0], sv[0]); V[e.p][1] = Math.max(V[e.p][1], sv[1]);
          V[e.p][e.p] += 1;
        } else { V[e.p][e.p] += 1; if (e.k === "send") sendVecs[e.p] = V[e.p].slice(); }
        stamps[i] = V[e.p].slice();
      }
      const fmt = (v) => "[" + v.join(",") + "]";
      [A, B].forEach((pp, idx) => {
        d.node(pp.x - 80, 30, 160, 56, { title: pp.label, color: pp.color, active: true, value: fmt(V[idx]) });
        d.ctx.save(); d.ctx.strokeStyle = C.panelLine; d.ctx.setLineDash([4, 7]);
        d.ctx.beginPath(); d.ctx.moveTo(pp.x, 86); d.ctx.lineTo(pp.x, 500); d.ctx.stroke(); d.ctx.restore();
      });
      const y0 = 130, rh = 62;
      for (let i = 0; i <= ph.i && i < events.length; i++) {
        const e = events[i]; const px = e.p === 0 ? A.x : B.x; const y = y0 + i * rh;
        if (e.k === "send") d.arrow(px, y, (e.to === 0 ? A.x : B.x), y + rh, { color: C.accent, width: 2, label: fmt(stamps[i]), progress: i === ph.i ? ph.p : 1 });
        else { d.token(px, y, { r: 11, color: e.k === "recv" ? C.ok : (e.p === 0 ? A.color : B.color) }); d.text(px + (e.p === 0 ? 20 : -20), y, fmt(stamps[i]), { size: 12, mono: true, align: e.p === 0 ? "left" : "right", color: C.ink }); }
      }
      // concurrency check on first two events
      const concurrent = ph.i >= 1;
      d.badge(500, 470, concurrent && ph.i < 3 ? "[1,0] ∥ [0,1] — concurrent (conflict!)" : "later events dominate — causal chain", { color: concurrent && ph.i < 3 ? C.warn : C.ok, align: "center" });
      ctx.setStatus("incomparable vectors ⇒ concurrent writes detected", "ok");
    },
  });
}
