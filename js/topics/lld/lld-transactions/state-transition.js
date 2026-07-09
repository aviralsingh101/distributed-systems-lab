// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "state-transition", title: "A→B→C State Transition", category: "transactions" };

export const content = {
  oneliner: `Serialize transitions so C is reached.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Serialize transitions so C is reached.</p>
<p>Without <b>A→B→C State Transition</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>A→B→C State Transition</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>A→B→C State Transition</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>A→B→C State Transition</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>A→B→C State Transition</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A→B→C State Transition structure">
<defs><marker id="fig-state-transition-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">A→B→C State Tra…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-state-transition-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-state-transition-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-state-transition-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">A→B→C State Transition — class and integration boundaries</text>
</svg>`, caption: `Structure of the A→B→C State Transition pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "R1: A→B. R2: advance to C. Does it reach C?",
    toggles: [{ key: "fix", label: "Serialize transitions (queue / retry)", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "r1", label: "Request 1 (→B)", color: C.service },
        { id: "s", label: "Order state", color: C.ledger, kind: "db", value: "A" },
        { id: "r2", label: "Request 2 (→C)", color: C.gateway },
      ];
      let steps;
      if (!fix) {
        steps = [
          { from: "r1", to: "s", label: "A→B (lock)", set: { s: "A→B…", r1: "holds lock" } },
          { from: "r2", to: "s", label: "advance to C", bad: true, dashed: true, set: { r2: "lock busy → error" } },
          { from: "r1", to: "s", label: "commit B", set: { s: "B", r1: "done" } },
          { from: "r2", to: "r2", label: "gave up", self: true, bad: true, set: { r2: "abandoned" } },
        ];
      } else {
        steps = [
          { from: "r1", to: "s", label: "A→B (lock)", set: { s: "A→B…", r1: "holds lock" } },
          { from: "r2", to: "s", label: "enqueue →C", set: { r2: "queued" } },
          { from: "r1", to: "s", label: "commit B", set: { s: "B", r1: "done" } },
          { from: "r2", to: "s", label: "apply B→C", good: true, set: { s: "C", r2: "done" } },
        ];
      }
      return {
        actors, steps, stepDur: 1.1,
        status: (r) => !r.done ? { text: "advancing state…", cls: "" }
          : fix ? { text: "final state C (CAPTURED) ✓", cls: "ok" } : { text: "stuck at B — C never reached", cls: "err" },
      };
    },
  });
}
