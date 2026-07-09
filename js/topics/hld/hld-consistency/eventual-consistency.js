// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, cycle, clamp } from "../../../sim/primitives.js";

export const meta = { id: "eventual-consistency", title: "Eventual Consistency", category: "consistency" };

export const content = {
  oneliner: `Replicas converge later.`,
  archetype: "concept",
  sections: [
    { title: `What is Eventual Consistency?`, body: `<p><b>Eventual Consistency</b> — Replicas converge later.</p>
<p>Under network partition, systems choose between strong consistency and availability. Quorum reads/writes use <code>R + W > N</code>. Payment ledgers often favor CP on the primary write path with async replica convergence for analytics.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Eventual Consistency</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Eventual Consistency</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Eventual Consistency</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Eventual Consistency</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Eventual Consistency</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "replica-lag", svg: `<svg viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replication lag">
<defs><marker id="fig-eventual-consistency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="40" y="40" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="85" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Primary</text><text x="85" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">writes</text>
<rect x="180" y="25" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="45" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 1</text>
<rect x="180" y="70" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="90" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 2</text>
<rect x="300" y="40" width="80" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="340" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Reader</text><text x="340" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale?</text>
<line x1="130" y1="55" x2="178" y2="41" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-eventual-consistency-arr)"/>
<line x1="130" y1="60" x2="178" y2="86" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-eventual-consistency-arr)"/>
<line x1="260" y1="41" x2="298" y2="52" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-eventual-consistency-arr)"/>
</svg>`, caption: `Primary accepts writes; replicas converge asynchronously — reads may be stale.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eventual Consistency structure">
<defs><marker id="fig-eventual-consistency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Eventual Consis…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-eventual-consistency-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-eventual-consistency-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-eventual-consistency-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Eventual Consistency — class and integration boundaries</text>
</svg>`, caption: `Structure of the Eventual Consistency pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "A write propagates to replicas over time.",
    params: [{ key: "speed", label: "Propagation delay", min: 1, max: 6, step: 1, value: 3, unit: "×", live: true }],
    frame(ctx, t) {
      const d = ctx.d; const delay = ctx.params.speed;
      const period = delay * 2;
      const tt = (t % period) / period; // 0..1 propagation
      const reps = [{ x: 500, y: 120 }, { x: 260, y: 280 }, { x: 740, y: 280 }, { x: 380, y: 430 }, { x: 620, y: 430 }];
      // distance-based arrival
      reps.forEach((r, i) => {
        const arriveAt = i === 0 ? 0 : 0.15 + i * 0.18;
        const has = tt >= arriveAt;
        d.node(r.x - 70, r.y - 26, 140, 52, { title: i === 0 ? "Replica A" : "Replica " + String.fromCharCode(65 + i), color: has ? C.ledger : C.gateway, state: has ? "ok" : "warn", active: i === 0, value: has ? "60 (new)" : "100 (old)" });
        if (i > 0) {
          d.arrow(reps[0].x, reps[0].y + 26, r.x, r.y - 26, { color: has ? C.ok : C.faint, alpha: 0.3, head: false });
          if (tt < arriveAt && tt > arriveAt - 0.18) { const p = (tt - (arriveAt - 0.18)) / 0.18; const pos = d.along(reps[0].x, reps[0].y + 26, r.x, r.y - 26, p); d.token(pos.x, pos.y, { r: 6, color: C.ok }); }
        }
      });
      const converged = tt > 0.9;
      const nHas = reps.filter((_, i) => tt >= (i === 0 ? 0 : 0.15 + i * 0.18)).length;
      ctx.setStatus(converged ? "converged — all replicas = 60" : `propagating… ${nHas}/5 have the new value`, converged ? "ok" : "warn");
    },
  });
}
