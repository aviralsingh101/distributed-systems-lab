// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "exponential-backoff", title: "Exponential Backoff + Jitter", category: "retry" };

export const content = {
  oneliner: `De-synchronize retries.`,
  archetype: "concept",
  sections: [
    { title: `What is Exponential Backoff + Jitter?`, body: `<p><b>Exponential Backoff + Jitter</b> — De-synchronize retries.</p>
<p>Retries amplify load when backends are degraded. Exponential backoff with full jitter spreads retry timing. Circuit breakers stop retry storms; single-flight refresh prevents cache stampede on hot merchant config keys.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Exponential Backoff + Jitter</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Exponential Backoff + Jitter</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Exponential Backoff + Jitter</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Exponential Backoff + Jitter</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Exponential Backoff + Jitter</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Exponential Backoff + Jitter in request path">
<defs><marker id="fig-exponential-backoff-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Exponential B…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Exponential Backoff + Jitter</text>
</svg>`, caption: `Exponential Backoff + Jitter on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Exponential Backoff + Jitter structure">
<defs><marker id="fig-exponential-backoff-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Exponential Bac…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-exponential-backoff-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Exponential Backoff + Jitter — class and integration boundaries</text>
</svg>`, caption: `Structure of the Exponential Backoff + Jitter pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const N = 10, attempts = [1, 2, 4, 8]; // relative delays, cumulative below
  const rand = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  return mountSimulation(stage, panel, stageEl, {
    note: "Each dot is a retry attempt over a 16s window.",
    toggles: [{ key: "jitter", label: "Add random jitter", kind: "ok", value: false }],
    frame(ctx) {
      const d = ctx.d; const jit = ctx.toggles.jitter;
      const x0 = 120, x1 = 920, span = 16;
      const tx = (sec) => x0 + (sec / span) * (x1 - x0);
      // axis
      d.ctx.save(); d.ctx.strokeStyle = C.panelLine; d.ctx.beginPath(); d.ctx.moveTo(x0, 400); d.ctx.lineTo(x1, 400); d.ctx.stroke(); d.ctx.restore();
      for (let s = 0; s <= span; s += 2) d.text(tx(s), 416, s + "s", { size: 10, align: "center", color: C.muted });

      const buckets = new Array(span).fill(0);
      for (let i = 0; i < N; i++) {
        const y = 90 + i * 30;
        d.text(x0 - 16, y, "c" + (i + 1), { size: 10, align: "right", color: C.muted });
        let cum = 0;
        attempts.forEach((base, k) => {
          cum += base;
          const jitter = jit ? rand(i, k) * base : 0;
          const at = Math.min(span - 0.2, cum + jitter);
          d.token(tx(at), y, { r: 5, color: jit ? C.ok : C.warn, glow: false });
          buckets[Math.floor(at)]++;
        });
      }
      // histogram at bottom
      const maxB = Math.max(...buckets, 1);
      for (let s = 0; s < span; s++) {
        const h = (buckets[s] / maxB) * 90;
        const bx = tx(s), bw = (x1 - x0) / span - 4;
        d.ctx.save(); d._rr(bx, 520 - h, bw, h, 3); d.ctx.fillStyle = (!jit && buckets[s] >= N * 0.8) ? C.err : (jit ? C.ok : C.warn); d.ctx.fill(); d.ctx.restore();
      }
      d.text(x0, 500, "retries per second", { size: 11, color: C.muted });
      ctx.setStatus(jit ? "jittered — load spread evenly" : "no jitter — synchronized spikes", jit ? "ok" : "err");
    },
  });
}
