// @article-v2
// @sim-lab
// @figure-handcrafted
import { drawSequence } from "../../../sim/sequence.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
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
      figureAfter: "timeline",
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
  figures: [
    { id: "timeline", svg: `<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lost Update timeline"> <defs><marker id="fig-lost-update-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <text x="260" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Concurrent timeline — time flows right</text> <rect x="20" y="40" width="70" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="55" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker A</text> <rect x="20" y="90" width="70" height="32" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="55" y="110" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Worker B</text> <rect x="120" y="65" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="165" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shared row</text><text x="165" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Ledger</text> <rect x="240" y="40" width="80" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="280" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">read 100</text> <rect x="340" y="40" width="80" height="32" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="380" y="60" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">write 120</text> <rect x="240" y="90" width="80" height="32" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="280" y="110" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">read 100</text> <rect x="340" y="90" width="80" height="32" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/> <text x="380" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">write 130</text><text x="380" y="116" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stale!</text> <rect x="440" y="65" width="70" height="40" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/> <text x="475" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">130 ✗</text><text x="475" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lost +20</text> <line x1="90" y1="56" x2="118" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="90" y1="106" x2="118" y2="88" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="210" y1="80" x2="238" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="210" y1="88" x2="238" y2="106" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="320" y1="56" x2="338" y2="56" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="320" y1="106" x2="338" y2="106" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="420" y1="56" x2="438" y2="78" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> <line x1="420" y1="106" x2="438" y2="92" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lost-update-arr)"/> </svg>`, caption: `Lost Update: two workers interleave read-modify-write on the same row; the second write overwrites the first.` },
  ],
  related: ["write-skew", "optimistic", "pessimistic"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("lost-update", stage, panel, stageEl);
}