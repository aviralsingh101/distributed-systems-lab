// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { flowTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "system-design-framework",
  title: "System Design Framework",
  category: "hld-foundations",
  track: "hld",
  tier: "essential",
  archetype: "classic",
  oneliner: `Structured approach from requirements to architecture.`,
  sections: [
    { title: `Functional requirements`, body: `<p>Structured approach from requirements to architecture.</p><p>Enumerate functional requirements, estimate read/write ratio, and state latency/availability targets before drawing components. Call out MVP vs v2 explicitly.</p>` },
    { title: `Capacity sketch`, body: `<p>Estimate DAU → peak QPS, storage/day, and fan-out factor. For <b>System Design Framework</b>, identify the dominant cost: bandwidth, storage, or compute.</p>
<p>Example math: 100M URLs/day × 500 bytes ≈ 50GB/day metadata before indexes. State assumptions aloud — interviewers correct wrong math faster than silent guessing.</p>
<p>Call out read:write ratio; it drives cache vs write-optimized store choice.</p>` },
    { title: `High-level design`, body: `<p>Draw clients, API layer, primary store, cache, async queue, and external dependencies. Label sync vs async edges and partition keys. Explain the hardest consistency or scale decision aloud.</p>`, figureAfter: "architecture" },
    { title: `Deep dives`, body: `<p>Pick 2–3 areas interviewers probe: data model, partitioning, caching, consistency. For <b>System Design Framework</b>, explain id generation, hot keys, and what fails under 10× load.</p>
<p>Prepare one API contract (request/response) and one table schema or object key layout — depth beats breadth.</p>` },
    { title: `Bottlenecks and scaling`, body: `<p>First bottlenecks: DB write ceiling, hot partition, connection limits, or fan-out storms. Mitigate with cache, queue, shard, or read replicas — in that order of simplicity.</p>
<p>Describe horizontal scale path: what is stateless, what is sharded, what must remain centralized.</p>` },
    { title: `Interview pitfalls`, body: `<p>What interviewers probe for <b>System Design Framework</b>:</p><ul><li>Treating <b>System Design Framework</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Jumping to microservices before requirements.</li><li>No back-of-envelope QPS/storage estimate.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
