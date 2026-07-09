// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { stateMachineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "saga-orchestration",
  title: "Saga Orchestration",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Central coordinator drives steps.`,
  sections: [
    { title: `Motivation`, body: `<p>Central coordinator drives steps.</p>
<p>Without <b>Saga Orchestration</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Saga Orchestration</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Saga Orchestration</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Saga Orchestration</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Saga Orchestration</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: ["saga", "two-pc"],
  
  
  template: "stateMachine",
  sim: () => ({
    note: `Explore Saga Orchestration in the payment platform.`,
    toggles: [{ key: "fix", label: "Valid transitions only", kind: "ok", value: false }],
    states: (ctx) => [
      { id: "pending", label: "Pending", x: 200, y: 280, color: C.service },
      { id: "active", label: "Saga Orchestration", x: 500, y: 280, color: C.accent, good: true },
      { id: "done", label: "Settled", x: 800, y: 280, color: C.ok, good: true },
      { id: "bad", label: "Invalid", x: 500, y: 420, color: C.err, bad: true },
    ],
    currentState: (ctx, t) => {
      if (!ctx.toggles.fix && (t % 6) > 4) return "bad";
      return ["pending", "active", "done"][Math.floor((t * 0.35) % 3)];
    },
    transitions: [{ from: "pending", to: "active", label: "apply" }, { from: "active", to: "done", label: "commit" }],
    status: (ctx) => ({ text: ctx.toggles.fix ? "state machine guards flow" : "illegal states possible", cls: ctx.toggles.fix ? "ok" : "err" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
