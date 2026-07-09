// @article-v2
import { sequenceSim } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "phantom-read", title: "Phantom Read", category: "concurrency" };

export const content = {
  oneliner: `A re-run query sees new rows.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>A re-run query sees new rows. In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>` },
    { title: `Root cause`, body: `<p><b>Phantom Read</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
<p><b>Phantom Read</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>
<p>Default database isolation (Read Committed) and naive application patterns do not prevent this without explicit design — the bug is often invisible in unit tests.</p>` },
    { title: `How the failure unfolds`, body: `<p>Two or more workers interleave operations on the same wallet or shared resource. Each step looks valid in isolation; the combined timeline violates an invariant (balance, idempotency, ordering, or lock discipline).</p>
<p>Reproduce with parallel load tests on the same <code>wallet_id</code> — low concurrency in dev hides the race until Black Friday traffic.</p>` },
    { title: `Fixes`, body: `<p>Choose a fix matching contention and UX:</p>
<ul>
<li><b>Atomic operations</b> — express updates in single SQL statements where possible (<code>UPDATE ... SET x = x + ?</code>).</li>
<li><b>Explicit locking</b> — <code>SELECT ... FOR UPDATE</code> or distributed lock with fencing token for cross-service sections.</li>
<li><b>Idempotency</b> — deduplicate retried requests with <code>Idempotency-Key</code> and unique constraints.</li>
<li><b>Isolation upgrade</b> — Serializable or explicit version columns with bounded retry on conflict.</li>
</ul>
<p>Document the chosen fix in the service runbook and add an integration test that fails without it.</p>` },
    { title: `Prevention`, body: `<p>Add alerts before customers notice: reconciliation jobs, conflict counters, lock wait time p99, retry rate dashboards. Run game-days with parallel charge scripts. Code review checklist: no read-modify-write without version check; no external HTTP inside DB transactions; lock ordering documented.</p>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Phantom Read</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Phantom Read</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "timeline", svg: `<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Phantom Read timeline">
<defs><marker id="fig-phantom-read-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<text x="260" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Concurrent timeline — time flows right</text>
<rect x="20" y="40" width="70" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="55" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker A</text>
<rect x="20" y="90" width="70" height="32" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="55" y="110" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker B</text>
<rect x="120" y="65" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="165" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shared row</text><text x="165" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Ledger</text>
<rect x="240" y="40" width="80" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="280" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">read 100</text>
<rect x="340" y="40" width="80" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="380" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">write 120</text>
<rect x="240" y="90" width="80" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="280" y="110" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">read 100</text>
<rect x="340" y="90" width="80" height="32" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="380" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">write 130</text><text x="380" y="120" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale!</text>
<rect x="440" y="65" width="70" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
<text x="475" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">130 ✗</text><text x="475" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lost +20</text>
<line x1="90" y1="56" x2="118" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="90" y1="106" x2="118" y2="88" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="210" y1="80" x2="238" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="210" y1="88" x2="238" y2="106" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="320" y1="56" x2="338" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="320" y1="106" x2="338" y2="106" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="420" y1="56" x2="438" y2="78" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="420" y1="106" x2="438" y2="92" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
</svg>`, caption: `How Phantom Read unfolds — two workers interleave on the same resource; the second write can overwrite the first.` },
    { id: "request-path", svg: `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Phantom Read in request path">
<defs><marker id="fig-phantom-read-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
<rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
<text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
<rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
<text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Phantom Read</text><text x="144" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this topic</text>
<rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
<text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text>
<rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text>
<rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
<text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text>
<rect x="496" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
<text x="532" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text>
<line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<line x1="478" y1="58" x2="494" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-phantom-read-arr)"/>
<text x="320" y="22" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HTTPS request flow — Phantom Read</text>
</svg>`, caption: `Phantom Read on the payment request path — from client charge to Ledger commit.` }
  ],
  related: [],
};

export function createSimulation(stage, panel, stageEl) {
  return sequenceSim(stage, panel, stageEl, {
    note: "T1 counts PENDING rows twice; T2 inserts between.",
    toggles: [{ key: "fix", label: "Serializable / range lock", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "t1", label: "T1 (count)", color: C.service },
        { id: "db", label: "payments", color: C.ledger, kind: "db", value: "3 PENDING" },
        { id: "t2", label: "T2 (insert)", color: C.gateway },
      ];
      const steps = [
        { from: "t1", to: "db", label: "count = 3", set: { t1: "read1 = 3" } },
        fix
          ? { from: "t2", to: "db", label: "INSERT blocked", dashed: true, set: { t2: "waits" } }
          : { from: "t2", to: "db", label: "INSERT +1 commit", set: { db: "4 PENDING" } },
        { from: "t1", to: "db", label: fix ? "recount = 3" : "recount = 4", good: fix, bad: !fix, set: { t1: fix ? "read2 = 3" : "read2 = 4" } },
      ];
      return {
        actors, steps, stepDur: 1.2,
        status: (r) => !r.done ? { text: "counting…", cls: "" }
          : fix ? { text: "counts match: 3 = 3", cls: "ok" } : { text: "3 then 4 — phantom row", cls: "err" },
      };
    },
  });
}
