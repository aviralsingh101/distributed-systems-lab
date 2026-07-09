// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { flowTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "domain-vs-integration-events",
  title: "Domain vs Integration Events",
  category: "lld-ddd",
  track: "lld",
  tier: "hidden-gem",
  archetype: "tradeoff",
  oneliner: `Inside context vs cross-boundary.`,
  sections: [
    { title: `The decision`, body: `<p>Inside context vs cross-boundary. This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>` },
    { title: `Option A — when it wins`, body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>` },
    { title: `Option B — when it wins`, body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>` },
    { title: `Comparison`, body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>` },
    { title: `Decision guide for Domain vs Integration Events`, body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>Domain vs Integration Events</b> with metrics, run game-days, and keep rollback documented before any migration.</p>` },
    { title: `Production checklist`, body: `<p>Before committing to either side of <b>Domain vs Integration Events</b>: load-test peak checkout, measure reconciliation drift, document RTO/RPO, and ensure on-call runbooks cover the failure modes each option introduces.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Domain vs Integration Events</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Domain vs Integration Events</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "comparison", svg: `<svg viewBox="0 0 480 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Domain vs Integration Events comparison">
<rect x="40" y="50" width="160" height="70" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="120" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option A</text><text x="120" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">simpler / fewer parts</text>
<rect x="280" y="50" width="160" height="70" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="360" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option B</text><text x="360" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">scale / specialization</text>
<text x="240" y="30" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Domain vs Integration Events</text>
<text x="120" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lower ops cost</text>
<text x="360" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">higher headroom</text>
<text x="240" y="135" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Prototype under realistic load before choosing</text>
</svg>`, caption: `Decision fork for Domain vs Integration Events — weigh simplicity vs scale before committing.` }
  ],
  related: [],
  
  
  template: "flow",
  sim: () => ({
    note: `Explore Domain vs Integration Events in the payment platform.`,
    toggles: [{ key: "fix", label: "Apply Domain vs Integration Events", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "client", label: "Client", color: C.client },
        { id: "order", label: "Order Service", color: C.service },
        { id: "ledger", label: "Ledger", color: C.ledger, kind: "db", value: "balance" },
        { id: "queue", label: "Event Queue", color: C.queue },
      ];
      const steps = fix ? [
        { from: "client", to: "order", label: "pay", good: true },
        { from: "order", to: "ledger", label: "Domain vs Integration Events ✓", good: true, set: { ledger: "committed" } },
        { from: "ledger", to: "queue", label: "event", good: true },
      ] : [
        { from: "client", to: "order", label: "pay" },
        { from: "order", to: "ledger", label: "naive write", bad: true, set: { ledger: "risk" } },
        { from: "order", to: "queue", label: "dual write?", dashed: true, bad: true },
      ];
      return {
        actors, steps, stepDur: 1.2,
        status: (r) => !r.done ? { text: "processing…", cls: "" }
          : fix ? { text: "Domain vs Integration Events applied", cls: "ok" } : { text: "pattern missing", cls: "err" },
      };
    },
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
