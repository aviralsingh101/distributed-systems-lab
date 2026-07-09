// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { flowTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "scatter-gather",
  title: "Scatter-Gather",
  category: "hld-architecture",
  track: "hld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `Fan out queries, merge results.`,
  sections: [
    { title: `What is Scatter-Gather?`, body: `<p><b>Scatter-Gather</b> — Fan out queries, merge results.</p>
<p>In the payment platform topology, <b>Scatter-Gather</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Scatter-Gather</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Scatter-Gather</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Scatter-Gather</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Scatter-Gather</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Scatter-Gather</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "architecture", svg: `<svg viewBox="0 0 460 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scatter-Gather architecture"> <text x="230" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">System components</text> <rect x="30" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="90" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text> <rect x="170" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="230" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API</text> <rect x="310" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="370" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB</text> <rect x="30" y="95" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="90" y="121" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache</text> <rect x="170" y="95" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="230" y="121" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text> </svg>`, caption: `Scatter-Gather: high-level components and data flow for the system design.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
