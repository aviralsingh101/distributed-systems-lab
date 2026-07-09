// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "competing-consumers",
  title: "Competing Consumers",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Parallel workers on one queue.`,
  sections: [
    { title: `Motivation`, body: `<p>Parallel workers on one queue.</p>
<p>Without <b>Competing Consumers</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>In Order Service code, <b>Competing Consumers</b> structures classes and boundaries so wallet debits, Gateway calls, and outbox inserts remain testable. Handlers stay thin; domain services own invariants; repositories hide SQL.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Competing Consumers</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Competing Consumers</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Competing Consumers</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Competing Consumers</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: ["dead-letter-queue", "backpressure"],
  
  
  template: "topology",
  sim: () => ({
    note: `Explore Competing Consumers in the payment platform.`,
    toggles: [{ key: "fix", label: "Apply Competing Consumers", kind: "ok", value: false }],
    nodes: (ctx) => [
      { id: "c", x: 160, y: 280, title: "Client", color: C.client },
      { id: "o", x: 400, y: 200, title: "Order", color: C.service, active: true },
      { id: "g", x: 640, y: 280, title: "Gateway", color: C.gateway },
      { id: "l", x: 500, y: 400, title: "Ledger", color: C.ledger, value: ctx.toggles.fix ? "ok" : "?" },
      { id: "q", x: 840, y: 200, title: "Queue", color: C.queue },
    ],
    edges: (ctx) => [
      { from: "c", to: "o", active: true },
      { from: "o", to: "g", active: ctx.toggles.fix },
      { from: "g", to: "l", active: ctx.toggles.fix },
      { from: "l", to: "q", active: ctx.toggles.fix, label: "Competing Consumers" },
    ],
    activeEdge: (ctx, t) => ctx.toggles.fix ? { from: "l", to: "q" } : { from: "c", to: "o" },
    status: (ctx) => ({ text: ctx.toggles.fix ? "Competing Consumers in path" : "pattern absent", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
