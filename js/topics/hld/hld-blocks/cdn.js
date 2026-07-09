// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "cdn",
  title: "CDN",
  category: "hld-blocks",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Cache static assets close to users.`,
  sections: [
    { title: `What is CDN?`, body: `<p><b>CDN</b> — Cache static assets close to users.</p>
<p>Edge caches store responses closer to clients. Cache keys typically include hostname, path, and query string. Purge APIs and short TTLs on dynamic payment status endpoints prevent stale balance displays.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>CDN</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>CDN</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>CDN</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>CDN</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>CDN</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "cdn-edge", svg: `<svg viewBox="0 0 440 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CDN edge">
<rect x="30" y="38" width="64" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="62" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">User EU</text>
<rect x="130" y="38" width="80" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="170" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">CDN PoP</text><text x="170" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">cache hit</text>
<rect x="250" y="38" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="290" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Origin</text><text x="290" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">miss only</text>
<rect x="360" y="38" width="64" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="392" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<text x="220" y="20" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Edge serves cached responses — origin on miss</text>
</svg>`, caption: `CDN caches static assets and cacheable API responses at edge PoPs close to users.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CDN structure">
<defs><marker id="fig-cdn-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">CDN</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdn-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdn-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdn-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">CDN — class and integration boundaries</text>
</svg>`, caption: `Structure of the CDN pattern — components and data flow in Order Service.` }
  ],
  related: ["caching-tiers", "reverse-proxy", "cache-strategies"],
  
  
  template: "topology",
  sim: () => ({
    note: `Explore CDN in the payment platform.`,
    toggles: [{ key: "fix", label: "Apply CDN", kind: "ok", value: false }],
    nodes: (ctx) => [
      { id: "c", x: 160, y: 280, title: "Client", color: C.client },
      { id: "o", x: 400, y: 200, title: "Order", color: C.service, active: true },
      { id: "g", x: 640, y: 280, title: "Gateway", color: C.gateway },
      { id: "l", x: 500, y: 400, title: "Ledger", color: C.ledger, value: ctx.toggles.fix ? "ok" : "?" },
      { id: "q", x: 840, y: 200, title: "Queue", color: C.queue },
    ],
    edges: (ctx) => [
      { from: "c", to: "o", active: true },
      { from: "o", to: "g", active: ctx.toggles.fix },
      { from: "g", to: "l", active: ctx.toggles.fix },
      { from: "l", to: "q", active: ctx.toggles.fix, label: "CDN" },
    ],
    activeEdge: (ctx, t) => ctx.toggles.fix ? { from: "l", to: "q" } : { from: "c", to: "o" },
    status: (ctx) => ({ text: ctx.toggles.fix ? "CDN in path" : "pattern absent", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
