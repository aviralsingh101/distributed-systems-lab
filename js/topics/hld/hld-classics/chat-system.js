// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "chat-system",
  title: "Chat System",
  category: "hld-classics",
  track: "hld",
  tier: "essential",
  archetype: "classic",
  oneliner: `Real-time messaging at scale.`,
  sections: [
    { title: `Functional requirements`, body: `<ul><li>1:1 and group messaging; delivery order per conversation.</li><li>Online presence; read receipts (optional).</li><li>Millions of concurrent connections; message persistence.</li><li>Push notification for offline users.</li></ul>` },
    { title: `Capacity sketch`, body: `<p>Estimate DAU → peak QPS, storage/day, and fan-out factor. For <b>Chat System</b>, identify the dominant cost: bandwidth, storage, or compute.</p>
<p>Example math: 100M URLs/day × 500 bytes ≈ 50GB/day metadata before indexes. State assumptions aloud — interviewers correct wrong math faster than silent guessing.</p>
<p>Call out read:write ratio; it drives cache vs write-optimized store choice.</p>` },
    { title: `High-level design`, body: `<p><b>Components:</b> WebSocket gateway, chat service, message store (partitioned by conversation_id), presence service, push notification fan-out.</p><p>Clients maintain persistent connection; messages append to per-conversation log; delivery via sync + push for offline users.</p>`, figureAfter: "architecture" },
    { title: `Deep dives`, body: `<p>Pick 2–3 areas interviewers probe: data model, partitioning, caching, consistency. For <b>Chat System</b>, explain id generation, hot keys, and what fails under 10× load.</p>
<p>Prepare one API contract (request/response) and one table schema or object key layout — depth beats breadth.</p>` },
    { title: `Bottlenecks and scaling`, body: `<p>First bottlenecks: DB write ceiling, hot partition, connection limits, or fan-out storms. Mitigate with cache, queue, shard, or read replicas — in that order of simplicity.</p>
<p>Describe horizontal scale path: what is stateless, what is sharded, what must remain centralized.</p>` },
    { title: `Interview pitfalls`, body: `<p>What interviewers probe for <b>Chat System</b>:</p><ul><li>Treating <b>Chat System</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Under-scoping requirements (MVP vs scale).</li><li>No id generation or hot-key strategy.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("chat-system", stage, panel, stageEl);
}