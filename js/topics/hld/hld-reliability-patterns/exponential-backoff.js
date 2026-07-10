// @article-v2
// @sim-lab
import { C } from "../../../sim/primitives.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "exponential-backoff", title: "Exponential Backoff + Jitter", category: "retry" };

export const content = {
  oneliner: `De-synchronize retries.`,
  archetype: "concept",
  sections: [
    { title: `What is Exponential Backoff + Jitter?`, body: `<p><b>Exponential Backoff + Jitter</b> — De-synchronize retries.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Exponential Backoff + Jitter</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>De-synchronize retries.</p><p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Exponential Backoff + Jitter</b> spans the operational layer — health checks, deploy paths, observability hooks. Frame as design choices that affect architecture, not a post-launch runbook.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Exponential Backoff + Jitter</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Exponential Backoff + Jitter</b>:</p><ul><li>Treating <b>Exponential Backoff + Jitter</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("exponential-backoff", stage, panel, stageEl);
}