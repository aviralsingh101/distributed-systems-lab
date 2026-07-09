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
    { title: `What an index buys you`, body: `<p>An <b>index</b> is a secondary data structure that lets the database locate rows without reading the whole table. The default in every relational database is the <b>B-tree</b> (technically a B+tree): a balanced, sorted tree with a large fan-out, so a lookup is <code>O(log n)</code> page reads from root to leaf. Because the leaves are kept in sorted order and linked, a B-tree serves equality (<code>=</code>), range (<code>&lt;</code>, <code>BETWEEN</code>), prefix (<code>LIKE 'abc%'</code>), and <code>ORDER BY</code> — all from the same structure.</p>
<p>Indexes are not free: every index must be updated on <code>INSERT</code>, <code>UPDATE</code>, and <code>DELETE</code>, and it consumes storage and cache. So the goal is the <em>smallest set of indexes</em> that covers your real query shapes, not one index per column.</p>
<pre>@Entity
@Table(name = "ledger_entries",
       indexes = {
           @Index(name = "idx_ledger_wallet_created",
                  columnList = "wallet_id, created_at"),
           @Index(name = "idx_ledger_payment_id",
                  columnList = "payment_id")
       })
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "payment_id")
    private String paymentId;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}</pre>` },
    { title: `How a B-tree lookup works`, figureAfter: "btree", body: `<p>To resolve <code>WHERE id = 60</code> the engine starts at the root, compares against the separator keys to pick a child, and descends until it reaches the leaf holding 60. The leaf entry points to the row's location in the heap (in Postgres, a table row identifier; in a clustered table like InnoDB's primary key, the leaf <em>contains</em> the row). A range query like <code>WHERE created_at BETWEEN a AND b</code> descends once to the first match, then walks the linked leaves in order — no re-descent per row.</p>
<pre>// Query backed by idx_ledger_wallet_created — one O(log n) descent
@Repository
public interface LedgerEntryRepository extends JpaRepository&lt;LedgerEntry, Long&gt; {

    List&lt;LedgerEntry&gt; findByWalletIdOrderByCreatedAtDesc(
        String walletId, Pageable pageable);

    // Uses composite index (wallet_id, created_at) for equality + sort
    @Query("""
        SELECT e FROM LedgerEntry e
        WHERE e.walletId = :walletId
        ORDER BY e.createdAt DESC
        """)
    List&lt;LedgerEntry&gt; recentEntries(
        @Param("walletId") String walletId,
        Pageable pageable);
}</pre>` },
    { title: `Composite and covering indexes`, body: `<p>A <b>composite index</b> on <code>(a, b, c)</code> is sorted by <code>a</code>, then <code>b</code>, then <code>c</code>. This is the <b>leftmost-prefix rule</b>: it supports predicates on <code>a</code>, on <code>(a, b)</code>, and on <code>(a, b, c)</code>, but not on <code>b</code> alone. Column order matters — put equality columns first and the range/sort column last.</p>
<p>A <b>covering index</b> includes every column a query needs, so the query is answered <em>from the index alone</em> without touching the table (an "index-only scan"). In Postgres you add non-key payload columns with <code>INCLUDE</code>:</p>
<p><code>CREATE INDEX idx_entry_wallet_created ON ledger_entry (wallet_id, created_at) INCLUDE (amount);</code></p>
<p>Now "recent entries and amounts for a wallet" needs no heap fetch at all.</p>
<pre>@Entity
@Table(name = "payments",
       indexes = {
           // Composite: equality on wallet_id, range/sort on created_at
           @Index(name = "idx_payment_wallet_status_created",
                  columnList = "wallet_id, status, created_at"),
           // Covering: all columns needed for balance summary query
           @Index(name = "idx_payment_wallet_amount",
                  columnList = "wallet_id, amount_minor, status")
       })
public class Payment {

    @Id
    private String id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}</pre>` },
    { title: `Partial indexes`, body: `<p>A <b>partial index</b> indexes only the rows matching a predicate, keeping it small and cheap to maintain:</p>
<p><code>CREATE INDEX idx_orders_pending ON "order" (created_at) WHERE status = 'PENDING';</code></p>
<p>If pending orders are 1% of the table, this index is 1% of the size and is the perfect fit for the "work queue" query that only ever looks at pending rows. Partial indexes also enforce conditional uniqueness — <code>CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL</code> keeps emails unique among live rows while allowing soft-deleted duplicates.</p>
<pre>// Partial index via DDL migration (JPA @Index does not support WHERE clause)
// CREATE INDEX idx_payment_pending
//   ON payments (created_at) WHERE status = 'PENDING';

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}

@Repository
public interface PaymentRepository extends JpaRepository&lt;Payment, String&gt; {

    // Benefits from idx_payment_pending — small, fast work-queue scan
    @Query("""
        SELECT p FROM Payment p
        WHERE p.status = 'PENDING'
        ORDER BY p.createdAt ASC
        """)
    List&lt;Payment&gt; findPendingPayments(Pageable pageable);
}</pre>` },
    { title: `Pagination: offset vs cursor`, body: `<p>Indexing interacts directly with how you page. <b>OFFSET pagination</b> (<code>LIMIT 20 OFFSET 10000</code>) forces the engine to walk and discard the first 10,000 matches on every page — cost grows with page depth, and rows inserted mid-scroll cause skipped or repeated items. <b>Cursor (keyset) pagination</b> instead remembers the last row's sort key and asks for the next slice:</p>
<p><code>SELECT * FROM ledger_entry WHERE wallet_id = :w AND (created_at, id) &lt; (:last_ts, :last_id) ORDER BY created_at DESC, id DESC LIMIT 20;</code></p>
<p>Backed by an index on <code>(wallet_id, created_at, id)</code>, every page is an <code>O(log n)</code> seek plus a short scan, and it is stable under concurrent inserts. Use keyset pagination for deep or infinite scroll; reserve OFFSET for small, bounded result sets.</p>
<pre>@Entity
@Table(name = "ledger_entries",
       indexes = @Index(name = "idx_ledger_wallet_created_id",
                        columnList = "wallet_id, created_at, id"))
public class LedgerEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}

@Repository
public interface LedgerEntryRepository extends JpaRepository&lt;LedgerEntry, Long&gt; {

    // Keyset pagination — indexed seek, stable under concurrent inserts
    @Query("""
        SELECT e FROM LedgerEntry e
        WHERE e.walletId = :walletId
          AND (:cursorTs IS NULL
               OR e.createdAt &lt; :cursorTs
               OR (e.createdAt = :cursorTs AND e.id &lt; :cursorId))
        ORDER BY e.createdAt DESC, e.id DESC
        LIMIT :limit
        """)
    List&lt;LedgerEntry&gt; findKeysetPage(
        @Param("walletId") String walletId,
        @Param("cursorTs") Instant cursorTs,
        @Param("cursorId") Long cursorId,
        @Param("limit") int limit);
}</pre>` },
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
