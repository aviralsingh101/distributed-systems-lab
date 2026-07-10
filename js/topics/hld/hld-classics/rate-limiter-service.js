// @article-v2
// @sim-lab
// @hld-gold
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const RL_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distributed rate limiter architecture">
  <defs><marker id="fig-rate-limiter-service-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker>
  <marker id="fig-rate-limiter-service-rej" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ff5c6c"/></marker></defs>
  <text x="360" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Rate limiter on the request path — check before expensive work</text>
  <rect x="20" y="50" width="70" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Clients</text>
  <rect x="110" y="50" width="90" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="2"/>
  <text x="155" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">API Gateway</text>
  <rect x="230" y="50" width="110" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="2"/>
  <text x="285" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Rate Limiter</text>
  <rect x="370" y="35" width="80" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="410" y="53" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">App Svc</text>
  <rect x="370" y="72" width="80" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="410" y="90" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">App Svc</text>
  <rect x="285" y="110" width="110" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="340" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Redis cluster</text>
  <line x1="90" y1="68" x2="108" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-rate-limiter-service-arr)"/>
  <line x1="200" y1="68" x2="228" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-rate-limiter-service-arr)"/>
  <line x1="340" y1="68" x2="368" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-rate-limiter-service-arr)"/>
  <line x1="285" y1="86" x2="285" y2="108" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-rate-limiter-service-arr)"/>
  <line x1="90" y1="68" x2="108" y2="68" stroke="#ff5c6c" stroke-width="1.5" marker-end="url(#fig-rate-limiter-service-rej)"/>
  <text x="155" y="155" text-anchor="middle" fill="#ff5c6c" font-size="9" font-family="system-ui">429 + Retry-After when bucket empty</text>
  <rect x="500" y="50" width="200" height="80" rx="6" fill="#131b2b" stroke="#26324a" stroke-width="1"/>
  <text x="600" y="68" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Key: rl:{user_id}:{api}</text>
  <text x="600" y="84" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Value: tokens, last_refill_ts</text>
  <text x="600" y="100" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Lua: atomic refill + decrement</text>
  <text x="600" y="116" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">TTL: 2× window for cleanup</text>
</svg>`;

const topic = makeTopic({
  id: "rate-limiter-service",
  title: "Rate Limiter Service",
  category: "hld-classics",
  track: "hld",
  tier: "essential",
  archetype: "classic",
  oneliner: "A distributed service that enforces per-client request quotas before traffic reaches your application tier.",
  sections: [
    {
      title: "Functional requirements",
      body: `<p>Design a rate limiter that protects APIs from abuse and overload. Core behaviors:</p>
<ul>
<li><b>Limit dimensions:</b> per user ID, per API key, per IP, per endpoint — often combined (<code>user_id + /v1/charge</code>).</li>
<li><b>Rule types:</b> sustained rate (100 req/min) plus optional burst (allow 20 extra in a short window).</li>
<li><b>Response on exceed:</b> HTTP <code>429 Too Many Requests</code> with <code>Retry-After</code> header (seconds until next allowed request).</li>
<li><b>Configuration:</b> rules stored centrally; change limits without redeploying app servers.</li>
<li><b>Accuracy:</b> "mostly correct" is acceptable — a few extra requests under race conditions beats adding 50ms latency for perfect counting.</li>
</ul>
<p><b>Out of scope for v1:</b> billing metering, geographic rules, ML anomaly detection. Those are separate systems that may <i>read</i> the same counters later.</p>`,
    },
    {
      title: "Non-functional requirements & capacity",
      body: `<p><b>Latency:</b> rate check must add &lt; 5ms p99 — it sits on every request path. One extra Redis round-trip is typical; two is a smell.</p>
<p><b>Availability:</b> if Redis is down, choose policy explicitly: <b>fail-open</b> (allow traffic — risk overload) vs <b>fail-closed</b> (reject — risk outage). Payment APIs often fail-open with aggressive alerting.</p>
<p><b>Scale sketch:</b> 50k RPS peak × 1 rate-limit check each = 50k Redis ops/s. A 6-node Redis cluster handles this with Lua scripts keeping one round-trip. Memory: 10M active keys × ~64 bytes ≈ 640MB for counters.</p>
<p><b>Hot keys:</b> a viral user or DDoS concentrates on one counter — use local token bucket cache with async Redis sync, or shuffle-shard counters across Redis nodes (see sidebar topics).</p>`,
    },
    {
      title: "High-level design",
      figureAfter: "rate-limiter-arch",
      body: `<p><b>Components:</b></p>
<ol>
<li><b>API Gateway / edge proxy</b> (nginx, Envoy, Kong, AWS API Gateway) — extracts identity from JWT or API key, calls rate limiter <i>before</i> forwarding to app.</li>
<li><b>Rate Limiter service</b> — stateless HTTP/gRPC: <code>POST /check</code> with <code>{key, cost}</code> → <code>{allowed, remaining, retry_after}</code>. Can be embedded in gateway plugin instead of separate service.</li>
<li><b>Counter store</b> — Redis (or Redis Cluster) holding per-key state. Lua script makes refill + decrement atomic.</li>
<li><b>Rules config</b> — Postgres or config service: <code>rule_id, match_path, limit, window, burst</code>. Cached in gateway memory, refreshed every 30s.</li>
</ol>
<p><b>Request flow:</b> Client → Gateway → <em>rate limit check</em> → (allow) App service → DB. On deny, gateway returns 429 immediately — app never sees the request.</p>`,
    },
    {
      title: "Algorithm: token bucket (default choice)",
      body: `<p>For this design, use <b>token bucket</b> — it models "100 requests per minute with burst up to 20" naturally.</p>
