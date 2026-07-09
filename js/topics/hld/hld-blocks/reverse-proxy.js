// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";

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
  related: ["load-balancer", "api-gateway", "tls-termination"],
  template: "topology",
  sim: () => ({
    note: "Toggle reverse proxy — traffic should flow Client → Proxy → Order, not direct to pods.",
    toggles: [{ key: "fix", label: "Enable reverse proxy", kind: "ok", value: false }],
    nodes: (ctx) => [
      { id: "c", x: 120, y: 280, title: "Client", color: C.client },
      { id: "p", x: 340, y: 280, title: "Reverse Proxy", color: ctx.toggles.fix ? C.accent : C.muted, value: ctx.toggles.fix ? "nginx" : "bypass" },
      { id: "o", x: 560, y: 200, title: "Order", color: C.service, active: true },
      { id: "g", x: 780, y: 280, title: "Gateway", color: C.gateway },
      { id: "l", x: 560, y: 420, title: "Ledger", color: C.ledger, value: ctx.toggles.fix ? "via proxy" : "direct IP" },
    ],
    edges: (ctx) => ctx.toggles.fix ? [
      { from: "c", to: "p", active: true, label: "HTTPS" },
      { from: "p", to: "o", active: true, label: "upstream" },
      { from: "o", to: "g", active: true },
      { from: "o", to: "l", active: true },
    ] : [
      { from: "c", to: "o", active: true, label: "direct pod IP", bad: true },
      { from: "o", to: "g", active: true },
      { from: "o", to: "l", active: true },
    ],
    activeEdge: (ctx, t) => ctx.toggles.fix ? { from: "p", to: "o" } : { from: "c", to: "o" },
    status: (ctx) => ({ text: ctx.toggles.fix ? "proxy terminates TLS, forwards upstream" : "clients pin to pod IPs", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
