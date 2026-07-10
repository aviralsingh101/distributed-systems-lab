// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { topologyTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "event-driven-architecture",
  title: "Event-Driven Architecture",
  category: "hld-architecture",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Loose coupling via async events.`,
  sections: [
    { title: `What is Event-Driven Architecture?`, body: `<p><b>Event-Driven Architecture</b> — Loose coupling via async events.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Event-Driven Architecture</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Loose coupling via async events.</p><p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p>`, figureAfter: "architecture" },
    { title: `HLD placement`, body: `<p><b>Event-Driven Architecture</b> shapes service boundaries and event flows. Draw services as boxes; show command vs query paths and async boundaries explicitly.</p><p>Each box should own one write model; cross-box updates go through events or sagas.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Event-Driven Architecture</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Event-Driven Architecture</b>:</p><ul><li>Treating <b>Event-Driven Architecture</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "architecture", svg: `<svg viewBox="0 0 460 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Event-Driven Architecture architecture"> <text x="230" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">System components</text> <rect x="30" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="90" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text> <rect x="170" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="230" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API</text> <rect x="310" y="40" width="120" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="370" y="66" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DB</text> <rect x="30" y="95" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="90" y="121" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cache</text> <rect x="170" y="95" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="230" y="121" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text> </svg>`, caption: `Event-Driven Architecture: high-level components and data flow for the system design.` },
  ],
  related: ["transactional-outbox", "cqrs", "event-sourcing"],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
