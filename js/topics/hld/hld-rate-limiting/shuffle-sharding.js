// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "shuffle-sharding", title: "Shuffle Sharding", category: "prod-eng" };

export const content = {
  oneliner: `Overlapping subsets limit blast radius.`,
  archetype: "concept",
  sections: [
    { title: `What is Shuffle Sharding?`, body: `<p><b>Shuffle Sharding</b> — Overlapping subsets limit blast radius.</p>
<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Shuffle Sharding</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Shuffle Sharding</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Shuffle Sharding</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Shuffle Sharding</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Shuffle Sharding</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shuffle Sharding in request path">
<defs><marker id="fig-shuffle-sharding-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shuffle Shard…</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Shuffle Sharding</text>
</svg>`, caption: `Shuffle Sharding on the payment request path — from client charge to Ledger commit.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shuffle Sharding structure">
<defs><marker id="fig-shuffle-sharding-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shuffle Sharding</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-shuffle-sharding-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Shuffle Sharding — class and integration boundaries</text>
</svg>`, caption: `Structure of the Shuffle Sharding pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const SERVERS = 8, TENANTS = 6;
  const rand = (i, k) => { const s = Math.sin(i * 37.3 + k * 91.7) * 4139.1; return s - Math.floor(s); };
  const shardOf = (tenant, shuffle) => {
    if (!shuffle) return [0, 1]; // everyone on same shard
    const a = Math.floor(rand(tenant, 1) * SERVERS);
    let b = Math.floor(rand(tenant, 2) * SERVERS); if (b === a) b = (b + 1) % SERVERS;
    return [a, b];
  };
  return mountSimulation(stage, panel, stageEl, {
    note: "Tenant 1 (red) is the noisy neighbor.",
    toggles: [{ key: "fix", label: "Shuffle sharding", kind: "ok", value: false }],
    frame(ctx) {
      const d = ctx.d; const fix = ctx.toggles.fix;
      const badShard = shardOf(0, fix);
      // servers
      const sx0 = 150, sgap = 90;
      const serverBad = new Array(SERVERS).fill(false);
      badShard.forEach((s) => (serverBad[s] = true));
      for (let s = 0; s < SERVERS; s++) {
        const x = sx0 + s * sgap;
        d.node(x - 34, 110, 68, 48, { title: "s" + s, color: C.ledger, state: serverBad[s] ? "err" : "ok" });
      }
      // tenants
      let affected = 0;
      for (let ti = 0; ti < TENANTS; ti++) {
        const x = 200 + ti * 130, y = 320;
        const shard = shardOf(ti, fix);
        const hit = ti === 0 ? true : shard.every((s) => serverBad[s]); // affected if BOTH its servers are bad
        if (ti !== 0 && hit) affected++;
        d.node(x - 55, y, 110, 50, { title: "tenant " + (ti + 1), color: ti === 0 ? C.err : (hit ? C.warn : C.service), state: ti === 0 ? "err" : (hit ? "warn" : "ok") });
        shard.forEach((s) => d.arrow(x, y, sx0 + s * sgap, 158, { color: ti === 0 ? C.err : (hit ? C.warn : C.faint), alpha: ti === 0 ? 0.7 : 0.3, head: false, width: 1 }));
      }
      d.badge(500, 470, fix ? `blast radius: tenant 1 + ${affected} others affected` : `shared shard: all tenants affected`, { color: fix ? C.ok : C.err, align: "center" });
      ctx.setStatus(fix ? "isolated — tiny blast radius" : "no isolation — one tenant hits everyone", fix ? "ok" : "err");
    },
  });
}
