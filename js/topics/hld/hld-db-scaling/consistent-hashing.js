// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "consistent-hashing", title: "Consistent Hashing", category: "db-scaling" };

export const content = {
  oneliner: `Virtual nodes balance load.`,
  archetype: "concept",
  sections: [
    { title: `What is Consistent Hashing?`, body: `<p><b>Consistent Hashing</b> — Virtual nodes balance load.</p>
<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Consistent Hashing</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Consistent Hashing</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Consistent Hashing</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Consistent Hashing</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Consistent Hashing</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "hash-ring", svg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hash ring">
<circle cx="80" cy="80" r="55" fill="none" stroke="#5b9dff" stroke-width="1.5"/>
<circle cx="80" cy="25" r="8" fill="#3ddc97"/>
<circle cx="130" cy="100" r="8" fill="#3ddc97"/>
<circle cx="30" cy="100" r="8" fill="#3ddc97"/>
<text x="80" y="84" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">ring</text>
</svg>`, caption: `Consistent hashing: keys map to a ring; virtual nodes balance load across shards.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Consistent Hashing structure">
<defs><marker id="fig-consistent-hashing-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Consistent Hash…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-consistent-hashing-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-consistent-hashing-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-consistent-hashing-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Consistent Hashing — class and integration boundaries</text>
</svg>`, caption: `Structure of the Consistent Hashing pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const cx = 380, cy = 280, R = 175, KEYS = 40;
  const nodes = [{ c: C.wallet, base: 0.05 }, { c: C.gateway, base: 0.32 }, { c: C.ledger, base: 0.52 }];
  const hash = (i) => { const s = Math.sin(i * 127.1 + 11.7) * 43758.5; return s - Math.floor(s); };
  return mountSimulation(stage, panel, stageEl, {
    note: "Hash ring. Each key → next node clockwise.",
    toggles: [{ key: "v", label: "Virtual nodes (×5 each)", kind: "ok", value: false }],
    frame(ctx) {
      const d = ctx.d; const v = ctx.toggles.v;
      // ring
      d.ctx.save(); d.ctx.strokeStyle = C.panelLine; d.ctx.lineWidth = 2; d.ctx.beginPath(); d.ctx.arc(cx, cy, R, 0, Math.PI * 2); d.ctx.stroke(); d.ctx.restore();
      const pt = (frac, r = R) => ({ x: cx + Math.cos(frac * 2 * Math.PI - Math.PI / 2) * r, y: cy + Math.sin(frac * 2 * Math.PI - Math.PI / 2) * r });
      // node points (physical + virtual)
      const points = [];
      nodes.forEach((n, ni) => {
        const reps = v ? 5 : 1;
        for (let r = 0; r < reps; r++) {
          const frac = v ? (n.base + r * 0.2 + hash(ni * 10 + r) * 0.12) % 1 : n.base;
          points.push({ frac, node: ni, c: n.c });
        }
      });
      points.sort((a, b) => a.frac - b.frac);
      const owner = (frac) => { for (const p of points) if (p.frac >= frac) return p; return points[0]; };
      // keys
      const load = [0, 0, 0];
      for (let k = 0; k < KEYS; k++) {
        const frac = hash(k);
        const o = owner(frac); load[o.node]++;
        const p = pt(frac, R);
        d.token(p.x, p.y, { r: 4, color: o.c, glow: false });
      }
      // node markers
      points.forEach((p) => { const pos = pt(p.frac, R); d.token(pos.x, pos.y, { r: v ? 7 : 11, color: p.c }); });
      // load bars
      nodes.forEach((n, i) => {
        d.vbar(700 + i * 90, 440, 50, 260, load[i], KEYS * 0.7, { color: n.c, value: load[i] });
        d.text(725 + i * 90, 462, "node " + (i + 1), { size: 11, align: "center", color: C.muted });
      });
      const max = Math.max(...load), min = Math.min(...load);
      const balanced = max - min <= KEYS * 0.18;
      d.text(790, 120, "keys per node", { size: 12, align: "center", color: C.muted });
      ctx.setStatus(v ? "virtual nodes → balanced load" : "few points → lumpy load (imbalance)", v ? "ok" : "warn");
    },
  });
}
