// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, cycle, clamp } from "../../../sim/primitives.js";

export const meta = { id: "out-of-order", title: "Out-of-order Events", category: "ordering" };

export const content = {
  oneliner: `Shipped before Delivered.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Shipped before Delivered.</p>
<p>Without <b>Out-of-order Events</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>In Order Service code, <b>Out-of-order Events</b> structures classes and boundaries so wallet debits, Gateway calls, and outbox inserts remain testable. Handlers stay thin; domain services own invariants; repositories hide SQL.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Out-of-order Events</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Out-of-order Events</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Out-of-order Events</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Out-of-order Events</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Out-of-order Events structure">
<defs><marker id="fig-out-of-order-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Out-of-order Ev…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-out-of-order-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-out-of-order-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-out-of-order-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Out-of-order Events — class and integration boundaries</text>
</svg>`, caption: `Structure of the Out-of-order Events pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Two events race to the consumer over different network delays.",
    toggles: [{ key: "fix", label: "Sequence numbers + reorder buffer", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const fix = ctx.toggles.fix;
      const P = { x: 130, y: 280 }, Cn = { x: 870, y: 280 };
      d.node(P.x - 70, P.y - 34, 140, 68, { title: "Producer", color: C.service, active: true });
      d.node(Cn.x - 80, Cn.y - 40, 160, 80, { title: "Consumer", color: C.ledger, active: true });
      d.arrow(P.x + 70, P.y - 16, Cn.x - 80, Cn.y - 16, { color: C.faint, head: false, alpha: 0.25 });
      d.arrow(P.x + 70, P.y + 16, Cn.x - 80, Cn.y + 16, { color: C.faint, head: false, alpha: 0.25 });

      const per = 4;
      const tt = cycle(t, per);
      // e1 Shipped slow, e2 Delivered fast
      const p1 = clamp(tt / 0.9);       // slower
      const p2 = clamp((tt - 0.15) / 0.55); // faster, launched slightly later but quicker
      const e1 = d.along(P.x + 70, P.y - 16, Cn.x - 90, Cn.y - 16, p1);
      const e2 = d.along(P.x + 70, P.y + 16, Cn.x - 90, Cn.y + 16, p2);
      d.token(e1.x, e1.y, { r: 12, color: C.warn, label: "①Shipped" });

      // fix: buffer holds e2 until e1 lands
      let e2x = e2.x, e2y = e2.y, buffered = false;
      if (fix && p2 >= 1 && p1 < 1) { e2x = Cn.x - 150; e2y = Cn.y + 40; buffered = true; }
      d.token(e2x, e2y, { r: 12, color: C.gateway, label: buffered ? "②held" : "②Delivered" });

      const applied1 = p1 >= 1, applied2 = p2 >= 1;
      let line1 = "—", line2 = "—", bad = false;
      if (!fix) {
        if (applied2) line1 = "Delivered";
        if (applied2 && applied1) line2 = "Shipped";
        bad = applied2 && !applied1 || (applied2 && applied1);
      } else {
        if (applied1) line1 = "Shipped";
        if (applied1 && applied2) line2 = "Delivered";
      }
      d.text(Cn.x, Cn.y + 70, "applied: " + line1 + (line2 !== "—" ? " → " + line2 : ""), { size: 12, align: "center", color: bad ? C.err : C.ok, mono: true });

      ctx.setStatus(fix ? "reorder buffer → valid order (Shipped→Delivered)" : "applied Delivered before Shipped — impossible", fix ? "ok" : "err");
    },
  });
}
