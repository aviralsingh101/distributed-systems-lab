// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "soft-delete",
  title: "Soft Delete",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Mark a row as deleted with a timestamp instead of removing it, so history, undo, and referential integrity survive the "delete".`,
  sections: [
    { title: `The idea`, body: `<p><b>Soft delete</b> replaces a physical <code>DELETE</code> with an <code>UPDATE</code> that flags the row as gone. The canonical implementation is a nullable <code>deleted_at TIMESTAMPTZ</code>: <code>NULL</code> means live, a non-null timestamp means deleted (and records <em>when</em>). Every normal query then adds <code>WHERE deleted_at IS NULL</code>.</p>
<p>You reach for it when a hard delete would destroy something you still need: audit and compliance history, the ability to undo a mistaken deletion, or referential integrity for rows that other records still point at. In a payment system you essentially never hard-delete a Wallet or Ledger entry — you close or void it, keeping the row for reconciliation and regulators.</p>
<pre>@Entity
@Table(name = "wallets")
@SQLDelete(sql = "UPDATE wallets SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class Wallet {

    @Id
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private String deletedBy;
}</pre>` },
    { title: `Structure`, body: `<p>Add the marker column and a partial index so the hot "live rows" path stays fast:</p>
<p><code>ALTER TABLE customer ADD COLUMN deleted_at TIMESTAMPTZ;</code></p>
<p><code>CREATE INDEX idx_customer_live ON customer (id) WHERE deleted_at IS NULL;</code></p>
<p>Prefer a nullable timestamp over a boolean <code>is_deleted</code>: it answers "is it deleted?" <em>and</em> "when?", and it plays nicely with partial indexes. Optionally add <code>deleted_by</code> for accountability.</p>
<pre>@Entity
@Table(name = "payments",
       indexes = @Index(name = "idx_payment_live",
                        columnList = "wallet_id, created_at"))
@SQLDelete(sql = "UPDATE payments SET deleted_at = NOW(), deleted_by = ?2 WHERE id = ?1")
@Where(clause = "deleted_at IS NULL")
public class Payment {

    @Id
    private String id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private String deletedBy;
}</pre>` },
    { title: `The uniqueness trap`, body: `<p>The most common soft-delete bug is uniqueness. A plain <code>UNIQUE(email)</code> constraint counts deleted rows too, so a user who deletes their account can never re-register with the same email. The fix is a <b>partial unique index</b> that only constrains live rows:</p>
<p><code>CREATE UNIQUE INDEX uniq_customer_email_live ON customer (email) WHERE deleted_at IS NULL;</code></p>
<p>Now the email is unique among active customers, but any number of soft-deleted rows may share it.</p>
<pre>@Entity
@Table(name = "wallets",
       uniqueConstraints = @UniqueConstraint(
           name = "uq_wallet_owner_email_live",
           columnNames = "owner_email"))
// Note: partial unique index must be created via DDL migration:
// CREATE UNIQUE INDEX uq_wallet_owner_email_live
//   ON wallets (owner_email) WHERE deleted_at IS NULL;

@SQLDelete(sql = "UPDATE wallets SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class Wallet {

    @Id
    private String id;

    @Column(name = "owner_email")
    private String ownerEmail;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}</pre>` },
    { title: `The query-discipline problem`, body: `<p>Soft delete's real cost is that <b>every query must remember the filter</b>. One forgotten <code>WHERE deleted_at IS NULL</code> leaks deleted data into a screen, a report, or an aggregate. Because it is a whole-codebase invariant, enforce it in one place rather than by hand:</p>
<ul>
<li>A <b>database view</b> (<code>customer_active</code>) that applications read instead of the base table.</li>
<li>An <b>ORM global scope / default filter</b> (Hibernate <code>@Where</code>, Rails <code>default_scope</code>) applied automatically, with an explicit opt-out for admin tools.</li>
<li>A repository layer that is the only code allowed to touch the base table.</li>
</ul>
<pre>@Service
public class WalletService {

    private final WalletRepository walletRepository;
    private final EntityManager entityManager;

    // Normal path: @Where auto-filters deleted rows
    public Optional&lt;Wallet&gt; findActive(String walletId) {
        return walletRepository.findById(walletId);
    }

    // Admin path: explicitly include deleted wallets
    public Optional&lt;Wallet&gt; findIncludingDeleted(String walletId) {
        return entityManager
            .createQuery("SELECT w FROM Wallet w WHERE w.id = :id", Wallet.class)
            .setParameter("id", walletId)
            .setHint("org.hibernate.filter.enabled", false)
            .getResultStream()
            .findFirst();
    }

    public void softDelete(String walletId, String deletedBy) {
        Wallet wallet = walletRepository.findById(walletId).orElseThrow();
        walletRepository.delete(wallet);  // triggers @SQLDelete UPDATE
    }
}</pre>` },
    { title: `Trade-offs and alternatives`, body: `<p>Soft-deleted rows accumulate forever, bloating tables and indexes and slowing scans; schedule a <b>purge job</b> that hard-deletes rows past their retention window. Cascading is manual — the database will not cascade a soft delete, so deleting a parent must also flag its children (or you accept "orphaned but live" children). Unique constraints, foreign keys, and third-party reporting tools all need to be soft-delete-aware.</p>
<p>When the driver is pure history rather than undo, consider alternatives: an <b>audit table</b> that records deletions separately, or <b>temporal / valid-time tables</b> that version rows. Use soft delete when you need the row to keep existing and be restorable in place; use those patterns when you need a full change log.</p>
<pre>@Scheduled(cron = "0 3 * * *")  // nightly purge of expired soft-deletes
@Service
public class WalletPurgeJob {

    private static final Duration RETENTION = Duration.ofDays(90);
    private final EntityManager entityManager;

    @Transactional
    public void purgeExpiredWallets() {
        Instant cutoff = Instant.now().minus(RETENTION);
        entityManager.createNativeQuery("""
            DELETE FROM wallets
            WHERE deleted_at IS NOT NULL
              AND deleted_at &lt; :cutoff
            """)
            .setParameter("cutoff", cutoff)
            .executeUpdate();
    }
}</pre>` },
  ],
  related: ["audit-tables", "temporal-tables", "primary-foreign-keys", "indexing-strategies"],
});

export const meta = topic.meta;
export const content = topic.content;
