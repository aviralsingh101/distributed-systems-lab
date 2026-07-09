// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { stateMachineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "delayed-scheduled-messages",
  title: "Delayed / Scheduled Messages",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Deliver at future time.`,
  sections: [
    { title: `Motivation`, body: `<p>Deliver at future time.</p>
<p>Without <b>Delayed / Scheduled Messages</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Messages flow through brokers with partitions for parallelism. Consumer groups rebalance on member join/leave. At-least-once delivery requires idempotent handlers keyed on <code>payment_id</code> or <code>event_id</code>.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Delayed / Scheduled Messages</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Delayed / Scheduled Messages</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Delayed / Scheduled Messages</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Delayed / Scheduled Messages</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Delayed / Scheduled Messages structure">
<defs><marker id="fig-delayed-scheduled-messages-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Delayed / Sched…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-delayed-scheduled-messages-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-delayed-scheduled-messages-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-delayed-scheduled-messages-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Delayed / Scheduled Messages — class and integration boundaries</text>
</svg>`, caption: `Structure of the Delayed / Scheduled Messages pattern — components and data flow in Order Service.` }
  ],
  related: [],
  
  
  template: "stateMachine",
  sim: () => ({
    note: `Explore Delayed / Scheduled Messages in the payment platform.`,
    toggles: [{ key: "fix", label: "Valid transitions only", kind: "ok", value: false }],
    states: (ctx) => [
      { id: "pending", label: "Pending", x: 200, y: 280, color: C.service },
      { id: "active", label: "Delayed / Scheduled Messages", x: 500, y: 280, color: C.accent, good: true },
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
