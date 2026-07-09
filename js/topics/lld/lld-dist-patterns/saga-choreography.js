// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { flowTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "saga-choreography",
  title: "Saga Choreography",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Services react to events, no central.`,
  sections: [
    { title: `Motivation`, body: `<p>Services react to events, no central.</p>
<p>Without <b>Saga Choreography</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Saga Choreography</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Saga Choreography</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Saga Choreography</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Saga Choreography</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: ["saga"],
  
  
  template: "flow",
  sim: () => ({
    note: `Explore Saga Choreography in the payment platform.`,
    toggles: [{ key: "fix", label: "Apply Saga Choreography", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "client", label: "Client", color: C.client },
        { id: "order", label: "Order Service", color: C.service },
        { id: "ledger", label: "Ledger", color: C.ledger, kind: "db", value: "balance" },
        { id: "queue", label: "Event Queue", color: C.queue },
      ];
      const steps = fix ? [
        { from: "client", to: "order", label: "pay", good: true },
        { from: "order", to: "ledger", label: "Saga Choreography ✓", good: true, set: { ledger: "committed" } },
        { from: "ledger", to: "queue", label: "event", good: true },
      ] : [
        { from: "client", to: "order", label: "pay" },
        { from: "order", to: "ledger", label: "naive write", bad: true, set: { ledger: "risk" } },
        { from: "order", to: "queue", label: "dual write?", dashed: true, bad: true },
      ];
      return {
        actors, steps, stepDur: 1.2,
        status: (r) => !r.done ? { text: "processing…", cls: "" }
          : fix ? { text: "Saga Choreography applied", cls: "ok" } : { text: "pattern missing", cls: "err" },
      };
    },
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
