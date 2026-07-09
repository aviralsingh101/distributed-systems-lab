// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "normal-forms-bcnf",
  title: "1NF–3NF / BCNF",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `A ladder of guarantees about functional dependencies that removes update, insert, and delete anomalies from a relational schema.`,
  sections: [
    { title: `Why normalize`, body: `<p><b>Normalization</b> is the process of structuring tables so each fact is stored once. When a fact is duplicated, you get <b>anomalies</b>: an <em>update anomaly</em> (change a customer's tier in one row, forget another, now the data disagrees), an <em>insertion anomaly</em> (you cannot record a product's category until an order for it exists), and a <em>deletion anomaly</em> (deleting the last order for a product also erases the product).</p>
<p>The normal forms are defined in terms of <b>functional dependencies</b>. A functional dependency <code>X -> Y</code> means: whenever two rows agree on the attributes in X, they must agree on Y. "X determines Y." Normalization works by ensuring every non-trivial dependency is a dependency <em>on a key</em>, not on some other column.</p>
<pre>// ANOMALY: payment stores wallet_owner_email — update anomaly risk
// If owner changes email, must update payments AND wallets

// NORMALIZED: email lives only on Wallet
@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "owner_email", unique = true)
    private String ownerEmail;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;
}</pre>` },
    { title: `First normal form (1NF)`, body: `<p><b>1NF</b> requires that every column holds a single atomic value and every row is unique. No repeating groups, no arrays stuffed into one cell, no <code>phone1, phone2, phone3</code> columns. A customer with three phone numbers becomes three rows in a <code>customer_phone</code> child table, keyed by <code>(customer_id, phone)</code>. 1NF is the precondition that makes the higher forms even expressible.</p>
<pre>// VIOLATION: multiple phone numbers in one row
// wallet: id | phone1 | phone2 | phone3

// 1NF: child table — one phone per row
@Entity
@Table(name = "wallet_contact_methods")
public class WalletContactMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private ContactType type;  // EMAIL, PHONE

    @Column(name = "value", nullable = false)
    private String value;
}</pre>` },
    { title: `Second and third normal form`, body: `<p><b>2NF</b> applies when the primary key is <b>composite</b>. It forbids a <b>partial dependency</b>: a non-key attribute must depend on the <em>whole</em> key, not part of it. In <code>order_item(order_id, product_id, qty, product_name)</code>, <code>product_name</code> depends only on <code>product_id</code> — half the key — so it violates 2NF. Move <code>product_name</code> to the <code>product</code> table.</p>
<p><b>3NF</b> forbids a <b>transitive dependency</b>: a non-key attribute must not depend on another non-key attribute. If <code>order(id, customer_id, customer_tier)</code> stores <code>customer_tier</code>, then <code>id -> customer_id -> customer_tier</code> — <code>customer_tier</code> depends on the key only through <code>customer_id</code>. The fix is to keep <code>customer_tier</code> on the <code>customer</code> table. The informal summary of 3NF: every non-key attribute depends on <em>the key, the whole key, and nothing but the key</em>.</p>
<pre>// 3NF: payment references wallet; wallet holds owner tier — no transitive dep
@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "owner_email")
    private String ownerEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "tier", nullable = false)
    private WalletTier tier;  // tier lives HERE, not on Payment

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;
}

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private String id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;  // join to get tier — no duplication

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;
}</pre>` },
    { title: `Boyce–Codd normal form (BCNF)`, body: `<p><b>BCNF</b> is a stricter version of 3NF. The rule: for every non-trivial functional dependency <code>X -> Y</code>, <code>X</code> must be a <b>superkey</b> (a set of columns that uniquely identifies a row). 3NF allows a narrow exception when <code>Y</code> is itself part of a candidate key; BCNF removes that exception.</p>
<p>The classic case is a table with <b>overlapping candidate keys</b>. Suppose in a scheduling table an instructor teaches exactly one subject, and each <code>(student, subject)</code> maps to one instructor: dependencies are <code>(student, subject) -> instructor</code> and <code>instructor -> subject</code>. The table is 3NF, but <code>instructor</code> is not a superkey, so it is not BCNF. Decompose into <code>teaches(instructor, subject)</code> and <code>enrolled(student, instructor)</code> so every determinant is a key.</p>
<pre>// BCNF decomposition: merchant fee depends on merchant_id alone
@Entity
@Table(name = "merchants")
public class Merchant {

    @Id
    private String id;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "fee_bps", nullable = false)
    private int feeBps;  // determined by merchant_id (the key) — BCNF OK
}

// Separate table if fee_schedule has overlapping candidate keys
@Entity
@Table(name = "merchant_fee_schedules")
public class MerchantFeeSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "merchant_id", nullable = false)
    private String merchantId;

    @Column(name = "fee_bps", nullable = false)
    private int feeBps;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;
}</pre>` },
    { title: `How far to normalize in practice`, body: `<p>Normalize to <b>3NF/BCNF by default</b> for transactional (OLTP) schemas like a payment ledger — correctness of money depends on there being one authoritative copy of each fact. The cost is that reads may need joins.</p>
<p>BCNF decomposition is not always free: it can be <b>non-dependency-preserving</b>, meaning some functional dependency can no longer be enforced by a single-table constraint and now needs a trigger or application check. When a specific read path is hot and joins hurt, you deliberately step back down with <b>denormalization</b> — but you do that as a conscious, measured trade-off on top of a correct normalized core, not as an accident.</p>
<pre>// Normalized core — 3NF payment schema
@Entity @Table(name = "wallets")
public class Wallet {
    @Id private String id;
    @Column(name = "balance_minor") private long balanceMinor;
    @OneToMany(mappedBy = "wallet") private List&lt;LedgerEntry&gt; entries;
}

@Entity @Table(name = "ledger_entries")
public class LedgerEntry {
    @Id @GeneratedValue private Long id;
    @ManyToOne @JoinColumn(name = "wallet_id") private Wallet wallet;
    @Column(name = "amount_minor") private long amountMinor;
    @ManyToOne @JoinColumn(name = "payment_id") private Payment payment;
}

@Entity @Table(name = "payments")
public class Payment {
    @Id private String id;
    @ManyToOne @JoinColumn(name = "wallet_id") private Wallet wallet;
    @Column(name = "amount_minor") private long amountMinor;
    // Each fact in exactly one place — denormalize only measured hot paths
}</pre>` },
  ],
  related: ["er-modeling", "denormalization-patterns", "primary-foreign-keys"],
});

export const meta = topic.meta;
export const content = topic.content;
