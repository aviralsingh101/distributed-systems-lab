// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { flowTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "grpc",
  title: "gRPC",
  category: "hld-networking",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Binary RPC with HTTP/2 and strong contracts.`,
  sections: [
    { title: `What is gRPC?`, body: `<p><b>gRPC</b> — Binary RPC with HTTP/2 and strong contracts.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>gRPC</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Binary RPC with HTTP/2 and strong contracts.</p><p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Specify wire protocol, connection lifecycle, head-of-line blocking risks, and whether intermediaries (proxies, LBs) terminate or pass through. State default timeouts and retry idempotency requirements.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p>On the architecture diagram, <b>gRPC</b> sits on the communication path between clients and services — or between services. Label connection type (sync/async), timeout budget, and retry policy on the arrow.</p><p>Show where TLS terminates and whether connections are pooled or per-request. Interviewers often ask how this choice affects tail latency under packet loss.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>gRPC</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>gRPC</b>:</p><ul><li>Treating <b>gRPC</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Ignoring connection pooling and TLS overhead.</li><li>Choosing WebSockets when SSE or polling suffices.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("grpc", stage, panel, stageEl);
}