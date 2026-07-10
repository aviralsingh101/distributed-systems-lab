// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "pacelc",
  title: "PACELC",
  category: "hld-theory",
  track: "hld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `If no partition: latency vs consistency.`,
  sections: [
    { title: `What is PACELC?`, body: `<p><b>PACELC</b> — If no partition: latency vs consistency.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>PACELC</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>If no partition: latency vs consistency.</p><p>Trace one end-to-end request through <b>PACELC</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>State the formal guarantee (linearizable, sequential, causal) and give a concrete failure scenario where violating it hurts users — duplicate charge, lost message, or stale feed.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>PACELC</b> constrains how you draw data flows and consistency boundaries. Interviewers expect you to name which guarantee you sacrifice under partition and why.</p><p>Annotate the diagram with consistency level on each arrow — not every path needs linearizability.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>PACELC</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>PACELC</b>:</p><ul><li>Treating <b>PACELC</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Confusing CAP partition scenario with normal operation.</li><li>Claiming exactly-once without idempotency.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("pacelc", stage, panel, stageEl);
}