// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { flowTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "sse",
  title: "Server-Sent Events",
  category: "hld-networking",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Server push over one-way HTTP stream.`,
  sections: [
    { title: `What is Server-Sent Events?`, body: `<p><b>Server-Sent Events</b> — Server push over one-way HTTP stream.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Server-Sent Events</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Server push over one-way HTTP stream.</p><p>Define SLIs affected by <b>Server-Sent Events</b> — latency, availability, error rate — and which dependency failure degrades each.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Specify wire protocol, connection lifecycle, head-of-line blocking risks, and whether intermediaries (proxies, LBs) terminate or pass through. State default timeouts and retry idempotency requirements.</p>`, figureAfter: "request-flow" },
    { title: `HLD placement`, body: `<p>On the architecture diagram, <b>Server-Sent Events</b> sits on the communication path between clients and services — or between services. Label connection type (sync/async), timeout budget, and retry policy on the arrow.</p><p>Show where TLS terminates and whether connections are pooled or per-request. Interviewers often ask how this choice affects tail latency under packet loss.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Server-Sent Events</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Server-Sent Events</b>:</p><ul><li>Treating <b>Server-Sent Events</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Ignoring connection pooling and TLS overhead.</li><li>Choosing WebSockets when SSE or polling suffices.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "request-flow", svg: `<svg viewBox="0 0 500 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Server-Sent Events flow"> <defs><marker id="fig-sse-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <text x="250" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Request flow</text> <rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text> <rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Server-Sent Ev</text><text x="144" y="68" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this layer</text> <rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text> <rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ff8fab" stroke-width="1.5"/> <text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text> <rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text> <line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-sse-arr)"/> <line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-sse-arr)"/> <line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-sse-arr)"/> <line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-sse-arr)"/> </svg>`, caption: `Server-Sent Events on the ingress path — client traffic flows through this layer to backend services.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
