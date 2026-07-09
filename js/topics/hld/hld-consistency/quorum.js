// @article-v2
// @sim-lab
import { C } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "quorum", title: "Quorum", category: "consistency" };

export const content = {
  oneliner: `R + W > N.`,
  archetype: "concept",
  sections: [
    { title: `What is Quorum?`, body: `<p><b>Quorum</b> — R + W > N.</p>
<p>Under network partition, systems choose between strong consistency and availability. Quorum reads/writes use <code>R + W > N</code>. Payment ledgers often favor CP on the primary write path with async replica convergence for analytics.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Quorum</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Quorum</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Quorum</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Quorum</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Quorum</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "quorum", svg: `<svg viewBox="0 0 480 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Quorum quorum"> <defs><marker id="fig-quorum-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <circle cx="240" cy="95" r="62" fill="none" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/> <rect x="216" y="17" width="48" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="240" y="27" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R1</text><text x="240" y="43" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W</text> <rect x="274.9655040102995" y="59.84094634875326" width="48" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="298.9655040102995" y="69.84094634875326" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R2</text><text x="298.9655040102995" y="85.84094634875326" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W</text> <rect x="252.4426856421333" y="129.15905365124675" width="48" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="276.4426856421333" y="139.15905365124675" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R3</text><text x="276.4426856421333" y="155.15905365124675" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W+R</text> <rect x="179.5573143578667" y="129.15905365124675" width="48" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="203.5573143578667" y="139.15905365124675" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R4</text><text x="203.5573143578667" y="155.15905365124675" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R</text> <rect x="157.03449598970047" y="59.84094634875325" width="48" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="181.03449598970047" y="69.84094634875325" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R5</text><text x="181.03449598970047" y="85.84094634875325" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R</text> <rect x="390" y="55" width="72" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="426" y="69" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text><text x="426" y="85" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R=3</text> <line x1="390" y1="75" x2="276.4426856421333" y2="145.15905365124675" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-quorum-arr)"/> <text x="240" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">N=5, W=3, R=3 → R+W &gt; N overlap</text> </svg>`, caption: `Quorum: N=5 replicas on a ring — W=3 write quorum and R=3 read quorum overlap at R3 so reads see the latest write.` },
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("quorum", stage, panel, stageEl);
}