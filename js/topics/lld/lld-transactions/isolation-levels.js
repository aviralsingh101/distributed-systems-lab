// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { C, withAlpha } from "../../../sim/primitives.js";

export const meta = { id: "isolation-levels", title: "Isolation Levels", category: "transactions" };

export const content = {
  oneliner: `What each level prevents.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>What each level prevents.</p>
<p>Without <b>Isolation Levels</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Isolation Levels</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Isolation Levels</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Isolation Levels</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Isolation Levels</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Isolation Levels structure">
<defs><marker id="fig-isolation-levels-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Isolation Levels</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-isolation-levels-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-isolation-levels-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-isolation-levels-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Isolation Levels — class and integration boundaries</text>
</svg>`, caption: `Structure of the Isolation Levels pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  const levels = ["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"];
  const cols = ["Dirty Read", "Non-repeatable", "Phantom", "Write Skew"];
  // true = prevented
  const table = {
    "Read Uncommitted": [false, false, false, false],
    "Read Committed": [true, false, false, false],
    "Repeatable Read": [true, true, false, false],
    "Serializable": [true, true, true, true],
  };
  return mountSimulation(stage, panel, stageEl, {
    note: "Green = anomaly prevented · Red = still possible.",
    selects: [{ key: "level", label: "Isolation level", value: "Read Committed", options: levels.map((l) => ({ value: l, label: l })) }],
    frame(ctx) {
      const d = ctx.d;
      const sel = ctx.selects.level;
      const x0 = 240, y0 = 120, cw = 150, rh = 74, labelW = x0;
      // column headers
      cols.forEach((c, j) => d.text(x0 + j * cw + cw / 2, y0 - 22, c, { size: 12, align: "center", color: C.muted }));
      levels.forEach((lv, i) => {
        const y = y0 + i * rh;
        const active = lv === sel;
        // row label
        d.node(20, y + 6, labelW - 40, rh - 16, { title: lv, color: C.accent, state: active ? "" : "dim", active });
        table[lv].forEach((prevented, j) => {
          const cx = x0 + j * cw, cy = y + 6, w = cw - 14, h = rh - 16;
          const col = prevented ? C.ok : C.err;
          d.ctx.save();
          d.ctx.globalAlpha = active ? 1 : 0.35;
          d._rr(cx, cy, w, h, 10);
          d.ctx.fillStyle = withAlpha(col, active ? 0.18 : 0.08); d.ctx.fill();
          d.ctx.strokeStyle = withAlpha(col, active ? 0.7 : 0.3); d.ctx.lineWidth = 1.4; d.ctx.stroke();
          d.ctx.restore();
          d.text(cx + w / 2, cy + h / 2, prevented ? "✓ safe" : "✕ possible", { size: 13, align: "center", weight: 700, color: col, alpha: active ? 1 : 0.5 });
        });
      });
      const strength = levels.indexOf(sel) + 1;
      ctx.setStatus(`${sel}: prevents ${table[sel].filter(Boolean).length}/4 anomalies`, strength >= 3 ? "ok" : strength === 1 ? "err" : "warn");
    },
  });
}
