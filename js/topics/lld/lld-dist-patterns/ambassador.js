// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const AMB_SVG = `<svg viewBox="0 0 540 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ambassador proxy for outbound calls"><defs><marker id="fig-ambassador-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="20" y="50" width="100" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="70" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">App</text><text x="70" y="85" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">calls localhost</text><rect x="160" y="50" width="120" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="220" y="68" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Ambassador</text><text x="220" y="83" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">retry&#183;TLS&#183;breaker</text><rect x="330" y="30" width="180" height="34" rx="6" fill="#1a2236" stroke="#ff8fab" stroke-width="1.5"/><text x="420" y="52" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Payment Gateway (remote)</text><rect x="330" y="80" width="180" height="34" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="420" y="102" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">3rd-party API (remote)</text><line x1="120" y1="72" x2="158" y2="72" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ambassador-arr)"/><line x1="280" y1="66" x2="328" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ambassador-arr)"/><line x1="280" y1="78" x2="328" y2="96" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-ambassador-arr)"/><text x="270" y="128" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">app makes a plain call; the ambassador owns the hard network semantics</text></svg>`;

const topic = makeTopic({
  id: "ambassador",
  title: "Ambassador",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "A co-located proxy that owns the hard parts of an application's outbound network calls — retries, TLS, timeouts, discovery — so the app can call plain localhost.",
  sections: [
    {
      title: "The problem: resilient remote calls, duplicated everywhere",
      body: `<p>Whenever a service calls a remote dependency — the Payment Gateway, a third-party API, a sharded datastore — it needs timeouts, retries with backoff, circuit breaking, TLS, and endpoint discovery. Implementing all of that correctly inside every app, in every language, is repetitive and error-prone. Legacy clients often cannot be modified to add it at all.</p>
<p>The <b>ambassador</b> pattern moves this outbound-connection logic into a helper proxy that runs beside the app. The app makes a simple local call; the ambassador makes the resilient remote one.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "amb-flow",
      body: `<p>The ambassador is a specialized <b>sidecar</b> dedicated to outbound traffic:</p>
<ul>
<li>The app is configured to send its remote requests to <code>localhost:PORT</code> instead of the real endpoint.</li>
<li>The ambassador receives them and forwards to the actual dependency, applying retries, timeouts, circuit breaking, TLS termination/origination, load balancing, and service discovery.</li>
<li>Responses (and failures translated into clean errors) flow back over localhost.</li>
</ul>
<p>The app's networking code shrinks to "call localhost"; all the resilience policy lives in one reusable, independently-upgradable component.</p>
<pre>// --- App: calls localhost; ambassador owns outbound resilience ---
@Configuration
public class GatewayClientConfig {
    @Bean
    RestClient paymentGatewayClient() {
        return RestClient.builder()
            .baseUrl("http://127.0.0.1:15001") // ambassador sidecar
            .build();
    }
}

@Service
public class ChargeService {
    private final RestClient gateway;

    public ChargeResult charge(ChargeRequest req) {
        return gateway.post()
            .uri("/v1/charge")
            .header("Idempotency-Key", req.paymentId())
            .body(req)
            .retrieve()
            .body(ChargeResult.class);
    }
}</pre>
<pre>// --- Ambassador sidecar config (Envoy cluster snippet) ---
// clusters:
//   - name: payment_gateway
//     connect_timeout: 2s
//     type: STRICT_DNS
//     lb_policy: ROUND_ROBIN
//     circuit_breakers:
//       thresholds: [{ max_retries: 3 }]
//     transport_socket: { name: envoy.transport_sockets.tls }
// Retries, TLS, and circuit breaking live here — not in Java.</pre>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>App issues <code>GET http://localhost:15001/charge</code>.</li>
<li>Ambassador resolves the real Gateway endpoint (from discovery/config), opens a TLS connection, and forwards the request.</li>
<li>On a timeout or 5xx it retries with exponential backoff against a healthy instance; repeated failures trip its circuit breaker and it fast-fails locally.</li>
<li>It records latency/error metrics and returns the result to the app.</li>
</ol>`,
    },
    {
      title: "Ambassador vs sidecar vs proxy",
      body: `<p>An ambassador <em>is</em> a sidecar, narrowed to the app's <b>outbound</b> calls (client-side proxy). A general sidecar can handle any concern including inbound traffic and logging. A <b>service mesh</b> data plane is essentially ambassador + inbound-sidecar combined and managed centrally. Compared with an API gateway (a shared edge component for <em>inbound</em> traffic from outside), the ambassador is per-instance and outbound.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> resilient outbound calls with no app changes and in any language; consolidates and standardizes retry/timeout/TLS policy; ideal for modernizing legacy clients you cannot touch.</p>
<p><b>Cons:</b> an extra hop and process per instance (latency and resource cost); one more thing to deploy and monitor; a misconfigured ambassador (e.g. retries stacking on top of app retries) can amplify load. <b>Use when</b> many services need consistent, resilient egress or you must add resilience without editing clients; <b>avoid</b> when a single service can use a good client library and the overhead is not justified.</p>`,
    },
  ],
  figures: [
    { id: "amb-flow", svg: AMB_SVG, caption: "Ambassador: the app calls localhost; the co-located proxy handles retries, TLS, discovery, and circuit breaking for outbound remote calls." },
  ],
  related: ["sidecar", "circuit-breaker", "request-reply"],
});

export const meta = topic.meta;
export const content = topic.content;
