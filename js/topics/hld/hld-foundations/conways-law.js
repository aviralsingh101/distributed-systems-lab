// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "conways-law",
  title: "Conway's Law",
  category: "hld-foundations",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Org structure shapes system boundaries.`,
  sections: [
    { title: `Framework overview`, body: `<p>Org structure shapes system boundaries.</p>
<p>Structured design process: (1) clarify requirements and out-of-scope, (2) back-of-envelope capacity, (3) high-level diagram, (4) deep-dive 2–3 components, (5) tradeoffs and failure modes. This order keeps interviews coherent under time pressure.</p>
<p><b>Conway's Law</b> is the meta-skill — interviewers grade communication and prioritization, not memorized architectures.</p>` },
    { title: `How it works in an interview`, body: `<p>Spend first 5 minutes on requirements — functional, scale, latency, consistency. Next 10 minutes on diagram. Remaining time on deep dives and "what if" probes.</p>
<p>Ask clarifying questions aloud: mobile vs web? global? strong consistency required? write-heavy? These answers change the diagram.</p>` },
    { title: `When to apply`, body: `<p>Use <b>Conway's Law</b> at the start of greenfield designs and major refactors — before picking databases or service counts. Skip heavy process for small bugfixes.</p>
<p>In design reviews, use the same structure so reviewers can follow your reasoning.</p>` },
    { title: `Example walkthrough`, body: `<p>Practice on a classic (URL shortener, feed, chat): state assumptions, draw left-to-right (client → edge → services → data), deep-dive the riskiest box (fan-out, id generation, or consistency), articulate one tradeoff you accept.</p>
<p>Time-box: 45 minutes total simulates a senior loop round.</p>` },
    { title: `Common mistakes`, body: `<p>What interviewers probe for <b>Conway's Law</b>:</p><ul><li>Treating <b>Conway's Law</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Jumping to microservices before requirements.</li><li>No back-of-envelope QPS/storage estimate.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
