// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { tradeoffTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "lb-vs-proxy-vs-gateway",
  title: "LB vs Proxy vs Gateway",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Where each layer belongs.`,
  sections: [
    { title: `The decision`, body: `<p>Where each layer belongs. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for LB vs Proxy vs Gateway`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>LB vs Proxy vs Gateway</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>LB vs Proxy vs Gateway</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>LB vs Proxy vs Gateway</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>LB vs Proxy vs Gateway</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "gateway", svg: `<svg viewBox="0 0 480 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="API gateway">
<defs><marker id="fig-lb-vs-proxy-vs-gateway-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="20" y="38" width="64" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="52" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Clients</text>
<rect x="110" y="38" width="100" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="160" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API Gateway</text><text x="160" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">auth + route</text>
<rect x="240" y="20" width="72" height="30" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="276" y="39" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Orders</text>
<rect x="240" y="60" width="72" height="30" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="276" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Wallets</text>
<rect x="340" y="38" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="376" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<line x1="84" y1="56" x2="108" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lb-vs-proxy-vs-gateway-arr)"/>
<line x1="210" y1="48" x2="238" y2="35" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lb-vs-proxy-vs-gateway-arr)"/>
<line x1="210" y1="64" x2="238" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lb-vs-proxy-vs-gateway-arr)"/>
</svg>`, caption: `API gateway: auth, rate limit, routing, and aggregation at the edge.` }
  ],
  related: [],
  
  
  template: "tradeoff",
  sim: () => ({
    note: `Explore LB vs Proxy vs Gateway in the payment platform.`,
    toggleLabel: "Switch approach",
    labelA: "Without pattern",
    labelB: "With LB vs Proxy vs Gateway",
    sideA: () => ({ nodes: [
      { title: "Monolith path", active: true },
      { title: "Tight coupling", value: "risk" },
      { title: "Scale wall", value: "soon" },
    ]}),
    sideB: () => ({ nodes: [
      { title: "Clear boundary", active: true },
      { title: "LB vs Proxy vs Gateway", value: "applied" },
      { title: "Independent scale", value: "ok" },
    ]}),
    status: (ctx, t, useB) => ({ text: useB ? "LB vs Proxy vs Gateway — better fit" : "naive — hits limits", cls: useB ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
