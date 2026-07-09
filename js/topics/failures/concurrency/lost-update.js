// @article-v2
import { mountSimulation } from "../../../sim/controls.js";
import { drawSequence } from "../../../sim/sequence.js";
import { C } from "../../../sim/primitives.js";

export const meta = { id: "lost-update", title: "Lost Update", category: "concurrency" };

export const content = {
  oneliner: "Two transactions read the same balance, both write back, and one deposit silently disappears.",
  archetype: "failure",
  sections: [
    {
      title: "Symptom",
      body: `<p>Two support agents issue concurrent refunds on the same Wallet. Each loads <code>balance=100</code>, adds their credit in memory, and saves. The second save wins with a value computed from 100, not 120 — the first refund vanishes. No error is returned; reconciliation discovers it hours later.</p>
<pre>balance = 100
T1 reads 100        T2 reads 100
T1 writes 120       T2 writes 130
expected 150, actual 130 — T1's +20 is lost</pre>`,
    },
    {
      title: "Root cause",
      body: `<p>A <b>lost update</b> is an ANSI SQL anomaly under <b>Read Committed</b> (PostgreSQL, SQL Server, Oracle default). Two transactions read the same row, each computes a new value from what they read, and both write. The second write is based on <i>stale</i> data — it overwrites the first without error.</p>
<p>This is the classic <b>read-modify-write</b> race on a single row: <code>balance = balance + 20</code> implemented as read → add in app → write absolute value. Under Read Committed, reads do not hold locks until commit. ORMs widen the window: load entity, user thinks for 30 seconds, save.</p>
<p>Not the same as <b>dirty read</b> (uncommitted data) or <b>write skew</b> (two rows, one invariant). Lost update is two writers on the <i>same</i> row.</p>
<div class="callout"><p><b>Key insight:</b> <code>UPDATE wallet SET balance = balance + 20</code> is atomic in SQL — the bug is almost always application-level RMW, not SQL arithmetic.</p></div>`,
    },
    {
      title: "The interleaving",
      body: `<pre>T1: SELECT balance → 100
T2: SELECT balance → 100
T1: UPDATE balance = 120  -- +20 refund
T2: UPDATE balance = 130  -- +30 promo (stale base 100)
COMMIT both → final 130, expected 150</pre>
<p>Repeatable Read in PostgreSQL uses MVCC snapshots — still allows lost update for RMW unless you use <code>FOR UPDATE</code> or atomic UPDATE. Serializable prevents the anomaly but may abort with <code>40001 serialization_failure</code>.</p>`,
    },
    {
      title: "Fixes",
      body: `<ul>
<li><b>Atomic SQL</b> — <code>UPDATE wallet SET balance = balance + :delta WHERE id = :id</code>. Read and write in one statement under row-exclusive lock. Best for simple increments.</li>
<li><b>Optimistic locking</b> — <code>version INT</code>; <code>UPDATE ... WHERE id = ? AND version = ?</code>; zero rows → retry. Works across HTTP boundaries.</li>
<li><b>Pessimistic locking</b> — <code>SELECT ... FOR UPDATE</code> before RMW. T2 blocks until T1 commits. Good for hot wallet rows.</li>
</ul>
<p>For payment wallets, optimistic locking with bounded retries (3× with jitter) is common; fraud holds may use pessimistic locks on the same row.</p>`,
    },
    {
      title: "Prevention in production",
      body: `<p>Expose relative adjustments (<code>POST /wallet/credit +20</code>) not absolute set-balance from clients. Track <code>optimistic_lock_conflict</code> counter. Nightly reconciliation: sum(Ledger entries) vs Wallet.balance catches drift.</p>
<p>Hibernate <code>@Version</code> maps to HTTP 409 with retry-after. Do not catch-and-swallow conflicts.</p>`,
    },
  ],
  related: ["write-skew", "optimistic", "pessimistic"],
};

export function createSimulation(stage, panel, stageEl) {
  return mountSimulation(stage, panel, stageEl, {
    note: "Time flows downward. Watch the Ledger's balance.",
    params: [
      { key: "start", label: "Starting balance", min: 0, max: 200, step: 10, value: 100, live: true },
      { key: "a", label: "Deposit T1", min: 10, max: 80, step: 5, value: 20, live: true },
      { key: "b", label: "Deposit T2", min: 10, max: 80, step: 5, value: 30, live: true },
    ],
    toggles: [{ key: "fix", label: "Apply fix (versioned atomic update)", kind: "ok", value: false }],
    build(ctx) {
      const { start, a, b } = ctx.params;
      const actors = [
        { id: "t1", label: "T1 (+" + a + ")", color: C.service, value: "" },
        { id: "db", label: "Ledger", color: C.ledger, kind: "db", value: String(start) },
        { id: "t2", label: "T2 (+" + b + ")", color: C.gateway, value: "" },
      ];
      let steps;
      if (!ctx.toggles.fix) {
        steps = [
          { from: "t1", to: "db", label: "read", set: { t1: "got " + start } },
          { from: "t2", to: "db", label: "read", set: { t2: "got " + start } },
          { from: "t1", to: "db", label: "write " + (start + a), set: { db: String(start + a) } },
          { from: "t2", to: "db", label: "write " + (start + b), bad: true, set: { db: String(start + b), t2: "stale!" } },
        ];
      } else {
        steps = [
          { from: "t1", to: "db", label: "read v0=" + start, set: { t1: "v0=" + start } },
          { from: "t1", to: "db", label: "write v1=" + (start + a), good: true, set: { db: (start + a) + " (v1)" } },
          { from: "t2", to: "db", label: "write @v0 ✕", bad: true, dashed: true, set: { t2: "conflict" } },
          { from: "db", to: "t2", label: "re-read v1=" + (start + a), set: { t2: "got " + (start + a) } },
          { from: "t2", to: "db", label: "write v2=" + (start + a + b), good: true, set: { db: (start + a + b) + " (v2)" } },
        ];
      }
      ctx.state.spec = { actors, steps, stepDur: 1.15 };
    },
    frame(ctx, t, dt) {
      const r = drawSequence(ctx.d, t, ctx.state.spec);
      const { start, a, b } = ctx.params;
      if (!ctx.toggles.fix) {
        ctx.setStatus(r.done ? `balance ${start + b} — want ${start + a + b} (lost ${a})` : "interleaved read-modify-write…", r.done ? "err" : "");
      } else {
        ctx.setStatus(r.done ? `balance ${start + a + b} — both deposits kept` : "versioned writes…", r.done ? "ok" : "");
      }
    },
  });
}
