// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { pipelineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "stream-table-duality",
  title: "Stream-Table Duality",
  category: "hld-data",
  track: "hld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `Tables are streams; streams are tables.`,
  sections: [
    { title: `What is Stream-Table Duality?`, body: `<p><b>Stream-Table Duality</b> — Tables are streams; streams are tables.</p>
<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Stream-Table Duality</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Stream-Table Duality</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Stream-Table Duality</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Stream-Table Duality</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Stream-Table Duality</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
