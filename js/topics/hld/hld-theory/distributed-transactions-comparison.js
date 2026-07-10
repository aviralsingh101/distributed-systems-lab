// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "distributed-transactions-comparison",
  title: "Distributed Transactions",
  category: "hld-theory",
  track: "hld",
  tier: "advanced",
  archetype: "concept",
  oneliner: `2PC, saga, and outbox compared.`,
  sections: [
    { title: `What is Distributed Transactions?`, body: `<p><b>Distributed Transactions</b> — 2PC, saga, and outbox compared.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Distributed Transactions</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>2PC, saga, and outbox compared.</p><p>Define SLIs affected by <b>Distributed Transactions</b> — latency, availability, error rate — and which dependency failure degrades each.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>State the formal guarantee (linearizable, sequential, causal) and give a concrete failure scenario where violating it hurts users — duplicate charge, lost message, or stale feed.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p><b>Distributed Transactions</b> constrains how you draw data flows and consistency boundaries. Interviewers expect you to name which guarantee you sacrifice under partition and why.</p><p>Annotate the diagram with consistency level on each arrow — not every path needs linearizability.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Distributed Transactions</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Distributed Transactions</b>:</p><ul><li>Treating <b>Distributed Transactions</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Confusing CAP partition scenario with normal operation.</li><li>Claiming exactly-once without idempotency.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "comparison", svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distributed Transactions comparison"> <rect x="40" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="120" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">2PC / Saga</text><text x="120" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <rect x="280" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="360" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">TCC / Outbox</text><text x="360" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <text x="240" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">vs</text> </svg>`, caption: `Distributed Transactions: tradeoff comparison — when to choose each approach.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
