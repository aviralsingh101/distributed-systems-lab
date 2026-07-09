// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "service-discovery",
  title: "Service Discovery",
  category: "hld-blocks",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Find healthy instances dynamically.`,
  sections: [
    { title: `What is Service Discovery?`, body: `<p><b>Service Discovery</b> — Find healthy instances dynamically.</p>
<p>In the payment platform topology, <b>Service Discovery</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Service Discovery</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Service Discovery</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Service Discovery</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Service Discovery</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Service Discovery</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-flow", svg: `<svg viewBox="0 0 500 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Service Discovery flow"> <defs><marker id="fig-service-discovery-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <text x="250" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Request flow</text> <rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text> <rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Service Discov</text><text x="144" y="68" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this layer</text> <rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text> <rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ff8fab" stroke-width="1.5"/> <text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text> <rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text> <line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-service-discovery-arr)"/> <line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-service-discovery-arr)"/> <line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-service-discovery-arr)"/> <line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-service-discovery-arr)"/> </svg>`, caption: `Service Discovery on the ingress path — client traffic flows through this layer to backend services.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
