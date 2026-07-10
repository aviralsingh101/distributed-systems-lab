// @article-v2
// @sim-lab
// @figure-handcrafted
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const GATEWAY_SVG = `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="API Gateway fan-out">
  <defs><marker id="fig-api-gateway-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="280" y="20" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Client → API Gateway → backend services</text>
  <rect x="20" y="55" width="70" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="77" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <rect x="120" y="55" width="100" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="2"/>
  <text x="170" y="77" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API Gateway</text>
  <rect x="270" y="30" width="80" height="32" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="310" y="50" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Order</text>
  <rect x="270" y="70" width="80" height="32" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="310" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Wallet</text>
  <rect x="270" y="110" width="80" height="32" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="310" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Fraud</text>
  <rect x="400" y="40" width="130" height="66" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="465" y="62" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">auth · rate limit</text>
  <text x="465" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">TLS · routing</text>
  <text x="465" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">aggregation</text>
  <line x1="90" y1="73" x2="118" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-api-gateway-arr)"/>
  <line x1="220" y1="73" x2="268" y2="46" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-api-gateway-arr)"/>
  <line x1="220" y1="73" x2="268" y2="86" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-api-gateway-arr)"/>
  <line x1="220" y1="73" x2="268" y2="126" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-api-gateway-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "api-gateway",
  title: "API Gateway",
  category: "hld-blocks",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Edge routing, auth, and aggregation.`,
  sections: [
    { title: `What is API Gateway?`, body: `<p><b>API Gateway</b> — Edge routing, auth, and aggregation.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>API Gateway</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Edge routing, auth, and aggregation.</p><p>Trace one end-to-end request through <b>API Gateway</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>API Gateway</b> is infrastructure glue: draw it between clients and application tier, or between services and data/queue tiers. Mark whether it is stateful, horizontally scaled, and what fails independently.</p><p>Clarify single point of failure vs HA pair, and what config change requires drain vs hot reload.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>API Gateway</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>API Gateway</b>:</p><ul><li>Treating <b>API Gateway</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "gateway-fanout", svg: GATEWAY_SVG, caption: "API Gateway terminates client TLS, enforces auth and rate limits, and routes or aggregates calls to Order, Wallet, and Fraud services." },
  ],
  related: ["reverse-proxy", "rate-limiting", "bff-pattern"],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("api-gateway", stage, panel, stageEl);
}