// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "quorum-reads-writes",
  title: "Quorum Reads / Writes",
  category: "hld-theory",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `R + W > N for tunable consistency.`,
  sections: [
    { title: `What is Quorum Reads / Writes?`, body: `<p><b>Quorum Reads / Writes</b> — R + W > N for tunable consistency.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Quorum Reads / Writes</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>R + W > N for tunable consistency.</p><p>Define SLIs affected by <b>Quorum Reads / Writes</b> — latency, availability, error rate — and which dependency failure degrades each.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>State the formal guarantee (linearizable, sequential, causal) and give a concrete failure scenario where violating it hurts users — duplicate charge, lost message, or stale feed.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Quorum Reads / Writes</b> constrains how you draw data flows and consistency boundaries. Interviewers expect you to name which guarantee you sacrifice under partition and why.</p><p>Annotate the diagram with consistency level on each arrow — not every path needs linearizability.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Quorum Reads / Writes</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Quorum Reads / Writes</b>:</p><ul><li>Treating <b>Quorum Reads / Writes</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Confusing CAP partition scenario with normal operation.</li><li>Claiming exactly-once without idempotency.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "quorum", svg: `<svg viewBox="0 0 480 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Quorum Reads / Writes quorum"> <defs><marker id="fig-quorum-reads-writes-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <circle cx="240" cy="95" r="62" fill="none" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/> <rect x="216" y="17" width="48" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="240" y="27" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R1</text><text x="240" y="43" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W</text> <rect x="274.9655040102995" y="59.84094634875326" width="48" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="298.9655040102995" y="69.84094634875326" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R2</text><text x="298.9655040102995" y="85.84094634875326" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W</text> <rect x="252.4426856421333" y="129.15905365124675" width="48" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="276.4426856421333" y="139.15905365124675" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R3</text><text x="276.4426856421333" y="155.15905365124675" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W+R</text> <rect x="179.5573143578667" y="129.15905365124675" width="48" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="203.5573143578667" y="139.15905365124675" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R4</text><text x="203.5573143578667" y="155.15905365124675" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R</text> <rect x="157.03449598970047" y="59.84094634875325" width="48" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="181.03449598970047" y="69.84094634875325" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">R5</text><text x="181.03449598970047" y="85.84094634875325" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R</text> <rect x="390" y="55" width="72" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="426" y="69" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text><text x="426" y="85" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R=3</text> <line x1="390" y1="75" x2="276.4426856421333" y2="145.15905365124675" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-quorum-reads-writes-arr)"/> <text x="240" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">N=5, W=3, R=3 → R+W &gt; N overlap</text> </svg>`, caption: `Quorum Reads / Writes: N=5 replicas on a ring — W=3 write quorum and R=3 read quorum overlap at R3 so reads see the latest write.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("quorum-reads-writes", stage, panel, stageEl);
}