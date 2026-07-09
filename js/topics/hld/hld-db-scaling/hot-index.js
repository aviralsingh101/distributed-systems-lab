// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, cycle } from "../../../sim/primitives.js";

export const meta = { id: "hot-index", title: "Hot Index", category: "db-scaling" };

export const content = {
  oneliner: `Same B-tree page contended.`,
  archetype: "concept",
  sections: [
    { title: `What is Hot Index?`, body: `<p><b>Hot Index</b> — Same B-tree page contended.</p>
<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Hot Index</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Hot Index</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Hot Index</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Hot Index</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Hot Index</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hot Index in request path">
<defs><marker id="fig-hot-index-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Hot Index</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Hot Index</text>
</svg>`, caption: `Hot Index on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hot Index structure">
<defs><marker id="fig-hot-index-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Hot Index</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-hot-index-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Hot Index — class and integration boundaries</text>
</svg>`, caption: `Structure of the Hot Index pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "B-tree leaf pages. Where do new inserts land?",
    toggles: [{ key: "fix", label: "Scattered key (UUID / hash)", kind: "ok", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const fix = ctx.toggles.fix;
      const pages = 6, x0 = 130, gap = 130, y = 300;
      // root
      d.node(500 - 70, 90, 140, 44, { title: "B-tree root", color: C.gateway });
      for (let i = 0; i < pages; i++) {
        const x = x0 + i * gap;
        const isHot = !fix && i === pages - 1;
        d.node(x - 52, y, 104, 60, { title: "leaf " + i, color: C.ledger, state: isHot ? "err" : "", active: isHot });
        d.arrow(500, 134, x, y, { color: C.faint, width: 1, head: false, alpha: 0.25 });
      }
      // inserts
      for (let k = 0; k < 6; k++) {
        const p = cycle(t * 0.9 + k / 6, 1);
        const target = fix ? Math.floor((Math.sin(k * 91.7) * 0.5 + 0.5) * pages) : pages - 1;
        const tx = x0 + target * gap;
        const pos = d.along(500, 150, tx, y, p);
        d.token(pos.x, pos.y, { r: 6, color: fix ? C.ok : C.err, glow: false });
      }
      if (!fix) d.badge(x0 + (pages - 1) * gap, y + 96, "all inserts here", { color: C.err, align: "center" });
      ctx.setStatus(fix ? "inserts scattered across leaf pages" : "right-most page contention (hot index)", fix ? "ok" : "err");
    },
  });
}
