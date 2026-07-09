// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "read-replica-lag", title: "Read Replica Lag", category: "db-scaling" };

export const content = {
  oneliner: `Read-your-write fails.`,
  archetype: "concept",
  sections: [
    { title: `What is Read Replica Lag?`, body: `<p><b>Read Replica Lag</b> — Read-your-write fails.</p>
<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Read Replica Lag</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Read Replica Lag</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Read Replica Lag</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Read Replica Lag</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Read Replica Lag</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "replica-lag", svg: `<svg viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replication lag">
<defs><marker id="fig-read-replica-lag-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="40" y="40" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="85" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Primary</text><text x="85" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">writes</text>
<rect x="180" y="25" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="45" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 1</text>
<rect x="180" y="70" width="80" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="220" y="90" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Replica 2</text>
<rect x="300" y="40" width="80" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="340" y="54" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Reader</text><text x="340" y="74" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale?</text>
<line x1="130" y1="55" x2="178" y2="41" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-replica-lag-arr)"/>
<line x1="130" y1="60" x2="178" y2="86" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-replica-lag-arr)"/>
<line x1="260" y1="41" x2="298" y2="52" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-replica-lag-arr)"/>
</svg>`, caption: `Primary accepts writes; replicas converge asynchronously — reads may be stale.` },
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Read Replica Lag structure">
<defs><marker id="fig-read-replica-lag-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Read Replica Lag</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-replica-lag-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-replica-lag-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-read-replica-lag-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Read Replica Lag — class and integration boundaries</text>
</svg>`, caption: `Structure of the Read Replica Lag pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "Write to primary, then read the balance.",
    toggles: [{ key: "fix", label: "Read-your-writes (route to primary)", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "p", label: "Primary", color: C.ledger, kind: "db", value: "60" },
        { id: "app", label: "App", color: C.service },
        { id: "r", label: "Replica", color: C.gateway, kind: "db", value: "100 (lag)" },
      ];
      const steps = [
        { from: "app", to: "p", label: "write balance=60", good: true, set: { p: "60" } },
        fix
          ? { from: "app", to: "p", label: "read (route to primary)", good: true, set: { app: "sees 60 ✓" } }
          : { from: "app", to: "r", label: "read from replica", bad: true, set: { app: "sees 100!" } },
        { from: "p", to: "r", label: "replication catches up", set: { r: "60" } },
      ];
      return {
        actors, steps, stepDur: 1.1,
        status: (r) => !r.done ? { text: "write then read…", cls: "" } : { text: fix ? "read-your-writes → sees 60" : "stale replica → sees 100", cls: fix ? "ok" : "err" },
      };
    },
  });
}
