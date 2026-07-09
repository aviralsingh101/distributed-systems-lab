// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "two-pc", title: "Two-Phase Commit (2PC)", category: "transactions" };

export const content = {
  oneliner: `Prepare/commit; coordinator can block.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Prepare/commit; coordinator can block.</p>
<p>Without <b>2PC</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>2PC</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>2PC</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>2PC</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>2PC</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "2pc-phases", svg: `<svg viewBox="0 0 420 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="2PC">
<rect x="30" y="38" width="90" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="75" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Coordinator</text>
<rect x="160" y="25" width="70" height="30" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="195" y="44" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB A</text>
<rect x="160" y="65" width="70" height="30" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="195" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB B</text>
<text x="280" y="40" fill="#93a1bd" font-size="10" font-family="system-ui">1. PREPARE</text>
<text x="280" y="75" fill="#93a1bd" font-size="10" font-family="system-ui">2. COMMIT</text>
</svg>`, caption: `Two-phase commit: Prepare (vote) then Commit — coordinator blocks on failure.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "Coordinator drives PREPARE then COMMIT across participants.",
    toggles: [{ key: "crash", label: "Coordinator crashes after PREPARE", kind: "warn", value: false }],
    scenario(ctx) {
      const crash = ctx.toggles.crash;
      const actors = [
        { id: "p1", label: "Wallet DB", color: C.ledger, kind: "db", value: "idle" },
        { id: "c", label: "Coordinator", color: C.accent },
        { id: "p2", label: "Inventory DB", color: C.gateway, kind: "db", value: "idle" },
      ];
      let steps = [
        { from: "c", to: "p1", label: "PREPARE", set: { p1: "prepared (locked)" } },
        { from: "c", to: "p2", label: "PREPARE", set: { p2: "prepared (locked)" } },
      ];
      if (!crash) {
        steps.push(
          { from: "c", to: "p1", label: "COMMIT", good: true, set: { p1: "committed" } },
          { from: "c", to: "p2", label: "COMMIT", good: true, set: { p2: "committed" } },
        );
      } else {
        steps.push(
          { from: "c", to: "c", label: "✖ crash", self: true, bad: true, set: { c: "DOWN" } },
          { from: "p1", to: "p1", label: "waiting… locks held", self: true, bad: true, set: { p1: "BLOCKED" } },
          { from: "p2", to: "p2", label: "waiting… locks held", self: true, bad: true, set: { p2: "BLOCKED" } },
        );
      }
      return {
        actors, steps, stepDur: 1.1,
        status: (r) => !r.done ? { text: "phase 1: prepare…", cls: "" }
          : crash ? { text: "participants blocked (holding locks)", cls: "err" } : { text: "atomic commit across both DBs", cls: "ok" },
      };
    },
  });
}
