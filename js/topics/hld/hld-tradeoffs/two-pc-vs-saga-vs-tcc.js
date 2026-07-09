// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { tradeoffTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "two-pc-vs-saga-vs-tcc",
  title: "2PC vs Saga vs TCC",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Distributed commit patterns compared.`,
  sections: [
    { title: `The decision`, body: `<p>Distributed commit patterns compared. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for 2PC vs Saga vs TCC`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>2PC vs Saga vs TCC</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>2PC vs Saga vs TCC</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>2PC vs Saga vs TCC</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>2PC vs Saga vs TCC</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "saga-steps", svg: `<svg viewBox="0 0 520 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Saga steps">
<defs><marker id="fig-two-pc-vs-saga-vs-tcc-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="20" y="35" width="80" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="60" y="57" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Reserve</text>
<rect x="130" y="35" width="80" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="170" y="57" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Charge</text>
<rect x="240" y="35" width="80" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="280" y="57" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ship</text>
<rect x="350" y="55" width="90" height="30" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="395" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Compensate</text><text x="395" y="84" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">on failure</text>
<line x1="100" y1="53" x2="128" y2="53" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-two-pc-vs-saga-vs-tcc-arr)"/>
<line x1="210" y1="53" x2="238" y2="53" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-two-pc-vs-saga-vs-tcc-arr)"/>
<text x="260" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Each step has a matching undo action</text>
</svg>`, caption: `Saga: forward steps with compensating transactions on failure — no global lock.` }
  ],
  related: [],
  
  
  template: "tradeoff",
  sim: () => ({
    note: `Explore 2PC vs Saga vs TCC in the payment platform.`,
    toggleLabel: "Switch approach",
    labelA: "Without pattern",
    labelB: "With 2PC vs Saga vs TCC",
    sideA: () => ({ nodes: [
      { title: "Monolith path", active: true },
      { title: "Tight coupling", value: "risk" },
      { title: "Scale wall", value: "soon" },
    ]}),
    sideB: () => ({ nodes: [
      { title: "Clear boundary", active: true },
      { title: "2PC vs Saga vs TCC", value: "applied" },
      { title: "Independent scale", value: "ok" },
    ]}),
    status: (ctx, t, useB) => ({ text: useB ? "2PC vs Saga vs TCC — better fit" : "naive — hits limits", cls: useB ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
