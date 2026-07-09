// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { tradeoffTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "replication-topologies-tradeoff",
  title: "Replication Topologies",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Sync vs async replica lag.`,
  sections: [
    { title: `The decision`, body: `<p>Sync vs async replica lag. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for Replication Topologies`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>Replication Topologies</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>Replication Topologies</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Replication Topologies</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Replication Topologies</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "replica-lag", svg: `<svg viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replication lag">
<defs><marker id="fig-replication-topologies-tradeoff-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="40" y="40" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="85" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Primary</text><text x="85" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">writes</text>
<rect x="180" y="25" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="45" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 1</text>
<rect x="180" y="70" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="90" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 2</text>
<rect x="300" y="40" width="80" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="340" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Reader</text><text x="340" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale?</text>
<line x1="130" y1="55" x2="178" y2="41" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-replication-topologies-tradeoff-arr)"/>
<line x1="130" y1="60" x2="178" y2="86" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-replication-topologies-tradeoff-arr)"/>
<line x1="260" y1="41" x2="298" y2="52" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-replication-topologies-tradeoff-arr)"/>
</svg>`, caption: `Primary accepts writes; replicas converge asynchronously — reads may be stale.` }
  ],
  related: [],
  
  
  template: "tradeoff",
  sim: () => ({
    note: `Explore Replication Topologies in the payment platform.`,
    toggleLabel: "Switch approach",
    labelA: "Without pattern",
    labelB: "With Replication Topologies",
    sideA: () => ({ nodes: [
      { title: "Monolith path", active: true },
      { title: "Tight coupling", value: "risk" },
      { title: "Scale wall", value: "soon" },
    ]}),
    sideB: () => ({ nodes: [
      { title: "Clear boundary", active: true },
      { title: "Replication Topologies", value: "applied" },
      { title: "Independent scale", value: "ok" },
    ]}),
    status: (ctx, t, useB) => ({ text: useB ? "Replication Topologies — better fit" : "naive — hits limits", cls: useB ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
