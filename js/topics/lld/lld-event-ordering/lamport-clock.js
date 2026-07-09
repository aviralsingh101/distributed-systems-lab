// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf } from "../../../sim/primitives.js";

export const meta = { id: "lamport-clock", title: "Lamport Clock", category: "ordering" };

export const content = {
  oneliner: `Logical ordering counter.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Logical ordering counter.</p>
<p>Without <b>Lamport Clock</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Lamport Clock</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Lamport Clock</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Lamport Clock</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Lamport Clock</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
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
    note: "On receive, clock = max(local, msg) + 1.",
    frame(ctx, t) {
      const d = ctx.d;
      const P = [
        { id: 0, label: "Order", x: 200, color: C.service },
        { id: 1, label: "Payment", x: 500, color: C.gateway },
        { id: 2, label: "Ledger", x: 800, color: C.ledger },
      ];
      // scripted events: [proc, kind('local'|'send'|'recv'), from]
      const events = [
        { p: 0, k: "local" }, { p: 1, k: "local" },
        { p: 0, k: "send", to: 1 }, { p: 1, k: "recv", from: 0 },
        { p: 1, k: "send", to: 2 }, { p: 2, k: "recv", from: 1 },
        { p: 2, k: "local" }, { p: 2, k: "send", to: 0 }, { p: 0, k: "recv", from: 2 },
      ];
      const ph = phaseOf(t, events.map(() => 1.0));
      // compute clocks up to current revealed event
      const clocks = [0, 0, 0];
      const drawn = [];
      for (let i = 0; i <= ph.i; i++) {
        const e = events[i];
        if (e.k === "recv") {
          // find sender's clock at send time
          let sc = 0;
          for (let j = 0; j < i; j++) if (events[j].k === "send" && events[j].to === e.p && events[j].p === e.from) sc = drawn[j].after;
          clocks[e.p] = Math.max(clocks[e.p], sc) + 1;
        } else clocks[e.p] += 1;
        drawn[i] = { after: clocks[e.p] };
      }
      // lifelines
      P.forEach((p) => {
        d.node(p.x - 70, 30, 140, 52, { title: p.label, color: p.color, active: true, value: "L = " + clocks[p.id] });
        d.ctx.save(); d.ctx.strokeStyle = C.panelLine; d.ctx.setLineDash([4, 7]);
        d.ctx.beginPath(); d.ctx.moveTo(p.x, 82); d.ctx.lineTo(p.x, 520); d.ctx.stroke(); d.ctx.restore();
      });
      const y0 = 120, rh = 42;
      for (let i = 0; i <= ph.i && i < events.length; i++) {
        const e = events[i]; const y = y0 + i * rh; const px = P[e.p].x;
        const col = e.k === "recv" ? C.ok : P[e.p].color;
        if (e.k === "send") {
          const to = P[e.to].x;
          d.arrow(px, y, to, y + rh, { color: P[e.p].color, width: 2, label: "ts=" + drawn[i].after, progress: i === ph.i ? ph.p : 1 });
        } else {
          d.token(px, y, { r: 10, color: col, text: String(drawn[i].after) });
          d.text(px + 18, y, e.k, { size: 11, color: C.muted, align: "left" });
        }
      }
      ctx.setStatus("a → b implies L(a) < L(b)", "ok");
    },
  });
}
