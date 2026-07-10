// @article-v2
// @sim-lab
import { sequenceSim } from "../../../sim/sequence.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "write-back", title: "Write Back", category: "cache" };

export const content = {
  oneliner: `Cache first, DB later (risky).`,
  archetype: "concept",
  sections: [
    { title: `What is Write Back?`, body: `<p><b>Write Back</b> — Cache first, DB later (risky).</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Write Back</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Cache first, DB later (risky).</p><p>Trace one end-to-end request through <b>Write Back</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Detail read path (cache hit/miss), write path (invalidate vs write-through), and TTL as staleness backstop. What happens on cache cluster partition?</p>`, figureAfter: "cache-flow" },
    { title: `HLD placement`, body: `<p><b>Write Back</b> sits between application and origin store. Draw cache hit/miss paths and invalidation triggers.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Write Back</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Write Back</b>:</p><ul><li>Treating <b>Write Back</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("write-back", stage, panel, stageEl);
}