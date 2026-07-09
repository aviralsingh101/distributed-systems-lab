// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { pipelineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "outbox-inbox-combo",
  title: "Outbox + Inbox Combo",
  category: "lld-async",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Reliable handoff between services.`,
  sections: [
    { title: `Motivation`, body: `<p>Reliable handoff between services.</p>
<p>Without <b>Outbox + Inbox Combo</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Outbox + Inbox Combo</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Outbox + Inbox Combo</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Outbox + Inbox Combo</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Outbox + Inbox Combo</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: ["transactional-outbox", "inbox-pattern", "exactly-once"],
  
  
  template: "pipeline",
  sim: () => ({
    note: `Explore Outbox + Inbox Combo in the payment platform.`,
    toggles: [{ key: "fix", label: "Enable Outbox + Inbox Combo", kind: "ok", value: false }],
    stages: (ctx) => [
      { title: "Client", color: C.client },
      { title: "Order", color: C.service },
      { title: "Outbox + Inbox Combo", color: ctx.toggles.fix ? C.ok : C.warn },
      { title: "Ledger", color: C.ledger },
      { title: "Queue", color: C.queue },
    ],
    activeIndex: (ctx, t) => ctx.toggles.fix ? Math.min(4, Math.floor(t * 0.6) % 5) : Math.min(2, Math.floor(t * 0.6) % 3),
    status: (ctx) => ({ text: ctx.toggles.fix ? "pipeline complete" : "bottleneck mid-pipeline", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
