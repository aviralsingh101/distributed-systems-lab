// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "cell-architecture-design",
  title: "Cell Architecture (design)",
  category: "hld-architecture",
  track: "hld",
  tier: "hidden-gem",
  archetype: "classic",
  oneliner: `Isolated failure domains at scale.`,
  sections: [
    { title: `Functional requirements`, body: `<p>Isolated failure domains at scale.</p><p>Enumerate functional requirements, estimate read/write ratio, and state latency/availability targets before drawing components. Call out MVP vs v2 explicitly.</p>` },
    { title: `Capacity sketch`, body: `<p>Estimate DAU → peak QPS, storage/day, and fan-out factor. For <b>Cell Architecture (design)</b>, identify the dominant cost: bandwidth, storage, or compute.</p>
<p>Example math: 100M URLs/day × 500 bytes ≈ 50GB/day metadata before indexes. State assumptions aloud — interviewers correct wrong math faster than silent guessing.</p>
<p>Call out read:write ratio; it drives cache vs write-optimized store choice.</p>` },
    { title: `High-level design`, body: `<p>Draw clients, API layer, primary store, cache, async queue, and external dependencies. Label sync vs async edges and partition keys. Explain the hardest consistency or scale decision aloud.</p>`, figureAfter: "architecture" },
    { title: `Deep dives`, body: `<p>Pick 2–3 areas interviewers probe: data model, partitioning, caching, consistency. For <b>Cell Architecture (design)</b>, explain id generation, hot keys, and what fails under 10× load.</p>
<p>Prepare one API contract (request/response) and one table schema or object key layout — depth beats breadth.</p>` },
    { title: `Bottlenecks and scaling`, body: `<p>First bottlenecks: DB write ceiling, hot partition, connection limits, or fan-out storms. Mitigate with cache, queue, shard, or read replicas — in that order of simplicity.</p>
<p>Describe horizontal scale path: what is stateless, what is sharded, what must remain centralized.</p>` },
    { title: `Interview pitfalls`, body: `<p>What interviewers probe for <b>Cell Architecture (design)</b>:</p><ul><li>Treating <b>Cell Architecture (design)</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "architecture", svg: `<svg viewBox="0 0 460 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cell Architecture (design) architecture"> <text x="230" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">System components</text> <rect x="30" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="90" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text> <rect x="170" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="230" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API</text> <rect x="310" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="370" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB</text> <rect x="30" y="95" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="90" y="121" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache</text> <rect x="170" y="95" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="230" y="121" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text> </svg>`, caption: `Cell Architecture (design): high-level components and data flow for the system design.` },
  ],
  related: ["cell-architecture"],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
