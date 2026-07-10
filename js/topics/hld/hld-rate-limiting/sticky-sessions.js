// @article-v2
// @sim-lab
import { sequenceSim } from "../../../sim/sequence.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "sticky-sessions", title: "Sticky Sessions", category: "prod-eng" };

export const content = {
  oneliner: `Pin a user to one server.`,
  archetype: "concept",
  sections: [
    { title: `What is Sticky Sessions?`, body: `<p><b>Sticky Sessions</b> — Pin a user to one server.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Sticky Sessions</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Pin a user to one server.</p><p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Explain algorithm behavior under burst vs sustained load, coordination across nodes (central Redis vs local token bucket), and what HTTP status / Retry-After the client receives.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Sticky Sessions</b> guards ingress or shared resources. Show where tokens are checked relative to load balancer and service.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Sticky Sessions</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Sticky Sessions</b>:</p><ul><li>Treating <b>Sticky Sessions</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("sticky-sessions", stage, panel, stageEl);
}