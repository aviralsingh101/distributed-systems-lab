// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "pessimistic", title: "Pessimistic Concurrency", category: "opt-pess" };

export const content = {
  oneliner: `SELECT ... FOR UPDATE.`,
  archetype: "pattern",
  sections: [
    { title: `Motivation`, body: `<p>SELECT ... FOR UPDATE.</p>
<p>Without <b>Pessimistic Concurrency</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>` },
    { title: `Structure`, body: `<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>` },
    { title: `Implementation flow`, body: `<p>Typical charge flow with <b>Pessimistic Concurrency</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>` },
    { title: `Tradeoffs`, body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>Pessimistic Concurrency</b> was designed for and simpler code is failing reviews or incidents.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Pessimistic Concurrency</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Pessimistic Concurrency</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "structure", svg: `<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pessimistic Concurrency structure">
<defs><marker id="fig-pessimistic-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="30" y="60" width="100" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="80" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">HTTP Handler</text>
<rect x="170" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="225" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Pessimistic Con…</text><text x="225" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">pattern</text>
<rect x="320" y="30" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="365" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger DB</text>
<rect x="320" y="95" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="365" y="117" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text>
<line x1="130" y1="80" x2="168" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-pessimistic-arr)"/>
<line x1="280" y1="70" x2="318" y2="48" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-pessimistic-arr)"/>
<line x1="280" y1="90" x2="318" y2="113" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-pessimistic-arr)"/>
<text x="240" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Pessimistic Concurrency — class and integration boundaries</text>
</svg>`, caption: `Structure of the Pessimistic Concurrency pattern — components and data flow in Order Service.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "SELECT … FOR UPDATE — the second writer waits.",
    scenario(ctx) {
      const actors = [
        { id: "w1", label: "Writer 1", color: C.service },
        { id: "db", label: "Wallet", color: C.ledger, kind: "db", value: "100 · free" },
        { id: "w2", label: "Writer 2", color: C.gateway },
      ];
      const steps = [
        { from: "w1", to: "db", label: "SELECT…FOR UPDATE (lock)", good: true, set: { db: "100 · locked", w1: "holds lock" } },
        { from: "w2", to: "db", label: "FOR UPDATE — waits", dashed: true, set: { w2: "blocked" } },
        { from: "w1", to: "db", label: "balance +20 → commit", good: true, set: { db: "120 · free", w1: "done" } },
        { from: "w2", to: "db", label: "acquires lock, reads 120", set: { db: "120 · locked", w2: "holds lock" } },
        { from: "w2", to: "db", label: "balance +30 → commit", good: true, set: { db: "150 · free", w2: "done" } },
      ];
      return {
        actors, steps, stepDur: 1.1,
        status: (r) => !r.done ? { text: "serialized by the lock…", cls: "" } : { text: "balance 150 — correct, no retries", cls: "ok" },
      };
    },
  });
}
