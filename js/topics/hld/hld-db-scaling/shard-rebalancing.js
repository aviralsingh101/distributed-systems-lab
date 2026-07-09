// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf, clamp } from "../../../sim/primitives.js";

export const meta = { id: "shard-rebalancing", title: "Shard Rebalancing", category: "db-scaling" };

export const content = {
  oneliner: `Moving data disrupts traffic.`,
  archetype: "concept",
  sections: [
    { title: `What is Shard Rebalancing?`, body: `<p><b>Shard Rebalancing</b> — Moving data disrupts traffic.</p>
<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Shard Rebalancing</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Shard Rebalancing</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Shard Rebalancing</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Shard Rebalancing</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Shard Rebalancing</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shard Rebalancing in request path">
<defs><marker id="fig-shard-rebalancing-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shard Rebalan…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Shard Rebalancing</text>
</svg>`, caption: `Shard Rebalancing on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shard Rebalancing structure">
<defs><marker id="fig-shard-rebalancing-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shard Rebalanci…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shard-rebalancing-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Shard Rebalancing — class and integration boundaries</text>
</svg>`, caption: `Structure of the Shard Rebalancing pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const KEYS = 16, N = 4;
  const palette = [C.wallet, C.service, C.gateway, C.ledger, C.warn, C.queue];
  return mountSimulation(stage, panel, stageEl, {
    note: "16 keys, shards 4 → 5. How many keys move?",
    toggles: [{ key: "fix", label: "Consistent hashing", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const fix = ctx.toggles.fix;
      const ph = phaseOf(t, [1.6, 1.6, 2]);
      const after = ph.i >= 1;
      const cols = 8, gap = 100, x0 = 150, y0 = 150, ry = 120;
      let moved = 0;
      // consistent hashing: pretend each key has a ring position; only keys in new arc move
      for (let k = 0; k < KEYS; k++) {
        const before = k % N;
        let now;
        if (!after) now = before;
        else if (!fix) now = k % (N + 1);
        else now = (k % 5 === 0) ? N : before; // only ~1/5 move to the new node 4
        const didMove = after && now !== before;
        if (didMove) moved++;
        const x = x0 + (k % cols) * gap, y = y0 + Math.floor(k / cols) * ry;
        d.token(x, y, { r: 15, color: palette[now], glow: didMove, label: "" });
        if (didMove) d.text(x, y + 26, "moved", { size: 9, align: "center", color: C.err });
      }
      // legend
      for (let s = 0; s <= (after ? N : N - 1); s++) d.node(150 + s * 150, 430, 120, 34, { title: "shard " + s, color: palette[s] });
      const pct = Math.round((moved / KEYS) * 100);
      d.gauge(320, 510, 360, 14, clamp(moved / KEYS), { color: pct > 40 ? C.err : C.ok, label: "keys moved on rebalance", value: pct + "%" });
      ctx.setStatus(!after ? "steady (4 shards)" : (fix ? `consistent hashing: ~${pct}% moved` : `hash mod N: ${pct}% moved!`), after ? (fix ? "ok" : "err") : "");
    },
  });
}
