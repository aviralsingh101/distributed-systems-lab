// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const BTREE_SVG = `<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="B-tree index descending from root to leaf pages">
  <defs><marker id="fig-indexing-strategies-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="255" y="20" width="130" height="34" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="320" y="42" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="ui-monospace,monospace">root: [ 40 | 80 ]</text>
  <rect x="60" y="90" width="120" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="120" y="110" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">10 | 25 | 38</text>
  <rect x="260" y="90" width="120" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="320" y="110" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">45 | 60 | 75</text>
  <rect x="460" y="90" width="120" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="520" y="110" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">82 | 90 | 99</text>
  <line x1="290" y1="54" x2="130" y2="88" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-indexing-strategies-arr)"/>
  <line x1="320" y1="54" x2="320" y2="88" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-indexing-strategies-arr)"/>
  <line x1="350" y1="54" x2="510" y2="88" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-indexing-strategies-arr)"/>
  <line x1="60" y1="150" x2="580" y2="150" stroke="#3ddc97" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text x="320" y="145" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">leaf pages linked in sorted order → range scans are cheap</text>
  <text x="320" y="185" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">O(log n) hops root→leaf; leaves point to the heap row (or hold it, for a clustered index).</text>
</svg>`;

const topic = makeTopic({
  id: "indexing-strategies",
  title: "Indexing Strategies",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Choosing the right index — B-tree, composite, covering, or partial — so the planner can find rows without scanning the table.`,
  sections: [
    { title: `What an index buys you`, body: `<p>An <b>index</b> lets the database locate rows without reading the whole table. The default is a <b>B-tree</b> (B+tree): balanced, sorted, <code>O(log n)</code> page reads from root to leaf. Leaves are linked in order, so equality, range, prefix <code>LIKE</code>, and <code>ORDER BY</code> share one structure.</p>
<p>At the leaf, the entry either points to the row's location in the heap (Postgres) or <em>contains</em> the row (InnoDB clustered primary key). Indexes cost write amplification and storage on every <code>INSERT</code>/<code>UPDATE</code>/<code>DELETE</code> — aim for the smallest set that covers your real query shapes, not one index per column.</p>
<pre>CREATE INDEX idx_ledger_wallet_created
  ON ledger_entry (wallet_id, created_at);

CREATE INDEX idx_ledger_payment_id
  ON ledger_entry (payment_id);</pre>` },
    { title: `How a B-tree lookup works`, figureAfter: "btree", body: `<p>For <code>WHERE id = 60</code> the engine descends from root to leaf. For <code>WHERE created_at BETWEEN a AND b</code> it descends once to the first match, then walks linked leaves — no re-descent per row.</p>
<p>Use <code>EXPLAIN (ANALYZE, BUFFERS)</code> to verify the planner picks your index (look for <code>Index Scan</code> or <code>Index Only Scan</code>, not <code>Seq Scan</code> on large tables).</p>
<pre>-- Uses idx_ledger_wallet_created: equality on wallet_id + sort on created_at
SELECT *
FROM ledger_entry
WHERE wallet_id = :walletId
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ledger_entry WHERE wallet_id = :walletId ORDER BY created_at DESC LIMIT 20;</pre>` },
    { title: `Composite and covering indexes`, body: `<p>A composite index on <code>(a, b, c)</code> follows the <b>leftmost-prefix rule</b>: supports <code>a</code>, <code>(a,b)</code>, <code>(a,b,c)</code> — not <code>b</code> alone. Put equality columns first, range/sort last.</p>
<p>A <b>covering index</b> includes every column the query needs, so the engine answers from the index alone (<b>index-only scan</b>) without fetching the heap row. Postgres adds non-key payload columns with <code>INCLUDE</code>:</p>
<p>Example: "recent entries and amounts for a wallet" with <code>INCLUDE (amount_minor)</code> needs no table fetch at all.</p>
<pre>CREATE INDEX idx_entry_wallet_created
  ON ledger_entry (wallet_id, created_at)
  INCLUDE (amount_minor);

CREATE INDEX idx_payment_wallet_status_created
  ON payment (wallet_id, status, created_at);</pre>` },
    { title: `Partial indexes`, body: `<p>A <b>partial index</b> indexes only rows matching a predicate — smaller and cheaper to maintain:</p>
<pre>CREATE INDEX idx_orders_pending
  ON "order" (created_at)
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_wallet_email_live
  ON wallet (owner_email)
  WHERE deleted_at IS NULL;</pre>
<p>Perfect for work-queue queries that only scan pending rows — if pending orders are 1% of the table, the index is ~1% of the size and much faster to maintain. Partial unique indexes also enforce conditional uniqueness: same email allowed on soft-deleted rows, unique among live rows.</p>` },
    { title: `Pagination: offset vs cursor`, body: `<p><b>OFFSET</b> (<code>LIMIT 20 OFFSET 10000</code>) walks and discards rows — cost grows with depth and is unstable under concurrent inserts. <b>Keyset (cursor) pagination</b> remembers the last sort key:</p>
<pre>CREATE INDEX idx_ledger_wallet_created_id
  ON ledger_entry (wallet_id, created_at DESC, id DESC);

SELECT *
FROM ledger_entry
WHERE wallet_id = :walletId
  AND (created_at, id) &lt; (:lastTs, :lastId)
ORDER BY created_at DESC, id DESC
LIMIT 20;</pre>
<p>Every page is an <code>O(log n)</code> seek plus a short scan — stable under concurrent inserts because you never skip or repeat rows by page number. Use keyset for infinite scroll and deep pagination; reserve OFFSET for small bounded admin pages (first few pages only).</p>` },
  ],
  figures: [
    { id: "btree", svg: BTREE_SVG, caption: "A B-tree: descend from root through internal nodes to a sorted, linked leaf level. Equality and range queries both start with one O(log n) descent." },
  ],
  related: ["primary-foreign-keys", "denormalization-patterns", "read-replica-routing"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("indexing-strategies", stage, panel, stageEl);
}
