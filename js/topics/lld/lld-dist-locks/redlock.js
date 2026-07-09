// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, phaseOf } from "../../../sim/primitives.js";

export const meta = { id: "redlock", title: "Redlock Debate", category: "dist-lock" };

export const content = {
  oneliner: `Quorum locks and their critics.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Quorum locks and their critics.</p>
<p>Without <b>Redlock Debate</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Redlock Debate</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Redlock Debate</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Redlock Debate</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Redlock Debate</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
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
    note: "Client must acquire a majority (3 of 5) Redis nodes.",
    toggles: [{ key: "down", label: "One node down", kind: "warn", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const down = ctx.toggles.down;
      const client = { x: 500, y: 470 };
      const N = 5, cx = 500, cy = 180, R = 200;
      const ph = phaseOf(t, [2.2, 1.6]);
      let acquired = 0;
      for (let i = 0; i < N; i++) {
        const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R * 0.7;
        const isDown = down && i === 2;
        const got = !isDown && (ph.i >= 1 || ph.p * N > i);
        if (got) acquired++;
        d.arrow(client.x, client.y, x, y, { color: isDown ? C.err : got ? C.ok : C.faint, width: got ? 2 : 1, dashed: !got, head: false, alpha: got ? 0.9 : 0.3 });
        d.node(x - 46, y - 24, 92, 48, { title: "redis " + (i + 1), color: C.gateway, state: isDown ? "err" : got ? "ok" : "dim", value: isDown ? "DOWN" : got ? "locked" : "" });
      }
      d.node(client.x - 70, client.y - 26, 140, 52, { title: "Client", color: C.service, active: true, value: acquired + "/5 acquired" });
      const majority = acquired >= 3;
      d.badge(500, 528, majority ? "majority ✓ lock held" : "no majority — release & retry", { color: majority ? C.ok : C.err, align: "center" });
      ctx.setStatus(down ? "1 node down — majority still holds" : "lock held on majority", majority ? "ok" : "err");
    },
  });
}
