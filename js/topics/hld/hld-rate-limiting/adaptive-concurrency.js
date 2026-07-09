// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, clamp } from "../../../sim/primitives.js";

export const meta = { id: "adaptive-concurrency", title: "Adaptive Concurrency Control", category: "prod-eng" };

export const content = {
  oneliner: `Limit by observed latency.`,
  archetype: "concept",
  sections: [
    { title: `What is Adaptive Concurrency Control?`, body: `<p><b>Adaptive Concurrency Control</b> — Limit by observed latency.</p>
<p>In the payment platform topology, <b>Adaptive Concurrency Control</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Adaptive Concurrency Control</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Adaptive Concurrency Control</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Adaptive Concurrency Control</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Adaptive Concurrency Control</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Adaptive Concurrency Control</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adaptive Concurrency Control in request path">
<defs><marker id="fig-adaptive-concurrency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Adaptive Conc…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Adaptive Concurrency Control</text>
</svg>`, caption: `Adaptive Concurrency Control on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adaptive Concurrency Control structure">
<defs><marker id="fig-adaptive-concurrency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Adaptive Concur…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adaptive-concurrency-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Adaptive Concurrency Control — class and integration boundaries</text>
</svg>`, caption: `Structure of the Adaptive Concurrency Control pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Limit rises with headroom, falls when latency climbs.",
    params: [{ key: "lat", label: "Downstream latency", min: 20, max: 400, step: 10, value: 60, unit: "ms", live: true }],
    toggles: [{ key: "adaptive", label: "Adaptive (vs fixed limit)", kind: "ok", value: true }],
    frame(ctx, t, dt) {
      const d = ctx.d; const lat = ctx.params.lat; const adaptive = ctx.toggles.adaptive;
      if (ctx.state.limit === undefined) ctx.state.limit = 40;
      const minLat = 50;
      const target = adaptive ? clamp((minLat / lat) * 80, 5, 100) : 60;
      if (dt > 0) ctx.state.limit += (target - ctx.state.limit) * Math.min(1, dt * 3);
      else ctx.state.limit = target;
      const limit = ctx.state.limit;
      const queueing = lat > minLat * 2;
      const overloaded = !adaptive && lat > 150; // fixed limit too high → queue collapse

      d.node(360, 90, 280, 56, { title: "concurrency limit", color: adaptive ? C.accent : C.warn, active: true, value: Math.round(limit) + " in-flight" });
      d.gauge(300, 220, 400, 18, clamp(limit / 100), { color: adaptive ? C.ok : C.warn, label: "limit", value: Math.round(limit) });
      d.gauge(300, 300, 400, 18, clamp(lat / 400), { color: lat > 150 ? C.err : lat > 100 ? C.warn : C.ok, label: "observed latency", value: lat + "ms" });
      d.badge(500, 400, adaptive ? (queueing ? "latency high → limit lowered" : "headroom → limit raised") : (overloaded ? "fixed limit too high → queue collapse" : "fixed limit"), { color: adaptive ? C.ok : (overloaded ? C.err : C.warn), align: "center" });
      ctx.setStatus(adaptive ? "tracking the sweet spot automatically" : (overloaded ? "fixed limit can't adapt — overloaded" : "fixed limit (may be wrong)"), adaptive ? "ok" : (overloaded ? "err" : "warn"));
    },
  });
}
