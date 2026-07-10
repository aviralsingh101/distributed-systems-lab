// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "consistent-hashing-placement",
  title: "Consistent Hashing (placement)",
  category: "hld-theory",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Minimal key movement when nodes change.`,
  sections: [
    { title: `What is Consistent Hashing (placement)?`, body: `<p><b>Consistent Hashing (placement)</b> — Minimal key movement when nodes change.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Consistent Hashing (placement)</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Minimal key movement when nodes change.</p><p>Define SLIs affected by <b>Consistent Hashing (placement)</b> — latency, availability, error rate — and which dependency failure degrades each.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>State the formal guarantee (linearizable, sequential, causal) and give a concrete failure scenario where violating it hurts users — duplicate charge, lost message, or stale feed.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Consistent Hashing (placement)</b> constrains how you draw data flows and consistency boundaries. Interviewers expect you to name which guarantee you sacrifice under partition and why.</p><p>Annotate the diagram with consistency level on each arrow — not every path needs linearizability.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Consistent Hashing (placement)</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Consistent Hashing (placement)</b>:</p><ul><li>Treating <b>Consistent Hashing (placement)</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Confusing CAP partition scenario with normal operation.</li><li>Claiming exactly-once without idempotency.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "hash-ring", svg: `<svg viewBox="0 0 400 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Consistent Hashing (placement) ring"> <circle cx="200" cy="105" r="72" fill="none" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/> <rect x="172" y="15" width="56" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="200" y="27" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Node A</text><text x="200" y="43" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vnode</text> <rect x="234.35382907247958" y="123" width="56" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="262.3538290724796" y="135" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Node B</text><text x="262.3538290724796" y="151" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vnode</text> <rect x="109.64617092752042" y="123" width="56" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="137.64617092752042" y="135" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Node C</text><text x="137.64617092752042" y="151" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vnode</text> <circle cx="238.18376618407356" cy="66.81623381592644" r="5" fill="#9aa7c7"/> <text x="238.18376618407356" y="57.81623381592644" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">k1</text> <line x1="238.18376618407356" y1="66.81623381592644" x2="262.3538290724796" y2="141" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 2"/> <circle cx="200" cy="159" r="5" fill="#9aa7c7"/> <text x="200" y="150" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">k2</text> <line x1="200" y1="159" x2="137.64617092752042" y2="141" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 2"/> <circle cx="149.25659847756094" cy="86.53091226041388" r="5" fill="#9aa7c7"/> <text x="149.25659847756094" y="77.53091226041388" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">k3</text> <line x1="149.25659847756094" y1="86.53091226041388" x2="200" y2="33" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 2"/> <text x="200" y="109" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">hash ring</text> <text x="200" y="198" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">key → clockwise nearest vnode</text> </svg>`, caption: `Consistent Hashing (placement): keys sit on a hash ring — each maps clockwise to the nearest virtual node; add/remove shifts only adjacent ranges.` },
  ],
  related: ["consistent-hashing"],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("consistent-hashing-placement", stage, panel, stageEl);
}