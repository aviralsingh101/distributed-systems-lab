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
    { title: `The question`, body: `<p>When a client needs to learn about server-side changes — a payment moving from <code>PENDING</code> to <code>CAPTURED</code>, a new chat message, a live price — you must choose <em>how</em> the update reaches it. HTTP is request/response: the server cannot speak first. The four common options differ in latency, whether the channel is one-way or bidirectional, and how much they cost to operate at scale.</p>` },
    { title: `Short polling`, figureAfter: "compare", body: `<p>The client re-requests on a fixed interval (<code>GET /payments/123</code> every few seconds). It is trivial to build, stateless, cache-friendly, and works through every proxy and firewall. The costs are real: worst-case latency equals the polling interval, and the vast majority of requests return "no change", wasting bandwidth, connections, and database reads. It is the right default only for infrequent updates or small client counts.</p>` },
    { title: `Long polling`, body: `<p>The client sends a request and the server <b>holds it open</b> until there is data (or a timeout, typically 20–60s); the client then immediately reconnects. This gives near-real-time delivery over ordinary HTTP with no special protocol, so it traverses any proxy. The downsides: each waiting client ties up a request/connection, reconnection adds overhead and a small gap where events can be missed unless you track a cursor, and event ordering needs care. It is the historical fallback that libraries like Socket.IO degrade to.</p>` },
    { title: `Server-Sent Events (SSE)`, body: `<p>SSE keeps a single HTTP response open and streams <code>text/event-stream</code> events from server to client. It is <b>one-way</b> (server → client); the client still sends actions via normal requests. SSE is simple and HTTP-native, and the browser <code>EventSource</code> API gives you <b>automatic reconnection</b> and resumption via the <code>Last-Event-ID</code> header — excellent for a live payment-status or notification feed. The catch: over HTTP/1.1 browsers cap connections at ~6 per domain, so many concurrent streams need HTTP/2 (which multiplexes them); older proxies may buffer the stream.</p>
<pre>// Spring: push payment-status changes to the client as an SSE stream
@GetMapping(path = "/payments/{id}/events",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream(@PathVariable String id) {
    SseEmitter emitter = new SseEmitter(0L);   // 0 = no server-side timeout
    statusRegistry.subscribe(id, emitter);     // emitter.send(...) on each change
    return emitter;
}</pre>` },
    { title: `WebSockets`, body: `<p>A WebSocket starts as an HTTP <code>Upgrade</code> handshake and then becomes a <b>full-duplex, persistent TCP connection</b>: both sides send frames at any time with minimal per-message overhead. This is the choice for genuinely bidirectional, low-latency workloads — trading, collaborative editing, live chat, multiplayer. The price is operational: the connection is <b>stateful</b>, so load balancers need sticky or connection-aware routing, horizontal scale needs a pub/sub backplane to fan messages across server instances, and you must build your own heartbeat, reconnect, and backpressure logic (the protocol gives you none).</p>` },
    { title: `How to choose`, body: `<p>Pick the least powerful option that meets the need:</p>
<ul>
<li><b>Updates are rare / clients few</b> → short polling. Don't build infrastructure you won't use.</li>
<li><b>Server→client push, one direction</b> (payment status, notifications, dashboards) → <b>SSE</b> over HTTP/2. Simple, resilient, auto-reconnecting.</li>
<li><b>Frequent bidirectional, low latency</b> (chat, trading, presence) → <b>WebSocket</b>, and budget for the stateful-scaling work.</li>
<li><b>Must survive hostile proxies with no WebSocket support</b> → long polling as a fallback tier.</li>
</ul>
<p>For a payment platform, order/charge status pages are a near-perfect SSE fit; a merchant support chat is where WebSockets earn their operational cost.</p>` },
  ],
  related: ["websockets", "sse", "long-polling", "http-evolution", "push-vs-pull"],
});

export const meta = topic.meta;
export const content = topic.content;
