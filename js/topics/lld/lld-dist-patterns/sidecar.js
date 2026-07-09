// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const SIDECAR_SVG = `<svg viewBox="0 0 520 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sidecar container in a pod"><defs><marker id="fig-sidecar-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="30" y="30" width="240" height="90" rx="10" fill="none" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 4"/><text x="150" y="24" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Pod (shared network + volume)</text><rect x="48" y="52" width="90" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="93" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">App</text><text x="93" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">business code</text><rect x="160" y="52" width="94" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="207" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Sidecar</text><text x="207" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">proxy/logs/TLS</text><rect x="360" y="55" width="130" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="425" y="79" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Network / mesh</text><line x1="138" y1="75" x2="158" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-sidecar-arr)"/><line x1="254" y1="75" x2="358" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-sidecar-arr)"/><text x="150" y="140" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">same lifecycle, localhost calls, no app code changes</text></svg>`;

const topic = makeTopic({
  id: "sidecar",
  title: "Sidecar",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Attach cross-cutting infrastructure as a separate co-located container so every service gets it without changing its code.",
  sections: [
    {
      title: "The problem: the same plumbing in every service",
      body: `<p>Every service needs the same cross-cutting concerns — TLS, retries, metrics, log shipping, config, service discovery. Baking these into each app couples business logic to infrastructure and forces you to reimplement them once per language (Go, Java, Python). Upgrading the TLS policy then means editing and redeploying dozens of services.</p>
<p>The <b>sidecar</b> pattern extracts those concerns into a <em>separate process</em> that runs right next to the application, sharing its lifecycle and local resources but keeping its own codebase.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "sidecar-flow",
      body: `<p>The unit of deployment bundles two containers together — in Kubernetes, two containers in one <b>pod</b>:</p>
<ul>
<li>The <b>main container</b> runs only business logic and talks to the sidecar over <code>localhost</code>.</li>
<li>The <b>sidecar container</b> handles the infrastructure concern and shares the pod's network namespace and volumes.</li>
</ul>
<p>Because they are co-located, communication is loopback (fast, no extra network hop across hosts) and they scale, start, and stop together. The app is unaware of the sidecar's implementation language.</p>
<pre>// --- Main app: plain HTTP to localhost; no TLS/retry code here ---
@RestController
public class PaymentController {
    private final RestClient gateway; // configured to http://127.0.0.1:15000

    @PostMapping("/v1/pay")
    public PaymentResponse pay(@RequestBody PayRequest req) {
        return gateway.post()
            .uri("/charge")
            .body(req)
            .retrieve()
            .body(PaymentResponse.class);
    }
}</pre>
<pre>// --- Sidecar: separate process in the same pod (Envoy / custom proxy) ---
// Kubernetes pod spec (simplified):
//   containers:
//     - name: order-service        # Spring Boot app on :8080
//     - name: envoy-sidecar         # intercepts outbound on :15000
//       image: envoyproxy/envoy:v1.28
// The sidecar terminates mTLS, retries 5xx with backoff, emits metrics.
// App env: PAYMENT_GATEWAY_URL=http://127.0.0.1:15000</pre>`,
    },
    {
      title: "How it is used — the service mesh",
      body: `<p>The canonical example is a <b>service mesh</b> (Istio/Linkerd), where an Envoy sidecar transparently intercepts all inbound and outbound traffic to add mTLS, retries, circuit breaking, and telemetry — with zero application changes. Other sidecars ship logs (Fluent Bit), sync config or secrets, or provide a local cache. Implementation flow: the platform injects the sidecar at deploy time; iptables or the mesh reroutes the app's traffic through it; the app just calls <code>localhost</code>.</p>`,
    },
    {
      title: "Sidecar vs ambassador",
      body: `<p>The <b>ambassador</b> pattern is a <em>specialized sidecar</em> that proxies specifically the app's <b>outbound</b> calls (adding retries, TLS, discovery to remote calls). A sidecar is the general concept — a co-located helper for any concern, inbound or outbound. Every ambassador is a sidecar; not every sidecar is an ambassador.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> language-agnostic reuse of infrastructure; app stays focused on business logic; upgrade the concern by rolling the sidecar image, not the app; clean separation of ownership between platform and product teams.</p>
<p><b>Cons:</b> resource overhead — one sidecar per pod adds CPU/memory and a little latency; more operational complexity (two containers to observe, version-skew between app and sidecar); a crashed sidecar can take down the app's connectivity. <b>Use when</b> a concern is shared across many services and languages; <b>avoid</b> for a single service where a library is simpler, or where the per-pod overhead is unacceptable at very high density.</p>`,
    },
  ],
  figures: [
    { id: "sidecar-flow", svg: SIDECAR_SVG, caption: "Sidecar: a helper container shares the pod with the app, handling cross-cutting concerns over localhost with no application code changes." },
  ],
  related: ["ambassador", "circuit-breaker", "correlation-trace-ids"],
});

export const meta = topic.meta;
export const content = topic.content;
