// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "technical-debt-vs-velocity",
  title: "Technical Debt vs Velocity",
  category: "hld-foundations",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Ship fast now vs pay interest later.`,
  sections: [
    { title: `The decision`, body: `<p>Ship fast now vs pay interest later.</p><p>Neither <b>Technical Debt</b> nor <b>Velocity</b> wins universally — constraints pick the winner. Open with the business constraint (scale, consistency, team, budget), not the technology name.</p>` },
    { title: `Technical Debt — when it wins`, body: `<p>Choose <b>Technical Debt</b> when simplicity, strong guarantees, or team familiarity matter more than infinite horizontal scale. Good fit for early stage or strict correctness paths.</p>
<p>List concrete strengths: operability, query flexibility, transaction support, or lower moving parts.</p>` },
    { title: `Velocity — when it wins`, body: `<p>Choose <b>Velocity</b> when scale, partition tolerance, or specialized access patterns dominate. Accept higher operational and migration cost.</p>
<p>List concrete strengths: partition tolerance, write throughput, schema flexibility, or geo distribution.</p>` },
    { title: `Comparison`, body: `<p>Compare latency (p50/p99), consistency, operability, cost, and migration risk. Prototype under realistic load — paper tradeoffs hide tail latency and ops toil.</p>
<p>Use a simple table in the interview: rows = criteria, columns = options, cells = short verdict.</p>`, figureAfter: "comparison" },
    { title: `Decision guide for Technical Debt vs Velocity`, body: `<p>Start with the simpler option that meets SLOs. Escalate only when metrics prove pain: p99 breaches, unreconciled data, or ops blocking velocity.</p>
<p>Document the decision in an ADR; revisit when traffic 10× or team doubles.</p>` },
    { title: `Interview framing`, body: `<p>What interviewers probe for <b>Technical Debt vs Velocity</b>:</p><ul><li>Treating <b>Technical Debt vs Velocity</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Saying "it depends" without decision criteria.</li><li>Not comparing operability and migration cost.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
