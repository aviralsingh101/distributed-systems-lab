// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "consistent-hashing-placement",
  title: "Consistent Hashing (placement)",
  category: "hld-theory",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Minimal key movement when nodes change.`,
  sections: [
    { title: `What is Consistent Hashing (placement)?`, body: `<p><b>Consistent Hashing (placement)</b> — Minimal key movement when nodes change.</p>
<p>In the payment platform topology, <b>Consistent Hashing (placement)</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Consistent Hashing (placement)</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Consistent Hashing (placement)</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Consistent Hashing (placement)</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Consistent Hashing (placement)</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Consistent Hashing (placement)</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "hash-ring", svg: `<svg viewBox="0 0 400 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Consistent Hashing (placement) ring"> <circle cx="200" cy="105" r="72" fill="none" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/> <rect x="172" y="15" width="56" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="200" y="27" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Node A</text><text x="200" y="43" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vnode</text> <rect x="234.35382907247958" y="123" width="56" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="262.3538290724796" y="135" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Node B</text><text x="262.3538290724796" y="151" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vnode</text> <rect x="109.64617092752042" y="123" width="56" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="137.64617092752042" y="135" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Node C</text><text x="137.64617092752042" y="151" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vnode</text> <circle cx="238.18376618407356" cy="66.81623381592644" r="5" fill="#9aa7c7"/> <text x="238.18376618407356" y="57.81623381592644" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">k1</text> <line x1="238.18376618407356" y1="66.81623381592644" x2="262.3538290724796" y2="141" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 2"/> <circle cx="200" cy="159" r="5" fill="#9aa7c7"/> <text x="200" y="150" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">k2</text> <line x1="200" y1="159" x2="137.64617092752042" y2="141" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 2"/> <circle cx="149.25659847756094" cy="86.53091226041388" r="5" fill="#9aa7c7"/> <text x="149.25659847756094" y="77.53091226041388" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">k3</text> <line x1="149.25659847756094" y1="86.53091226041388" x2="200" y2="33" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 2"/> <text x="200" y="109" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">hash ring</text> <text x="200" y="198" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">key → clockwise nearest vnode</text> </svg>`, caption: `Consistent Hashing (placement): keys sit on a hash ring — each maps clockwise to the nearest virtual node; add/remove shifts only adjacent ranges.` },
  ],
  related: ["consistent-hashing"],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("consistent-hashing-placement", stage, panel, stageEl);
}