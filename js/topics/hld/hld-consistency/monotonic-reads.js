// @article-v2
// @sim-lab
import { sequenceSim } from "../../../sim/sequence.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "monotonic-reads", title: "Monotonic Reads", category: "consistency" };

export const content = {
  oneliner: `Never go backwards in time.`,
  archetype: "concept",
  sections: [
    { title: `What is Monotonic Reads?`, body: `<p><b>Monotonic Reads</b> — Never go backwards in time.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Monotonic Reads</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Never go backwards in time.</p><p>Trace one end-to-end request through <b>Monotonic Reads</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Monotonic Reads</b> applies at read/write boundaries between replicas or regions. Mark R/W quorum or session stickiness on the diagram.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Monotonic Reads</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Monotonic Reads</b>:</p><ul><li>Treating <b>Monotonic Reads</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("monotonic-reads", stage, panel, stageEl);
}