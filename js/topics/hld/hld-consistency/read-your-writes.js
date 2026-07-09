// @article-v2
// @sim-lab
import { sequenceSim } from "../../../sim/sequence.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "read-your-writes", title: "Read Your Writes", category: "consistency" };

export const content = {
  oneliner: `See your own update.`,
  archetype: "concept",
  sections: [
    { title: `What is Read Your Writes?`, body: `<p><b>Read Your Writes</b> — See your own update.</p>
<p>Under network partition, systems choose between strong consistency and availability. Quorum reads/writes use <code>R + W > N</code>. Payment ledgers often favor CP on the primary write path with async replica convergence for analytics.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Read Your Writes</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Read Your Writes</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Read Your Writes</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Read Your Writes</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Read Your Writes</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("read-your-writes", stage, panel, stageEl);
}