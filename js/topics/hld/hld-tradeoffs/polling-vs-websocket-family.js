// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const COMPARE_SVG = `<svg viewBox="0 0 720 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Real-time delivery options compared">
  <defs><marker id="fig-poll-ws-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="60" y="20" fill="#93a1bd" font-size="10" font-family="system-ui">Short polling</text>
  <text x="60" y="70" fill="#93a1bd" font-size="10" font-family="system-ui">Long polling</text>
  <text x="60" y="120" fill="#93a1bd" font-size="10" font-family="system-ui">SSE (one-way)</text>
  <text x="60" y="170" fill="#93a1bd" font-size="10" font-family="system-ui">WebSocket</text>
  <line x1="200" y1="15" x2="200" y2="200" stroke="#2a3350" stroke-width="1"/>
  <line x1="640" y1="15" x2="640" y2="200" stroke="#2a3350" stroke-width="1"/>
  <text x="200" y="12" text-anchor="middle" fill="#5b9dff" font-size="9" font-family="system-ui">client</text>
  <text x="640" y="12" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">server</text>
  <line x1="200" y1="30" x2="640" y2="30" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 6" marker-end="url(#fig-poll-ws-arr)"/>
  <line x1="200" y1="45" x2="640" y2="45" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 6" marker-end="url(#fig-poll-ws-arr)"/>
  <text x="420" y="26" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">repeated requests every N sec (mostly empty)</text>
  <line x1="200" y1="72" x2="640" y2="72" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-poll-ws-arr)"/>
  <line x1="640" y1="86" x2="200" y2="86" stroke="#3ddc97" stroke-width="1.2" stroke-dasharray="2 3" marker-end="url(#fig-poll-ws-arr)"/>
  <text x="420" y="66" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">server holds request open until data, then client reconnects</text>
  <line x1="640" y1="122" x2="200" y2="122" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-poll-ws-arr)"/>
  <text x="420" y="116" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">one long-lived response, server pushes events</text>
  <line x1="200" y1="172" x2="640" y2="172" stroke="#7c5cff" stroke-width="1.6" marker-end="url(#fig-poll-ws-arr)"/>
  <line x1="640" y1="184" x2="200" y2="184" stroke="#7c5cff" stroke-width="1.6" marker-end="url(#fig-poll-ws-arr)"/>
  <text x="420" y="166" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">full-duplex persistent connection</text>
</svg>`;

const topic = makeTopic({
  id: "polling-vs-websocket-family",
  title: "Polling vs WebSocket Family",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Four ways to move server updates to a client — short polling, long polling, SSE, and WebSockets — trading latency, direction, and operational cost.`,
  figures: [
    { id: "comparison", svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Polling vs WebSocket Family comparison"> <rect x="40" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="120" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option A</text><text x="120" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <rect x="280" y="35" width="160" height="50" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="360" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Option B</text><text x="360" y="70" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pros / cons</text> <text x="240" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">vs</text> </svg>`, caption: `Polling vs WebSocket Family: tradeoff comparison — when to choose each approach.` },
  ],
  sections: [
    { title: `The decision`, body: `<p>Pull, long poll, SSE, or socket.</p><p>Neither <b>Polling</b> nor <b>WebSocket Family</b> wins universally — constraints pick the winner. Open with the business constraint (scale, consistency, team, budget), not the technology name.</p>` },
    { title: `Polling — when it wins`, body: `<p>Choose <b>Polling</b> when simplicity, strong guarantees, or team familiarity matter more than infinite horizontal scale. Good fit for early stage or strict correctness paths.</p>
<p>List concrete strengths: operability, query flexibility, transaction support, or lower moving parts.</p>` },
    { title: `WebSocket Family — when it wins`, body: `<p>Choose <b>WebSocket Family</b> when scale, partition tolerance, or specialized access patterns dominate. Accept higher operational and migration cost.</p>
<p>List concrete strengths: partition tolerance, write throughput, schema flexibility, or geo distribution.</p>` },
    { title: `Comparison`, body: `<p>Compare latency (p50/p99), consistency, operability, cost, and migration risk. Prototype under realistic load — paper tradeoffs hide tail latency and ops toil.</p>
<p>Use a simple table in the interview: rows = criteria, columns = options, cells = short verdict.</p>`, figureAfter: "comparison" },
    { title: `Decision guide for Polling vs WebSocket Family`, body: `<p>Start with the simpler option that meets SLOs. Escalate only when metrics prove pain: p99 breaches, unreconciled data, or ops blocking velocity.</p>
<p>Document the decision in an ADR; revisit when traffic 10× or team doubles.</p>` },
    { title: `Interview framing`, body: `<p>What interviewers probe for <b>Polling vs WebSocket Family</b>:</p><ul><li>Treating <b>Polling vs WebSocket Family</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Saying "it depends" without decision criteria.</li><li>Not comparing operability and migration cost.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: ["websockets", "sse", "long-polling", "http-evolution", "push-vs-pull"],
});

export const meta = topic.meta;
export const content = topic.content;
