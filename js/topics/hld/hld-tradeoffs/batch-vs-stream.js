// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "batch-vs-stream",
  title: "Batch vs Stream",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Periodic jobs vs continuous processing.`,
  sections: [
    { title: `The decision`, body: `<p>Periodic jobs vs continuous processing. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for Batch vs Stream`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>Batch vs Stream</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>Batch vs Stream</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Batch vs Stream</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Batch vs Stream</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "comparison", svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Batch vs Stream comparison"> <rect x="40" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="120" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option A</text><text x="120" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <rect x="280" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="360" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option B</text><text x="360" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <text x="240" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">vs</text> </svg>`, caption: `Batch vs Stream: tradeoff comparison — when to choose each approach.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
