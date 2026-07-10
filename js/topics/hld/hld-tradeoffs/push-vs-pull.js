// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "push-vs-pull",
  title: "Push vs Pull",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Broker delivers vs consumer polls.`,
  sections: [
    { title: `The decision`, body: `<p>Broker delivers vs consumer polls.</p><p>Neither <b>Push</b> nor <b>Pull</b> wins universally — constraints pick the winner. Open with the business constraint (scale, consistency, team, budget), not the technology name.</p>` },
    { title: `Push — when it wins`, body: `<p>Choose <b>Push</b> when simplicity, strong guarantees, or team familiarity matter more than infinite horizontal scale. Good fit for early stage or strict correctness paths.</p>
<p>List concrete strengths: operability, query flexibility, transaction support, or lower moving parts.</p>` },
    { title: `Pull — when it wins`, body: `<p>Choose <b>Pull</b> when scale, partition tolerance, or specialized access patterns dominate. Accept higher operational and migration cost.</p>
<p>List concrete strengths: partition tolerance, write throughput, schema flexibility, or geo distribution.</p>` },
    { title: `Comparison`, body: `<p>Compare latency (p50/p99), consistency, operability, cost, and migration risk. Prototype under realistic load — paper tradeoffs hide tail latency and ops toil.</p>
<p>Use a simple table in the interview: rows = criteria, columns = options, cells = short verdict.</p>`, figureAfter: "comparison" },
    { title: `Decision guide for Push vs Pull`, body: `<p>Start with the simpler option that meets SLOs. Escalate only when metrics prove pain: p99 breaches, unreconciled data, or ops blocking velocity.</p>
<p>Document the decision in an ADR; revisit when traffic 10× or team doubles.</p>` },
    { title: `Interview framing`, body: `<p>What interviewers probe for <b>Push vs Pull</b>:</p><ul><li>Treating <b>Push vs Pull</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Saying "it depends" without decision criteria.</li><li>Not comparing operability and migration cost.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "comparison", svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Push vs Pull comparison"> <rect x="40" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="120" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option A</text><text x="120" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <rect x="280" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="360" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option B</text><text x="360" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <text x="240" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">vs</text> </svg>`, caption: `Push vs Pull: tradeoff comparison — when to choose each approach.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
