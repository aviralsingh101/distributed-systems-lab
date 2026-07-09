// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, clamp, cycle } from "../../../sim/primitives.js";

export const meta = { id: "leaky-bucket", title: "Leaky Bucket", category: "prod-eng" };

export const content = {
  oneliner: `Smooth traffic to a steady rate.`,
  archetype: "concept",
  sections: [
    { title: `What is Leaky Bucket?`, body: `<p><b>Leaky Bucket</b> — Smooth traffic to a steady rate.</p>
<p>In the payment platform topology, <b>Leaky Bucket</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Leaky Bucket</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Leaky Bucket</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Leaky Bucket</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Leaky Bucket</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Leaky Bucket</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Leaky Bucket in request path">
<defs><marker id="fig-leaky-bucket-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Leaky Bucket</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Leaky Bucket</text>
</svg>`, caption: `Leaky Bucket on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Leaky Bucket structure">
<defs><marker id="fig-leaky-bucket-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Leaky Bucket</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-leaky-bucket-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Leaky Bucket — class and integration boundaries</text>
</svg>`, caption: `Structure of the Leaky Bucket pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Bursty inflow → constant-rate outflow.",
    params: [
      { key: "inflow", label: "Inflow (bursty avg)", min: 1, max: 20, step: 1, value: 12, unit: "/s", live: true },
      { key: "leak", label: "Leak rate", min: 1, max: 12, step: 1, value: 5, unit: "/s", live: true },
      { key: "cap", label: "Bucket size", min: 3, max: 20, step: 1, value: 10, live: true },
    ],
    frame(ctx, t, dt) {
      const d = ctx.d; const { inflow, leak, cap } = ctx.params;
      if (ctx.state.level === undefined) { ctx.state.level = 0; ctx.state.accIn = 0; ctx.state.drop = 0; }
      const inst = inflow * (1 + 0.9 * Math.sin(t * 2));
      if (dt > 0) {
        ctx.state.accIn += dt * inst;
        while (ctx.state.accIn >= 1) { ctx.state.accIn -= 1; if (ctx.state.level < cap) ctx.state.level++; else ctx.state.drop++; }
        ctx.state.level = clamp(ctx.state.level - dt * leak, 0, cap);
      } else {
        ctx.state.level = clamp(ctx.state.level, 0, cap);
      }
      const level = ctx.state.level;
      const bx = 420, by = 120, bw = 160, bh = 260;
      d.node(bx, by, bw, bh, { title: "", color: C.queue });
      d.text(500, by + 18, "leaky bucket", { size: 12, align: "center", color: C.muted });
      const fillH = clamp(level / cap) * (bh - 40);
      d.ctx.save(); d._rr(bx + 10, by + bh - 10 - fillH, bw - 20, fillH, 6); d.ctx.fillStyle = level >= cap ? C.err : C.wallet; d.ctx.globalAlpha = 0.45; d.ctx.fill(); d.ctx.restore();
      d.text(500, by + bh - 24, Math.round(level) + " / " + cap, { size: 15, align: "center", mono: true, color: C.wallet });
      // inflow (bursty)
      const ip = cycle(t * 2, 1); d.token(500, by - 30 + ip * 40, { r: 6, color: inst > leak ? C.warn : C.ok });
      d.node(90, 230, 110, 50, { title: "bursty in", color: C.service, value: Math.round(inst) + "/s" });
      // outflow steady
      const op = cycle(t * leak, 1); const opos = d.along(bx + bw / 2, by + bh, 820, 260, op);
      d.token(opos.x, opos.y, { r: 6, color: C.ok });
      d.node(760, 230, 130, 50, { title: "steady out", color: C.ledger, value: leak + "/s" });
      const overflow = level >= cap;
      ctx.setStatus(overflow ? "bucket full — overflow shed" : "smoothing burst to " + leak + "/s", overflow ? "warn" : "ok");
    },
  });
}
