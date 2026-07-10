// @article-v2
// @sim-lab
// @hld-gold
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const EDGE_SVG = `<svg viewBox="0 0 640 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Edge rate limiting layers">
  <defs><marker id="fig-edge-rate-limiting-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="55" width="70" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="77" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Internet</text>
  <rect x="110" y="55" width="80" height="36" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="150" y="77" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">CDN / WAF</text>
  <rect x="210" y="55" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="2"/>
  <text x="255" y="77" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">API Gateway</text>
  <rect x="320" y="55" width="90" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="365" y="77" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">App tier</text>
  <rect x="430" y="55" width="70" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="465" y="77" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Data</text>
  <line x1="90" y1="73" x2="108" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-edge-rate-limiting-arr)"/>
  <line x1="190" y1="73" x2="208" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-edge-rate-limiting-arr)"/>
  <line x1="300" y1="73" x2="318" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-edge-rate-limiting-arr)"/>
  <line x1="410" y1="73" x2="428" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-edge-rate-limiting-arr)"/>
  <text x="150" y="110" text-anchor="middle" fill="#ff5c6c" font-size="8" font-family="system-ui">coarse IP limits</text>
  <text x="255" y="110" text-anchor="middle" fill="#ffb454" font-size="8" font-family="system-ui">per-user/API key</text>
  <text x="365" y="110" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">per-endpoint (2nd line)</text>
</svg>`;

const topic = makeTopic({
  id: "edge-rate-limiting",
  title: "Edge Rate Limiting",
  category: "hld-blocks",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: "Enforce request quotas at CDN, WAF, or API gateway — before traffic reaches your application or database.",
  sections: [
    {
      title: "What is edge rate limiting?",
      body: `<p><b>Edge rate limiting</b> rejects or throttles requests at the perimeter of your system — CDN (Cloudflare, Akamai), WAF, load balancer, or API gateway — <i>before</i> they consume application CPU, database connections, or downstream API quotas.</p>
<p>Without edge limits, a traffic spike or attack reaches your app tier first. By then you are paying for autoscaling, connection pool exhaustion, and cascading failures. Edge limiting is cheaper (dropped packets don't spin up pods) and faster (no round-trip to origin).</p>`,
    },
    {
      title: "Layered defense model",
      figureAfter: "edge-layers",
      body: `<p>Production systems use <b>multiple limit layers</b> with different granularity:</p>
<ol>
<li><b>CDN / WAF (L7 edge)</b> — coarse per-IP limits (1000 req/min), DDoS mitigation, geo block. Algorithm: sliding window counter (memory efficient for millions of IPs).</li>
<li><b>API Gateway</b> — per API key / user / JWT subject. Algorithm: token bucket with burst. Reads identity from <code>Authorization</code> header.</li>
<li><b>Application middleware</b> — per-endpoint expensive operations (<code>POST /export</code> costs 10 tokens). Protects specific code paths.</li>
<li><b>Downstream quotas</b> — partner API, DB connection pool — leaky bucket or semaphore inside service.</li>
</ol>
<p>Each layer has a different key space and limit. A request must pass all layers. Inner layers assume outer layers caught bulk abuse.</p>`,
    },
    {
      title: "How edge enforcement works",
      body: `<p><b>Cloudflare / CDN:</b> rate limit rules in dashboard — match path, IP, header; action block or challenge. Enforced at PoP near client; origin never sees blocked traffic.</p>
<p><b>nginx:</b> <code>limit_req_zone</code> + <code>limit_req</code> directive — leaky bucket per key (typically <code>$binary_remote_addr</code> or <code>$jwt_claim_sub</code>).</p>
<pre>limit_req_zone $binary_remote_addr zone=ip:10m rate=10r/s;
server {
  location /api/ {
    limit_req zone=ip burst=20 nodelay;
    limit_req_status 429;
  }
}</pre>
<p><b>Envoy:</b> <code>local_rate_limit</code> filter (per-pod) or <code>global_rate_limit</code> via gRPC to rate-limit service + Redis.</p>
<p><b>AWS API Gateway:</b> usage plans + token bucket per API key built-in.</p>`,
    },
    {
      title: "Design decisions",
      body: `<p><b>Key extraction:</b> IP alone is wrong behind carrier NAT (one IP = thousands of users). Prefer API key or JWT <code>sub</code> claim. Fall back to IP for unauthenticated endpoints.</p>
<p><b>429 response contract:</b> always include <code>Retry-After</code> (seconds). Clients and SDKs use it for exponential backoff — without it, retry storms amplify overload.</p>
<p><b>Fail-open vs fail-closed</b> when limiter store is down: edge usually fail-open (availability); fraud endpoints fail-closed.</p>
<p><b>Whitelist paths:</b> <code>/health</code>, <code>/ready</code> must bypass limits or orchestrator kills healthy pods during traffic spike.</p>`,
    },
    {
      title: "HLD integration with rate limiter service",
      body: `<p>For custom rules (per-user tier, dynamic limits from billing DB), deploy a <b>central rate limiter service</b> (see Rate Limiter Service topic). Gateway calls <code>/check</code> with 2–5ms budget; Redis holds token bucket state.</p>
<p>Hybrid: CDN handles volumetric DDoS (millions of IPs, simple counters); gateway handles business logic limits (authenticated users, per-endpoint costs).</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Only rate limiting in application code — attacker sends 100k RPS, app autoscales into bankruptcy before limit triggers.</li>
<li>Per-IP only on authenticated API — mobile carrier NAT blocks innocent users together.</li>
<li>No <code>Retry-After</code> — clients immediate retry doubles load.</li>
<li>Same limit at every layer with same key — redundant; layers should complement.</li>
</ul>`,
    },
  ],
  figures: [
    { id: "edge-layers", svg: EDGE_SVG, caption: "Layered rate limits: CDN/WAF for coarse IP throttling, API gateway for per-user limits, app tier for expensive endpoints." },
  ],
  related: ["rate-limiter-service", "rate-limit-algorithms", "token-bucket", "api-gateway", "waf"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("edge-rate-limiting", stage, panel, stageEl);
}
