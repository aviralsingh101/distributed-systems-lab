// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { layerTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "encapsulation",
  title: "Encapsulation",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Hide state; expose behavior.`,
  sections: [
    { title: `Motivation`, body: `<p>Hide state; expose behavior.</p>
<p>Without <b>Encapsulation</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Under network partition, systems choose between strong consistency and availability. Quorum reads/writes use <code>R + W > N</code>. Payment ledgers often favor CP on the primary write path with async replica convergence for analytics.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Encapsulation</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Encapsulation</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Encapsulation</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Encapsulation</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "cap-triangle", svg: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CAP theorem">
<polygon points="150,25 40,135 260,135" fill="none" stroke="#5b9dff" stroke-width="1.5"/>
<text x="150" y="20" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Consistency</text>
<text x="30" y="150" fill="#cdd6e8" font-size="11" font-family="system-ui">Availability</text>
<text x="230" y="150" fill="#cdd6e8" font-size="11" font-family="system-ui">Partition</text>
<text x="150" y="100" text-anchor="middle" fill="#ff5c6c" font-size="10" font-family="system-ui">pick 2 under partition</text>
</svg>`, caption: `CAP: under partition, choose Consistency or Availability — not both.` }
  ],
  related: [],
  
  
  template: "layer",
  sim: () => ({
    note: `Explore Encapsulation in the payment platform.`,
    toggles: [{ key: "fix", label: "Apply layering", kind: "ok", value: false }],
    layers: (ctx) => [
      { name: "API", components: [{ title: "REST/gRPC", active: true }] },
      { name: "Domain", components: [{ title: "Encapsulation", active: ctx.toggles.fix, color: C.accent }] },
      { name: "Data", components: [{ title: "Ledger", color: C.ledger }, { title: "Queue", color: C.queue }] },
    ],
    status: (ctx) => ({ text: ctx.toggles.fix ? "clean separation" : "logic leaks across layers", cls: ctx.toggles.fix ? "ok" : "err" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
