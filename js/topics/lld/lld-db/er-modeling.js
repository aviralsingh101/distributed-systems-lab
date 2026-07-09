// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const ER_SVG = `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Customer, Order, OrderItem entity-relationship diagram">
  <defs><marker id="fig-er-modeling-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="150" height="76" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="95" y="90" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Customer</text>
  <text x="30" y="110" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="30" y="126" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">email UNIQUE</text>
  <rect x="245" y="70" width="150" height="76" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="320" y="90" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Order</text>
  <text x="255" y="110" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="255" y="126" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">FK customer_id</text>
  <rect x="470" y="70" width="150" height="76" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="545" y="90" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">OrderItem</text>
  <text x="480" y="110" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="480" y="126" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">FK order_id</text>
  <line x1="170" y1="108" x2="243" y2="108" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-er-modeling-arr)"/>
  <line x1="395" y1="108" x2="468" y2="108" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-er-modeling-arr)"/>
  <text x="206" y="100" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">1 : N</text>
  <text x="431" y="100" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">1 : N</text>
  <text x="320" y="185" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">One customer places many orders; each order has many line items.</text>
</svg>`;

const topic = makeTopic({
  id: "er-modeling",
  title: "ER Modeling",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `The design language for a relational schema — entities, attributes, and the cardinality of the relationships between them.`,
  sections: [
    { title: `What ER modeling is`, body: `<p><b>Entity-Relationship (ER) modeling</b> is the technique for turning a domain into a relational schema before writing any DDL. You identify the <b>entities</b> (nouns the business cares about — Customer, Order, Wallet, Ledger), the <b>attributes</b> that describe each one, and the <b>relationships</b> that connect them. The output is a conceptual model that maps almost mechanically onto tables, columns, primary keys, and foreign keys.</p>
<p>The goal is a schema where every fact lives in exactly one place and every relationship is enforceable by the database rather than by hope. Get the entities and cardinalities right early: reshaping a relationship after millions of rows exist is a migration, not an edit.</p>
<pre>// Domain records — ER concepts before JPA mapping
public record WalletId(String value) {}
public record PaymentId(String value) {}

public record WalletSummary(
    WalletId id,
    long balanceMinor,
    String currency,
    String ownerEmail
) {}

public record PaymentSummary(
    PaymentId id,
    WalletId walletId,
    long amountMinor,
    String status
) {}</pre>` },
    { title: `Entities, attributes, and keys`, body: `<p>An <b>entity</b> becomes a table; an <b>entity instance</b> becomes a row. Each entity needs a <b>key</b> — an attribute (or set of attributes) that uniquely identifies a row. A <b>candidate key</b> is any minimal unique identifier; the one you choose to reference is the <b>primary key</b>. Attributes that only make sense in combination with the entity (an order's <em>total</em>, a wallet's <em>balance</em>) live as columns on that table.</p>
<p>Prefer a stable surrogate key (an auto-generated <code>BIGINT</code> or <code>UUID</code>) as the primary key, and enforce real-world uniqueness separately with a <code>UNIQUE</code> constraint (for example <code>email</code> on Customer). This keeps foreign keys narrow and lets natural values change without cascading rewrites.</p>
<pre>@Entity
@Table(name = "wallets",
       uniqueConstraints = @UniqueConstraint(name = "uq_wallet_email",
                                             columnNames = "owner_email"))
public class Wallet {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "owner_email")
    private String ownerEmail;
}</pre>` },
    { title: `Relationships and cardinality`, figureAfter: "er-diagram", body: `<p>A relationship connects two entities, and its <b>cardinality</b> says how many instances participate on each side:</p>
<ul>
<li><b>One-to-many (1:N)</b> — the common case. One Customer has many Orders. Implemented by putting a foreign key (<code>customer_id</code>) on the <em>many</em> side (Order).</li>
<li><b>One-to-one (1:1)</b> — a Wallet has exactly one balance snapshot. Implemented as a shared/unique foreign key, or by keeping the columns on one table.</li>
<li><b>Many-to-many (M:N)</b> — Orders and Products. A relational schema cannot store this directly; you introduce a <b>junction (associative) table</b> whose primary key is the pair of foreign keys.</li>
</ul>
<p><b>Optionality (participation)</b> is the other half: is the foreign key <code>NOT NULL</code> (mandatory) or nullable (optional)? An Order that must belong to a Customer uses <code>customer_id BIGINT NOT NULL REFERENCES customer(id)</code>.</p>
<pre>// 1:N — one Wallet has many Payments (FK on the many side)
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private String id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;
}

// 1:N — one Payment has many LedgerEntries
@Entity
@Table(name = "ledger_entries")
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @ManyToOne(optional = false)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;
}</pre>` },
    { title: `How an ER model becomes tables`, body: `<p>Here is how it works — translation is largely mechanical, which is why the modeling step pays off:</p>
<ol>
<li>Each strong entity → one table with its primary key.</li>
<li>Each 1:N relationship → a foreign key column on the many side.</li>
<li>Each M:N relationship → a junction table with two foreign keys and a composite primary key.</li>
<li>Each multi-valued attribute → its own child table (a customer with many addresses is not three <code>address1/2/3</code> columns).</li>
</ol>
<p>A many-to-many junction for order lines looks like:</p>
<p><code>CREATE TABLE order_item (order_id BIGINT REFERENCES "order"(id), product_id BIGINT REFERENCES product(id), qty INT NOT NULL, PRIMARY KEY (order_id, product_id));</code></p>
<pre>// M:N junction — Payment tags (many payments, many tags)
@Entity
@Table(name = "payment_tags")
@IdClass(PaymentTagId.class)
public class PaymentTag {

    @Id
    @ManyToOne
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Id
    @ManyToOne
    @JoinColumn(name = "tag_id")
    private Tag tag;
}

@Entity
@Table(name = "tags")
public class Tag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;
}</pre>` },
    { title: `Common modeling mistakes`, body: `<p><b>Repeating groups</b> (comma-separated lists in a column, or numbered columns) signal a missing child table. <b>Overloaded entities</b> — one <code>account</code> table that is sometimes a customer and sometimes a merchant — usually want either separate tables or a clear type discriminator with disjoint attributes. <b>Missing junction tables</b> force application code to fake M:N with duplicated rows.</p>
<p>Finally, model the relationship <em>direction of ownership</em> deliberately: in a payment system a Ledger entry belongs to exactly one Wallet, so the foreign key and the delete/retention rules live on the Ledger side. Getting ownership right is what makes normalization and referential integrity fall out naturally in the next steps.</p>
<pre>// Ownership direction: LedgerEntry belongs to Wallet — FK on ledger side
@Entity
@Table(name = "ledger_entries")
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Mandatory participation: every entry MUST have a wallet
    @ManyToOne(optional = false)
    @JoinColumn(name = "wallet_id", nullable = false,
                foreignKey = @ForeignKey(
                    name = "fk_ledger_wallet",
                    foreignKeyDefinition =
                        "FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT"))
    private Wallet wallet;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}</pre>` },
  ],
  figures: [
    { id: "er-diagram", svg: ER_SVG, caption: "A 1:N chain: Customer → Order → OrderItem. Foreign keys live on the many side; the crow's-foot 1:N label captures cardinality." },
  ],
  related: ["normal-forms-bcnf", "primary-foreign-keys", "denormalization-patterns"],
});

export const meta = topic.meta;
export const content = topic.content;
