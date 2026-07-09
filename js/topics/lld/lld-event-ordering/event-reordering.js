// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, cycle, clamp } from "../../../sim/primitives.js";

export const meta = { id: "event-reordering", title: "Event Reordering", category: "ordering" };

export const content = {
  oneliner: `Network delays scramble order.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Network delays scramble order.</p>
<p>Without <b>Event Reordering</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>In Order Service code, <b>Event Reordering</b> structures classes and boundaries so wallet debits, Gateway calls, and outbox inserts remain testable. Handlers stay thin; domain services own invariants; repositories hide SQL.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Event Reordering</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Event Reordering</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Event Reordering</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Event Reordering</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Event Reordering structure">
<defs><marker id="fig-event-reordering-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Reordering</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-reordering-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-reordering-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-reordering-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Event Reordering — class and integration boundaries</text>
</svg>`, caption: `Structure of the Event Reordering pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Two updates to one wallet, reordered by the network.",
    toggles: [{ key: "fix", label: "Partition by key (per-key order)", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const fix = ctx.toggles.fix;
      const P = { x: 130, y: 280 }, Cn = { x: 870, y: 280 };
      d.node(P.x - 70, P.y - 34, 140, 68, { title: "Producer", color: C.service, active: true });
      d.node(Cn.x - 80, Cn.y - 40, 160, 80, { title: "Wallet", color: C.ledger, active: true });

      const tt = cycle(t, 4);
      // u1 = set 50 (seq1), u2 = set 80 (seq2)
      // without fix u2 overtakes u1; with fix they keep order
      const p1 = clamp(tt / (fix ? 0.75 : 0.95));
      const p2 = clamp((tt - 0.1) / (fix ? 0.9 : 0.5));
      const e1 = d.along(P.x + 70, P.y - 16, Cn.x - 90, Cn.y - 16, p1);
      const e2 = d.along(P.x + 70, P.y + 16, Cn.x - 90, Cn.y + 16, p2);
      d.arrow(P.x + 70, P.y - 16, Cn.x - 80, Cn.y - 16, { color: C.faint, head: false, alpha: 0.2 });
      d.arrow(P.x + 70, P.y + 16, Cn.x - 80, Cn.y + 16, { color: C.faint, head: false, alpha: 0.2 });
      d.token(e1.x, e1.y, { r: 12, color: C.warn, label: "①set50" });
      d.token(e2.x, e2.y, { r: 12, color: C.gateway, label: "②set80" });

      // final applied value
      const a1 = p1 >= 1, a2 = p2 >= 1;
      let last = "?";
      if (fix) { last = a2 ? "80" : (a1 ? "50" : "?"); }
      else { last = a1 ? "50" : (a2 ? "80" : "?"); } // wrong: u1 lands last
      const good = last === "80" || last === "?";
      d.text(Cn.x, Cn.y + 74, "balance = " + last, { size: 14, align: "center", mono: true, weight: 700, color: good ? C.ok : C.err });

      ctx.setStatus(fix ? "per-key order → final = 80 (correct)" : "reordered → final = 50 (stale wins)", fix ? "ok" : "err");
    },
  });
}