<p><b>State per key:</b> <code>tokens</code> (float), <code>last_refill_ts</code> (ms).</p>
<pre>refill_rate = limit / window_sec   // e.g. 100/60 ≈ 1.67 tokens/sec
capacity  = limit + burst          // e.g. 120

on each request:
  now = current_time_ms()
  elapsed = (now - last_refill_ts) / 1000
  tokens = min(capacity, tokens + elapsed * refill_rate)
  last_refill_ts = now
  if tokens >= cost:
    tokens -= cost
    return ALLOWED
  else:
    retry_after = ceil((cost - tokens) / refill_rate)
    return DENIED(retry_after)</pre>
<p><b>Why token bucket over fixed window?</b> Fixed window has a boundary spike — 100 requests at 00:59 and 100 at 01:00 = 200 in 2 seconds. Token bucket smooths this while still allowing controlled bursts.</p>
<p>Run the refill+decrement in a <b>single Redis Lua script</b> — two separate GET/SET commands race under concurrent requests from multiple gateway pods.</p>`,
    },
    {
      title: "API & data model",
      body: `<p><b>Check API</b> (called by gateway middleware):</p>
<pre>POST /v1/ratelimit/check
{ "key": "user:42:/v1/charge", "cost": 1, "rule_id": "charge-standard" }

→ 200 { "allowed": true, "remaining": 87, "reset_at": 1710000060 }
→ 200 { "allowed": false, "remaining": 0, "retry_after": 12 }</pre>
<p><b>Redis key layout:</b></p>
<ul>
<li><code>rl:{key}</code> → HASH <code>{tokens, last_refill}</code> or JSON string</li>
<li>TTL = 2 × window size (auto-expire idle keys)</li>
</ul>
<p><b>Rules table:</b></p>
<pre>rules(id, path_pattern, limit, window_sec, burst, scope)
-- e.g. ('charge', '/v1/charge', 100, 60, 20, 'user_id')</pre>
<p>Gateway builds the counter key: <code>rl:{scope_value}:{path_pattern}</code> from JWT claims + request path.</p>`,
    },
    {
      title: "Distributed deployment & race conditions",
      body: `<p><b>Multiple gateway instances</b> all hit the same Redis key — atomic Lua prevents over-counting. Without atomicity, two pods both read <code>tokens=1</code>, both decrement, both allow — 2 requests when only 1 token remained.</p>
<p><b>Redis Cluster:</b> hash-tag keys <code>rl:{user_id}:...</code> so one user's counters live on one shard. Cross-slot multi-key limits (global + per-user) need two checks or a dedicated aggregator.</p>
<p><b>Local cache optimization:</b> gateway keeps in-process token bucket mirror; sync to Redis every N requests or every 100ms. Trades accuracy for latency — document accepted overshoot (e.g. 5% over limit during partition).</p>
<p><b>Multi-region:</b> prefer <b>local Redis per region</b> with regional limits (100/min per region) over cross-region Redis (adds 80ms+ RTT). Global limits need async aggregation — not real-time strict.</p>`,
    },
    {
      title: "Bottlenecks and failure modes",
      body: `<ul>
<li><b>Redis hot key</b> — celebrity user or attack IP; mitigate with local bucket + shuffle sharding.</li>
<li><b>Redis outage</b> — fail-open vs fail-closed policy; circuit breaker on rate-limiter service.</li>
<li><b>Clock skew</b> — token bucket refill uses timestamps; NTP drift across nodes causes minor inaccuracy; use Redis TIME in Lua for single clock source.</li>
<li><b>Rule propagation delay</b> — gateway cache stale for 30s after rule change; acceptable for most products.</li>
</ul>
<p>First scaling lever: Redis read replicas don't help (writes on every request) — scale Redis cluster horizontally or push limits to edge CDN/WAF for coarse IP blocking.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Putting rate limiting <i>inside</i> app service only — attackers bypass by hitting pods directly; must be at gateway.</li>
<li>No algorithm named — "use Redis counter" without token bucket vs sliding window tradeoff.</li>
<li>Ignoring burst — users legitimately send 10 parallel requests on page load.</li>
<li>Perfect global accuracy across regions — over-engineering; regional limits are fine.</li>
<li>No 429 / Retry-After — clients retry immediately and amplify the storm.</li>
</ul>`,
    },
  ],
  figures: [
    { id: "rate-limiter-arch", svg: RL_SVG, caption: "Gateway calls rate limiter before app tier. Counters live in Redis with atomic Lua scripts. Denied requests never reach application servers." },
  ],
  related: ["rate-limit-algorithms", "token-bucket", "edge-rate-limiting", "shuffle-sharding"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("rate-limiter-service", stage, panel, stageEl);
}
