// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const KEY_SVG = `<svg viewBox="0 0 620 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Primary key and foreign key relationship between wallet and ledger_entry">
  <defs><marker id="fig-primary-foreign-keys-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="55" width="180" height="90" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="120" y="76" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">wallet</text>
  <text x="42" y="98" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="42" y="114" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">balance</text>
  <text x="42" y="130" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">currency</text>
  <rect x="400" y="40" width="190" height="120" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="495" y="61" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">ledger_entry</text>
  <text x="412" y="83" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="412" y="99" fill="#ff6b6b" font-size="10" font-family="ui-monospace,monospace">FK wallet_id NOT NULL</text>
  <text x="412" y="115" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">amount</text>
  <text x="412" y="131" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">created_at</text>
  <line x1="210" y1="100" x2="398" y2="100" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-primary-foreign-keys-arr)"/>
  <text x="304" y="90" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">1 wallet : N entries</text>
  <text x="304" y="176" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">FK enforces: no entry may reference a non-existent wallet.</text>
</svg>`;

const topic = makeTopic({
  id: "primary-foreign-keys",
  title: "Primary / Foreign Keys",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Primary keys give each row a stable identity; foreign keys make the database itself enforce that references point at rows that exist.`,
  sections: [
    { title: `Primary keys and identity`, body: `<p>A <b>primary key</b> is the column (or columns) that uniquely identifies each row; the database enforces that it is unique and never null, and builds an index on it. Every table in an OLTP schema should have one — a row without identity cannot be reliably updated, referenced, or deduplicated.</p>
<p>Two families of key: a <b>natural key</b> is a real-world identifier (an ISO currency code, an email); a <b>surrogate key</b> is a system-generated value with no business meaning (an auto-increment <code>BIGINT</code> or a <code>UUID</code>). Prefer surrogates for entity identity because natural values change — people change emails, businesses rename — and a changing primary key ripples into every foreign key that references it.</p>
<pre>@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    @Column(name = "id", length = 36)
    private String id;  // surrogate UUID — stable, no business meaning

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "owner_email")
    private String ownerEmail;  // natural key — enforced via UNIQUE, not PK
}</pre>` },
    { title: `Foreign keys and referential integrity`, figureAfter: "wallet-ledger-fk", body: `<p>A <b>foreign key</b> is a column that must match a primary (or unique) key in another table. It encodes a relationship and, crucially, lets the database <b>enforce referential integrity</b>. Here is how it works: on every insert or update the engine checks that the referenced key exists before allowing the write, and on delete it rejects (or cascades) any change that would orphan children.</p>
<p><code>CREATE TABLE ledger_entry (id BIGSERIAL PRIMARY KEY, wallet_id BIGINT NOT NULL REFERENCES wallet(id), amount NUMERIC(18,2) NOT NULL);</code></p>
<p>Now the database guarantees every ledger entry belongs to a real wallet. Without the constraint, a bug or bad backfill can leave dangling <code>wallet_id</code> values that break every join and every balance calculation, often discovered only during an incident.</p>
<pre>@Entity
@Table(name = "ledger_entries",
       indexes = @Index(name = "idx_ledger_wallet_id", columnList = "wallet_id"))
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FK: every entry must belong to a real wallet
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wallet_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_ledger_wallet"))
    private Wallet wallet;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "payment_id")
    private String paymentId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}</pre>` },
    { title: `Referential actions on delete and update`, body: `<p>A foreign key declares what happens when the referenced row is deleted or its key changes:</p>
<ul>
<li><b>RESTRICT / NO ACTION</b> — refuse the delete while children exist. The safe default for financial data: you should not be able to delete a wallet that still has ledger history.</li>
<li><b>CASCADE</b> — delete (or update) the children too. Convenient for truly owned data (an order and its order_items), dangerous for anything auditable.</li>
<li><b>SET NULL</b> — orphan the children by nulling the FK. Only valid when the column is nullable and a parentless child is meaningful.</li>
</ul>
<pre>@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private String id;

    // RESTRICT: cannot delete wallet while payments reference it
    @ManyToOne(optional = false)
    @JoinColumn(name = "wallet_id", nullable = false,
                foreignKey = @ForeignKey(
                    name = "fk_payment_wallet",
                    foreignKeyDefinition = "FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT"))
    private Wallet wallet;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;
}</pre>` },
    { title: `Composite and natural keys`, body: `<p>A <b>composite key</b> spans multiple columns and is the correct primary key for junction tables: <code>order_item(order_id, product_id)</code>. The pair is the identity; neither column alone is unique. Composite foreign keys reference composite primary keys column-for-column.</p>
<p>Even when you use a surrogate primary key, keep enforcing natural uniqueness with a separate <code>UNIQUE</code> constraint (<code>UNIQUE(email)</code>, or <code>UNIQUE(wallet_id, idempotency_key)</code>). This gives you both a stable identity to reference and a real-world guarantee that duplicates cannot be inserted.</p>
<pre>@Entity
@Table(name = "idempotency_keys",
       uniqueConstraints = @UniqueConstraint(
           name = "uq_wallet_idempotency",
           columnNames = {"wallet_id", "idempotency_key"}))
@IdClass(IdempotencyKeyId.class)
public class IdempotencyKey {

    @Id
    @Column(name = "wallet_id")
    private String walletId;

    @Id
    @Column(name = "idempotency_key")
    private String idempotencyKey;

    @Column(name = "payment_id", nullable = false)
    private String paymentId;
}

// Composite key class for @IdClass
public class IdempotencyKeyId implements Serializable {
    private String walletId;
    private String idempotencyKey;
}</pre>` },
    { title: `Practical notes`, body: `<p>Foreign key columns are not automatically indexed in every database — Postgres indexes the primary key but <em>not</em> the referencing column, so joins and cascading deletes can do sequential scans until you add an index on <code>wallet_id</code>. Foreign keys also add a small write-time check and take a lock on the parent row; under extreme write throughput some systems disable them and enforce integrity in the application, but that trades a hard guarantee for a soft one. For a correctness-critical schema like a ledger, keep them on.</p>
<pre>@Entity
@Table(name = "payments",
       indexes = {
           @Index(name = "idx_payment_wallet_id", columnList = "wallet_id"),
           @Index(name = "idx_payment_created_at", columnList = "created_at")
       },
       uniqueConstraints = @UniqueConstraint(
           name = "uq_payment_idempotency",
           columnNames = "idempotency_key"))
public class Payment {

    @Id
    private String id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;
}</pre>` },
  ],
  figures: [
    { id: "wallet-ledger-fk", svg: KEY_SVG, caption: "wallet.id is a primary key; ledger_entry.wallet_id is a NOT NULL foreign key referencing it, so every entry provably belongs to a real wallet." },
  ],
  related: ["er-modeling", "normal-forms-bcnf", "indexing-strategies"],
});

export const meta = topic.meta;
export const content = topic.content;
