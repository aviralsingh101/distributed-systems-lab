// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { tradeoffTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "latency-vs-throughput",
  title: "Latency vs Throughput",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Fast p99 vs max requests/sec.`,
  sections: [
    { title: `The decision`, body: `<p>Fast p99 vs max requests/sec. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for Latency vs Throughput`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>Latency vs Throughput</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>Latency vs Throughput</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Latency vs Throughput</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Latency vs Throughput</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "comparison", svg: `<svg viewBox="0 0 480 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Latency vs Throughput comparison">
<rect x="40" y="50" width="160" height="70" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="120" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option A</text><text x="120" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">simpler / fewer parts</text>
<rect x="280" y="50" width="160" height="70" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="360" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option B</text><text x="360" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">scale / specialization</text>
<text x="240" y="30" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Latency vs Throughput</text>
<text x="120" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lower ops cost</text>
<text x="360" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">higher headroom</text>
<text x="240" y="135" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Prototype under realistic load before choosing</text>
</svg>`, caption: `Decision fork for Latency vs Throughput — weigh simplicity vs scale before committing.` }
  ],
  related: [],
  
  
  template: "tradeoff",
  sim: () => ({
    note: `Explore Latency vs Throughput in the payment platform.`,
    toggleLabel: "Switch approach",
    labelA: "Without pattern",
    labelB: "With Latency vs Throughput",
    sideA: () => ({ nodes: [
      { title: "Monolith path", active: true },
      { title: "Tight coupling", value: "risk" },
      { title: "Scale wall", value: "soon" },
    ]}),
    sideB: () => ({ nodes: [
      { title: "Clear boundary", active: true },
      { title: "Latency vs Throughput", value: "applied" },
      { title: "Independent scale", value: "ok" },
    ]}),
    status: (ctx, t, useB) => ({ text: useB ? "Latency vs Throughput — better fit" : "naive — hits limits", cls: useB ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
