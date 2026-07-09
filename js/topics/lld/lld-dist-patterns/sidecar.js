// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";

const topic = makeTopic({
  id: "sidecar",
  title: "Sidecar",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Helper container beside main app.`,
  sections: [
    { title: `Motivation`, body: `<p>Helper container beside main app.</p>
<p>Without <b>Sidecar</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>In Order Service code, <b>Sidecar</b> structures classes and boundaries so wallet debits, Gateway calls, and outbox inserts remain testable. Handlers stay thin; domain services own invariants; repositories hide SQL.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Sidecar</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Sidecar</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Sidecar</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Sidecar</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: ["ambassador", "circuit-breaker"],
  
  
  template: "topology",
  sim: () => ({
    note: "App + sidecar in one pod.",
    toggles: [{ key: "fix", label: "Sidecar enabled", kind: "ok", value: false }],
    nodes: (ctx) => [
      { id: "app", x: 400, y: 260, title: "Order Service", color: C.service, active: true },
      { id: "side", x: 400, y: 380, title: "Sidecar", color: C.accent, active: ctx.toggles.fix, value: ctx.toggles.fix ? "mTLS" : "off" },
      { id: "ledger", x: 700, y: 320, title: "Ledger", color: C.ledger },
    ],
    edges: (ctx) => [
      { from: "app", to: "side", active: ctx.toggles.fix },
      { from: "side", to: "ledger", active: ctx.toggles.fix, label: "mTLS" },
      { from: "app", to: "ledger", active: !ctx.toggles.fix, color: C.warn },
    ],
    activeEdge: (ctx) => ctx.toggles.fix ? { from: "side", to: "ledger" } : { from: "app", to: "ledger" },
    status: (ctx) => ({ text: ctx.toggles.fix ? "infra via sidecar" : "logic in app", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
