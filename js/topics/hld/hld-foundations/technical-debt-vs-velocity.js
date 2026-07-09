// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "technical-debt-vs-velocity",
  title: "Technical Debt vs Velocity",
  category: "hld-foundations",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Ship fast now vs pay interest later.`,
  sections: [
    { title: `The decision`, body: `<p>Ship fast now vs pay interest later. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for Technical Debt vs Velocity`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>Technical Debt vs Velocity</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>Technical Debt vs Velocity</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Technical Debt vs Velocity</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Technical Debt vs Velocity</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
