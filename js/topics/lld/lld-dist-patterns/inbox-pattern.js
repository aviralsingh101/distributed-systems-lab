// @article-v2
import { makeTopic, paymentFlow, actors } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "inbox-pattern",
  title: "Inbox / Idempotent Consumer",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Dedup incoming messages safely.`,
  sections: [
    { title: `Motivation`, body: `<p>Dedup incoming messages safely.</p>
<p>Without <b>Inbox / Idempotent Consumer</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>In Order Service code, <b>Inbox / Idempotent Consumer</b> structures classes and boundaries so wallet debits, Gateway calls, and outbox inserts remain testable. Handlers stay thin; domain services own invariants; repositories hide SQL.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Inbox / Idempotent Consumer</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Inbox / Idempotent Consumer</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Inbox / Idempotent Consumer</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Inbox / Idempotent Consumer</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: ["transactional-outbox", "exactly-once", "deduplication"],
  
  
  template: "flow",
  sim: () => paymentFlow({
    note: "Same event twice — inbox dedupes.",
    fixLabel: "Inbox deduplication",
    actors: () => [
      actors.queue("evt×2"),
      { id: "consumer", label: "Notification", color: "#7c5cff" },
      { id: "inbox", label: "Inbox", color: "#ffb454", kind: "db", value: "ids" },
    ],
    stepsBroken: () => [
      { from: "queue", to: "consumer", label: "deliver #1", set: { consumer: "notify sent" } },
      { from: "queue", to: "consumer", label: "dup", bad: true, set: { consumer: "DUPLICATE!" } },
    ],
    stepsFixed: () => [
      { from: "queue", to: "consumer", label: "deliver" },
      { from: "consumer", to: "inbox", label: "record + notify", good: true, set: { inbox: "msg-1" } },
      { from: "queue", to: "consumer", label: "dup" },
      { from: "consumer", to: "inbox", label: "skip", good: true, dashed: true, set: { consumer: "no-op" } },
    ],
    statusOk: "duplicate ignored",
    statusBad: "duplicate side effect",
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
