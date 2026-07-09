// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, clamp, withAlpha } from "../../../sim/primitives.js";

export const meta = { id: "context-switching", title: "Context Switching", category: "performance" };

export const content = {
  oneliner: `Too many threads waste CPU.`,
  archetype: "concept",
  sections: [
    { title: `What is Context Switching?`, body: `<p><b>Context Switching</b> — Too many threads waste CPU.</p>
<p>In the payment platform topology, <b>Context Switching</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Context Switching</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Context Switching</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Context Switching</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Context Switching</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Context Switching</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Context Switching in request path">
<defs><marker id="fig-context-switching-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Context Switc…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Context Switching</text>
</svg>`, caption: `Context Switching on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Context Switching structure">
<defs><marker id="fig-context-switching-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Context Switchi…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-context-switching-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Context Switching — class and integration boundaries</text>
</svg>`, caption: `Structure of the Context Switching pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const CORES = 8;
  return mountSimulation(stage, panel, stageEl, {
    note: "Throughput vs thread count (8 cores).",
    params: [{ key: "threads", label: "Threads", min: 1, max: 200, step: 1, value: 8, live: true }],
    frame(ctx) {
      const d = ctx.d; const th = ctx.params.threads;
      const x0 = 130, x1 = 900, y0 = 90, y1 = 420;
      const tput = (n) => { const useful = Math.min(n, CORES); const overhead = 1 + Math.max(0, n - CORES) * 0.02; return useful / overhead; };
      const maxT = CORES;
      const px = (n) => x0 + (n / 200) * (x1 - x0);
      const py = (v) => y1 - clamp(v / maxT) * (y1 - y0);
      d.ctx.save(); d.ctx.strokeStyle = C.panelLine; d.ctx.beginPath(); d.ctx.moveTo(x0, y0); d.ctx.lineTo(x0, y1); d.ctx.lineTo(x1, y1); d.ctx.stroke(); d.ctx.restore();
      d.text(x0 - 8, y0, "throughput", { size: 11, align: "right", color: C.muted });
      d.text(x1, y1 + 16, "threads →", { size: 11, align: "right", color: C.muted });
      d.ctx.save(); d.ctx.strokeStyle = C.accent; d.ctx.lineWidth = 2.5; d.ctx.beginPath();
      for (let n = 1; n <= 200; n += 2) { const X = px(n), Y = py(tput(n)); n === 1 ? d.ctx.moveTo(X, Y) : d.ctx.lineTo(X, Y); }
      d.ctx.stroke(); d.ctx.restore();
      // core count marker
      d.ctx.save(); d.ctx.strokeStyle = withAlpha(C.ok, 0.5); d.ctx.setLineDash([4, 4]); d.ctx.beginPath(); d.ctx.moveTo(px(CORES), y0); d.ctx.lineTo(px(CORES), y1); d.ctx.stroke(); d.ctx.restore();
      d.text(px(CORES), y0 - 4, "cores=8", { size: 10, align: "center", color: C.ok });
      const cx = px(th), cy = py(tput(th));
      const bad = th > CORES * 3;
      d.token(cx, cy, { r: 8, color: bad ? C.err : C.ok });
      d.text(500, 470, `${th} threads → throughput ${tput(th).toFixed(1)} (peak ${maxT})`, { size: 14, align: "center", mono: true, color: bad ? C.err : C.ink });
      ctx.setStatus(th <= CORES ? "scaling with cores" : bad ? "thrashing — switching dominates" : "past peak — overhead growing", th <= CORES ? "ok" : bad ? "err" : "warn");
    },
  });
}
