// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf } from "../../../sim/primitives.js";

export const meta = { id: "zookeeper-lock", title: "ZooKeeper Locks", category: "dist-lock" };

export const content = {
  oneliner: `Sequential ephemeral nodes.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Sequential ephemeral nodes.</p>
<p>Without <b>ZooKeeper Locks</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>ZooKeeper Locks</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>ZooKeeper Locks</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>ZooKeeper Locks</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>ZooKeeper Locks</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "dist-lock", svg: `<svg viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distributed lock">
<rect x="40" y="38" width="70" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="75" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Pod A</text>
<rect x="40" y="78" width="70" height="28" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="75" y="86" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Pod B</text><text x="75" y="106" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale</text>
<rect x="160" y="48" width="90" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="205" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Redis Lock</text><text x="205" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">token=42</text>
<rect x="290" y="38" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="335" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<text x="200" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Only token holder may write</text>
</svg>`, caption: `Distributed lock: SET key NX PX with unique token; stale holder rejected via fencing token.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Lowest sequence number holds the lock; each waiter watches its predecessor.",
    frame(ctx, t) {
      const d = ctx.d;
      const names = ["n-0001", "n-0002", "n-0003"];
      const ph = phaseOf(t, [1.8, 1.8, 1.8]);
      const holder = ph.i; // which index currently holds (others gone)
      d.text(500, 60, "/lock/  (sequential ephemeral znodes)", { size: 13, align: "center", color: C.muted });
      for (let i = 0; i < 3; i++) {
        const x = 240 + i * 260, y = 200;
        const gone = i < holder;
        const holds = i === holder;
        d.node(x - 80, y - 34, 160, 68, { title: names[i], color: C.gateway, state: gone ? "dim" : holds ? "ok" : "warn", active: holds, value: gone ? "released" : holds ? "HOLDS lock" : "waits" });
        d.node(x - 60, y + 120, 120, 44, { title: "worker " + (i + 1), color: C.service, state: gone ? "dim" : "" });
        d.arrow(x, y + 34, x, y + 120, { color: C.faint, width: 1, head: false, alpha: 0.4 });
        if (i > 0) d.arrow(x - 80, y, (240 + (i - 1) * 260) + 80, y, { color: i === holder + 1 ? C.warn : C.faint, dashed: true, width: 1.4, label: i === holder + 1 ? "watches" : "" });
      }
      d.badge(500, 470, "lock held by " + names[holder] + " — no thundering herd", { color: C.ok, align: "center" });
      ctx.setStatus("sequential handoff, one waiter woken at a time", "ok");
    },
  });
}
