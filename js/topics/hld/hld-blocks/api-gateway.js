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
<p>Traffic distribution uses health-checked backends. Algorithms include round-robin, least-connections, consistent hash on <code>wallet_id</code>, and geographic routing. Connection draining during deploy prevents in-flight charge requests from hitting removed pods.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, figureAfter: "gateway-fanout", body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>API Gateway</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>API Gateway</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>API Gateway</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>API Gateway</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>API Gateway</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
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