// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "cap-theorem", title: "CAP Theorem", category: "consistency" };

export const content = {
  oneliner: `Pick 2 under partition.`,
  archetype: "concept",
  sections: [
    { title: `What is CAP Theorem?`, body: `<p><b>CAP Theorem</b> — Pick 2 under partition.</p>
<p>Under network partition, systems choose between strong consistency and availability. Quorum reads/writes use <code>R + W > N</code>. Payment ledgers often favor CP on the primary write path with async replica convergence for analytics.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>CAP Theorem</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>CAP Theorem</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>CAP Theorem</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>CAP Theorem</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>CAP Theorem</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "cap-triangle", svg: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CAP theorem">
<polygon points="150,25 40,135 260,135" fill="none" stroke="#5b9dff" stroke-width="1.5"/>
<text x="150" y="20" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Consistency</text>
<text x="30" y="150" fill="#cdd6e8" font-size="11" font-family="system-ui">Availability</text>
<text x="230" y="150" fill="#cdd6e8" font-size="11" font-family="system-ui">Partition</text>
<text x="150" y="100" text-anchor="middle" fill="#ff5c6c" font-size="10" font-family="system-ui">pick 2 under partition</text>
</svg>`, caption: `CAP: under partition, choose Consistency or Availability — not both.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CAP Theorem structure">
<defs><marker id="fig-cap-theorem-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">CAP Theorem</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cap-theorem-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cap-theorem-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cap-theorem-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">CAP Theorem — class and integration boundaries</text>
</svg>`, caption: `Structure of the CAP Theorem pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "A partition splits two nodes. Consistency or Availability?",
    selects: [{ key: "mode", label: "Choice under partition", value: "CP", options: [{ value: "CP", label: "CP — consistent (reject minority)" }, { value: "AP", label: "AP — available (accept both)" }] }],
    toggles: [{ key: "part", label: "Network partition active", kind: "warn", value: true }],
    frame(ctx, t) {
      const d = ctx.d; const part = ctx.toggles.part; const cp = ctx.selects.mode === "CP";
      const A = { x: 260, y: 240 }, B = { x: 740, y: 240 };
      if (part) { d.ctx.save(); d.ctx.strokeStyle = C.err; d.ctx.setLineDash([8, 8]); d.ctx.lineWidth = 2; d.ctx.beginPath(); d.ctx.moveTo(500, 90); d.ctx.lineTo(500, 420); d.ctx.stroke(); d.ctx.restore(); d.text(500, 70, "partition", { size: 12, align: "center", color: C.err }); }
      else d.arrow(A.x + 90, A.y, B.x - 90, B.y, { color: C.ok, label: "in sync", head: false });

      const aWrites = !part || !cp || true;
      const bWrites = !part ? true : (cp ? false : true);
      d.node(A.x - 90, A.y - 34, 180, 68, { title: "Node A (majority)", color: C.ledger, state: "ok", active: true, value: "balance 60" });
      d.node(B.x - 90, B.y - 34, 180, 68, { title: "Node B (minority)", color: C.gateway, state: part && cp ? "dim" : (part && !cp ? "warn" : "ok"), active: true, value: part && cp ? "read-only" : (part && !cp ? "balance 80" : "balance 60") });
      // client writes
      d.node(A.x - 60, 380, 120, 40, { title: "write", color: C.service });
      d.node(B.x - 60, 380, 120, 40, { title: "write", color: C.service });
      d.arrow(A.x, 380, A.x, A.y + 34, { color: C.ok, head: true, label: "ok" });
      d.arrow(B.x, 380, B.x, B.y + 34, { color: (part && cp) ? C.err : C.ok, head: true, dashed: part && cp, label: (part && cp) ? "rejected" : "ok" });

      let msg, cls;
      if (!part) { msg = "healthy — consistent & available"; cls = "ok"; }
      else if (cp) { msg = "CP: minority rejects writes — consistent, not fully available"; cls = "ok"; }
      else { msg = "AP: both accept — available, but diverged (60 vs 80)"; cls = "warn"; }
      d.badge(500, 470, msg, { color: cls === "ok" ? C.ok : C.warn, align: "center" });
      ctx.setStatus(msg, cls);
    },
  });
}
