// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, clamp } from "../../../sim/primitives.js";

export const meta = { id: "hybrid", title: "Hybrid Locking", category: "opt-pess" };

export const content = {
  oneliner: `Switch strategy by contention.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>Switch strategy by contention.</p>
<p>Without <b>Hybrid Locking</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Hybrid Locking</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Hybrid Locking</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Hybrid Locking</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Hybrid Locking</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
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
    note: "Adaptive controller routes each key to the better strategy.",
    params: [{ key: "cont", label: "Contention", min: 0, max: 100, step: 5, value: 20, unit: "%", live: true }],
    toggles: [{ key: "force", label: "Force optimistic (no switching)", kind: "warn", value: false }],
    frame(ctx, t) {
      const d = ctx.d; const cont = ctx.params.cont; const force = ctx.toggles.force;
      const useLock = !force && cont >= 50;
      // contention gauge
      d.gauge(360, 70, 280, 14, cont / 100, { color: cont >= 50 ? C.err : C.ok, label: "observed contention", value: cont + "%" });

      const ctrl = { x: 500, y: 180 };
      d.node(ctrl.x - 90, ctrl.y - 30, 180, 60, { title: "adaptive controller", color: C.accent, active: true, value: useLock ? "→ pessimistic" : "→ optimistic" });

      const occ = { x: 260, y: 360 }, pess = { x: 740, y: 360 };
      d.node(occ.x - 90, occ.y - 34, 180, 68, { title: "Optimistic (CAS)", color: C.service, state: !useLock ? "ok" : "dim", active: !useLock });
      d.node(pess.x - 90, pess.y - 34, 180, 68, { title: "Pessimistic (lock)", color: C.gateway, state: useLock ? "ok" : "dim", active: useLock });
      d.arrow(ctrl.x - 40, ctrl.y + 30, occ.x + 20, occ.y - 34, { color: !useLock ? C.service : C.faint, width: !useLock ? 2.4 : 1, dashed: useLock });
      d.arrow(ctrl.x + 40, ctrl.y + 30, pess.x - 20, pess.y - 34, { color: useLock ? C.gateway : C.faint, width: useLock ? 2.4 : 1, dashed: !useLock });

      // throughput model: OCC ~ 1 - cont; LOCK ~ 0.55 steady; hybrid picks best
      const occT = clamp(1 - cont / 100 * 1.1);
      const lockT = 0.55;
      const eff = force ? occT : Math.max(occT, useLock ? lockT : occT);
      d.vbar(occ.x - 20, 500, 40, 90, occT, 1, { color: C.service });
      d.text(occ.x, 512, "OCC tput", { size: 11, align: "center", color: C.muted });
      d.vbar(pess.x - 20, 500, 40, 90, lockT, 1, { color: C.gateway });
      d.text(pess.x, 512, "lock tput", { size: 11, align: "center", color: C.muted });
      d.vbar(ctrl.x - 26, 500, 52, 90, eff, 1, { color: C.ok, value: Math.round(eff * 100) + "%" });
      d.text(ctrl.x, 512, "effective", { size: 11, align: "center", color: C.muted });

      ctx.setStatus(force ? (cont >= 50 ? "forced optimistic — retries hurting" : "optimistic — fine") : (useLock ? "escalated to pessimistic lock" : "optimistic (low contention)"), force && cont >= 50 ? "warn" : "ok");
    },
  });
}
