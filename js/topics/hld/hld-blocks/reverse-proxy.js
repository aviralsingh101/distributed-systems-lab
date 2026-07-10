// @article-v2
// @sim-lab
// @figure-handcrafted
// @hld-gold
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const PROXY_SVG = `<svg viewBox="0 0 640 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reverse proxy vs bypass">
  <defs><marker id="fig-reverse-proxy-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker>
  <marker id="fig-reverse-proxy-bad" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ff5c6c"/></marker></defs>
  <text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">With reverse proxy (stable hostname) vs direct pod bypass</text>
  <rect x="20" y="40" width="70" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <rect x="110" y="40" width="90" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="2"/>
  <text x="155" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">nginx</text>
  <rect x="230" y="30" width="70" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="265" y="48" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Pod-1</text>
  <rect x="230" y="62" width="70" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="265" y="80" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Pod-2</text>
  <rect x="230" y="94" width="70" height="28" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="265" y="112" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Pod-3</text>
  <line x1="90" y1="58" x2="108" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-reverse-proxy-arr)"/>
  <line x1="200" y1="58" x2="228" y2="44" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-reverse-proxy-arr)"/>
  <line x1="200" y1="58" x2="228" y2="76" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-reverse-proxy-arr)"/>
  <line x1="200" y1="58" x2="228" y2="108" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-reverse-proxy-arr)"/>
  <text x="400" y="48" fill="#3ddc97" font-size="9" font-family="system-ui">least_conn picks healthy upstream</text>
  <rect x="20" y="120" width="70" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="140" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <rect x="230" y="120" width="70" height="32" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="265" y="140" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Pod-7 IP</text>
  <line x1="90" y1="136" x2="228" y2="136" stroke="#ff5c6c" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#fig-reverse-proxy-bad)"/>
  <text x="400" y="140" fill="#ff5c6c" font-size="9" font-family="system-ui">bypass — dead pod after deploy</text>
</svg>`;

const topic = makeTopic({
  id: "reverse-proxy",
  title: "Reverse Proxy",
  category: "hld-blocks",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: "The server's front door — terminates client connections and forwards HTTP to upstream app instances.",
  sections: [
    {
      title: "What is a reverse proxy?",
      body: `<p>A <b>reverse proxy</b> sits in front of your application servers and accepts every inbound client connection. From the client's perspective, the reverse proxy <i>is</i> the server — it owns the public hostname and IP. Behind the scenes it opens a separate connection to one of your upstream pods and relays the request/response.</p>
<p>Ask <em>whose side is the proxy on?</em> A <b>forward proxy</b> (corporate proxy, VPN) sits on the <i>client</i> side. A reverse proxy sits on the <i>server</i> side. Kubernetes Ingress controllers (nginx-ingress, Traefik, AWS ALB) are reverse proxies — mobile clients call <code>pay.api.com</code>, never <code>order-pod-7.internal</code>.</p>`,
    },
    {
      title: "How it works on the wire",
      figureAfter: "proxy-vs-bypass",
      body: `<p>The reverse proxy terminates the client TCP/TLS handshake, parses HTTP, optionally mutates the request, picks an upstream, opens a <i>new</i> connection to the backend, forwards the request, buffers or streams the response, and returns it to the client.</p>
<pre>upstream order_backend {
  least_conn;
  server order-1:8080 max_fails=3 fail_timeout=30s;
  server order-2:8080;
}
server {
  listen 443 ssl;
  location / {
    proxy_pass http://order_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Request-ID $request_id;
    proxy_read_timeout 60s;
  }
}</pre>
<p>Same nginx binary is "just a reverse proxy" with one upstream and becomes a load balancer when you add multiple servers to an <code>upstream</code> block.</p>`,
    },
    {
      title: "Load balancing and health checks",
      body: `<p><b>Algorithms:</b> <code>round_robin</code> (default), <code>least_conn</code> (better for long Gateway callbacks), <code>ip_hash</code> (sticky by client IP — fragile behind carrier NAT).</p>
<p><b>Health checks</b> can be passive (mark upstream down after N failures) or active (periodic <code>/health</code> probes). If all upstreams are down, clients see 502/503 from the proxy — not connection refused to a pod IP.</p>
<p><b>TLS termination</b> centralizes certificate management — backends speak plain HTTP on a private network. Disable <code>proxy_buffering</code> for SSE/WebSocket (<code>proxy_http_version 1.1</code>, <code>Upgrade</code> headers).</p>`,
    },
    {
      title: "Failure behavior and timeouts",
      body: `<p>Timeouts cascade: a low <code>proxy_read_timeout</code> during a slow Payment Gateway callback aborts the client request even if Order Service is still working. Centralize access logs at the proxy — log <code>upstream_addr</code>, <code>upstream_status</code>, <code>request_time</code>.</p>
<p>502 → check upstream health and cert expiry. 504 → raise <code>proxy_read_timeout</code> for Gateway. Spike in <code>upstream_connect_time</code> → pod saturation or network partition.</p>`,
    },
    {
      title: "Why you need one for a payment API",
      body: `<p>Without a reverse proxy, clients connect directly to Order Service pod IPs. Rolling deploys change endpoints while mobile DNS caches old TTLs — a fraction of charge requests hit dead pods. Each pod needs its own TLS cert and WAF config.</p>
<p>Publish one stable DNS (<code>pay.api.com</code>) pointing to nginx/Envoy/ALB. Upstream membership changes in config without client updates. The proxy injects <code>X-Request-ID</code> for tracing and enforces rate limits at the edge.</p>
<p>POST <code>/v1/charge</code> → Cloudflare (DDoS/WAF) → nginx Ingress → least-conn pick among Order pods. During deploy, nginx drains connections via <code>nginx -s reload</code> while new pods join the upstream block.</p>`,
    },
  ],
  figures: [
    { id: "proxy-vs-bypass", svg: PROXY_SVG, caption: "Reverse proxy fronts a stable hostname and load-balances to upstream pods. Direct pod-IP bypass breaks on deploy when pods are replaced." },
  ],
  related: ["load-balancer", "api-gateway", "tls-termination"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("reverse-proxy", stage, panel, stageEl);
}