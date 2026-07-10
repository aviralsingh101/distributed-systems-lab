// @article-v2
// @sim-lab
import { C } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "shuffle-sharding", title: "Shuffle Sharding", category: "prod-eng" };

export const content = {
  oneliner: `Overlapping subsets limit blast radius.`,
  archetype: "concept",
  sections: [
    { title: `What is Shuffle Sharding?`, body: `<p><b>Shuffle Sharding</b> — Overlapping subsets limit blast radius.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Shuffle Sharding</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Overlapping subsets limit blast radius.</p><p>Trace one end-to-end request through <b>Shuffle Sharding</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Explain algorithm behavior under burst vs sustained load, coordination across nodes (central Redis vs local token bucket), and what HTTP status / Retry-After the client receives.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Shuffle Sharding</b> guards ingress or shared resources. Show where tokens are checked relative to load balancer and service.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Shuffle Sharding</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Shuffle Sharding</b>:</p><ul><li>Treating <b>Shuffle Sharding</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("shuffle-sharding", stage, panel, stageEl);
}