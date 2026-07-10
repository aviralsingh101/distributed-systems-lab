// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { stateMachineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "consensus-raft-paxos",
  title: "Consensus (Raft / Paxos)",
  category: "hld-theory",
  track: "hld",
  tier: "advanced",
  archetype: "concept",
  oneliner: `Agree on one value despite failures.`,
  sections: [
    { title: `What is Consensus (Raft / Paxos)?`, body: `<p><b>Consensus (Raft / Paxos)</b> — Agree on one value despite failures.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Consensus (Raft / Paxos)</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Agree on one value despite failures.</p><p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>State the formal guarantee (linearizable, sequential, causal) and give a concrete failure scenario where violating it hurts users — duplicate charge, lost message, or stale feed.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Consensus (Raft / Paxos)</b> constrains how you draw data flows and consistency boundaries. Interviewers expect you to name which guarantee you sacrifice under partition and why.</p><p>Annotate the diagram with consistency level on each arrow — not every path needs linearizability.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Consensus (Raft / Paxos)</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Consensus (Raft / Paxos)</b>:</p><ul><li>Treating <b>Consensus (Raft / Paxos)</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Confusing CAP partition scenario with normal operation.</li><li>Claiming exactly-once without idempotency.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "consensus", svg: `<svg viewBox="0 0 500 185" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Consensus (Raft / Paxos) consensus"> <defs><marker id="fig-consensus-raft-paxos-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <circle cx="250" cy="100" r="70" fill="none" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/> <rect x="220" y="12" width="60" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="250" y="24" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">L</text><text x="250" y="40" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">elected</text> <rect x="286.57395614066075" y="60.36881039375368" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="316.57395614066075" y="72.36881039375368" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F1</text><text x="316.57395614066075" y="88.36881039375368" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <rect x="261.1449676604731" y="138.63118960624632" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="291.1449676604731" y="150.63118960624632" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F2</text><text x="291.1449676604731" y="166.63118960624632" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <rect x="178.85503233952687" y="138.63118960624632" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="208.85503233952687" y="150.63118960624632" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F3</text><text x="208.85503233952687" y="166.63118960624632" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <rect x="153.42604385933925" y="60.36881039375366" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="183.42604385933925" y="72.36881039375366" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F4</text><text x="183.42604385933925" y="88.36881039375366" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <line x1="250" y1="30" x2="316.57395614066075" y2="78.36881039375368" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <line x1="250" y1="30" x2="291.1449676604731" y2="156.63118960624632" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <line x1="250" y1="30" x2="208.85503233952687" y2="156.63118960624632" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <line x1="250" y1="30" x2="183.42604385933925" y2="78.36881039375366" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <text x="250" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Raft cluster — AppendEntries to quorum</text> </svg>`, caption: `Consensus (Raft / Paxos): one elected leader replicates log entries to a quorum of followers — partition blocks commit until a majority is reachable.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("consensus-raft-paxos", stage, panel, stageEl);
}