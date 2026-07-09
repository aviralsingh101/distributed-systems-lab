// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { layerTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "proxy",
  title: "Proxy",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Surrogate controlling access.`,
  sections: [
    { title: `Motivation`, body: `<p>Surrogate controlling access.</p>
<p>Without <b>Proxy</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Traffic distribution uses health-checked backends. Algorithms include round-robin, least-connections, consistent hash on <code>wallet_id</code>, and geographic routing. Connection draining during deploy prevents in-flight charge requests from hitting removed pods.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Proxy</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Proxy</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Proxy</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Proxy</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "lb-layers", svg: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="L4 vs L7">
<rect x="30" y="25" width="100" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="80" y="37" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">L4 LB</text><text x="80" y="57" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">TCP/IP only</text>
<rect x="30" y="70" width="100" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="80" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">L7 LB</text><text x="80" y="102" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">HTTP aware</text>
<rect x="180" y="45" width="80" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="220" y="69" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Backends</text>
<rect x="300" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="345" y="69" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Health chk</text>
<text x="210" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">L7 can route /api vs /static</text>
</svg>`, caption: `L4 load balancer routes TCP connections; L7 understands HTTP paths and headers.` }
  ],
  related: [],
  
  
  template: "layer",
  sim: () => ({
    note: `Explore Proxy in the payment platform.`,
    toggles: [{ key: "fix", label: "Apply layering", kind: "ok", value: false }],
    layers: (ctx) => [
      { name: "API", components: [{ title: "REST/gRPC", active: true }] },
      { name: "Domain", components: [{ title: "Proxy", active: ctx.toggles.fix, color: C.accent }] },
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
