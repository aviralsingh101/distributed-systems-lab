// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "saga", title: "Saga Pattern", category: "transactions" };

export const content = {
  oneliner: `Compensations instead of rollback.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Compensations instead of rollback.</p>
<p>Without <b>Saga Pattern</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Saga Pattern</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Saga Pattern</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Saga Pattern</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Saga Pattern</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "saga-steps", svg: `<svg viewBox="0 0 520 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Saga steps">
<defs><marker id="fig-saga-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="20" y="35" width="80" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="60" y="57" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Reserve</text>
<rect x="130" y="35" width="80" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="170" y="57" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Charge</text>
<rect x="240" y="35" width="80" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="280" y="57" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ship</text>
<rect x="350" y="55" width="90" height="30" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="395" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Compensate</text><text x="395" y="84" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">on failure</text>
<line x1="100" y1="53" x2="128" y2="53" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-arr)"/>
<line x1="210" y1="53" x2="238" y2="53" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-arr)"/>
<text x="260" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Each step has a matching undo action</text>
</svg>`, caption: `Saga: forward steps with compensating transactions on failure — no global lock.` }
  ],
  related: ["saga-orchestration", "saga-choreography", "two-pc-vs-saga-vs-tcc"],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "Forward steps commit locally; failure triggers compensations.",
    toggles: [{ key: "fail", label: "Shipment step fails", kind: "warn", value: true }],
    scenario(ctx) {
      const fail = ctx.toggles.fail;
      const actors = [
        { id: "inv", label: "Inventory", color: C.gateway, kind: "db", value: "10" },
        { id: "o", label: "Order Saga", color: C.accent },
        { id: "w", label: "Wallet", color: C.ledger, kind: "db", value: "100" },
      ];
      let steps = [
        { from: "o", to: "inv", label: "reserve stock ✓", good: true, set: { inv: "9" } },
        { from: "o", to: "w", label: "charge 40 ✓", good: true, set: { w: "60" } },
      ];
      if (!fail) {
        steps.push({ from: "o", to: "o", label: "create shipment ✓", self: true, good: true, set: { o: "complete" } });
      } else {
        steps.push(
          { from: "o", to: "o", label: "create shipment ✕", self: true, bad: true, set: { o: "compensating" } },
          { from: "o", to: "w", label: "compensate: refund 40", bad: true, set: { w: "100" } },
          { from: "o", to: "inv", label: "compensate: release stock", bad: true, set: { inv: "10", o: "undone" } },
        );
      }
      return {
        actors, steps, stepDur: 1.1,
        status: (r) => !r.done ? { text: "running saga steps…", cls: "" }
          : fail ? { text: "compensations reversed everything (eventually consistent)", cls: "ok" } : { text: "all local transactions committed", cls: "ok" },
      };
    },
  });
}
