// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const AUDIT_SVG = `<svg viewBox="0 0 620 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Base table changes captured as append-only rows in an audit table">
  <defs><marker id="fig-audit-tables-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="65" width="170" height="70" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="115" y="86" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">wallet (current)</text>
  <text x="42" y="108" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="42" y="124" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">balance = 50</text>
  <rect x="380" y="30" width="220" height="130" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="490" y="51" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">wallet_audit (append-only)</text>
  <text x="392" y="73" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">INSERT id=7 bal 0  by system</text>
  <text x="392" y="91" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">UPDATE id=7 0→80 by ord-9</text>
  <text x="392" y="109" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">UPDATE id=7 80→50 by ord-9</text>
  <text x="392" y="127" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">each row: who / when / diff</text>
  <line x1="200" y1="95" x2="378" y2="95" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-audit-tables-arr)"/>
  <text x="289" y="86" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">every write logged</text>
  <text x="310" y="180" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Base table holds the present; the audit table is the immutable timeline.</text>
</svg>`;

const topic = makeTopic({
  id: "audit-tables",
  title: "Audit Tables",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `An append-only side table that records who changed which row, when, and from what to what — the schema-level answer to "how did this value get here?"`,
  sections: [
    { title: `What an audit table is for`, body: `<p>An <b>audit (history) table</b> captures a durable, append-only record of every change to a business table. The base table always holds the <em>current</em> state; the audit table holds the <em>timeline</em> of how it got there. This answers the questions that operations, security, and compliance actually ask during an incident: who debited this wallet, when, from what balance to what balance, and under whose authority.</p>
<p>For regulated money movement this is not optional — you must be able to reconstruct the state of an account at any past moment and prove no row was silently rewritten.</p>
<pre>@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;
}

@Entity
@Table(name = "wallet_audit",
       indexes = @Index(name = "idx_wallet_audit_wallet_id",
                        columnList = "wallet_id, changed_at"))
public class WalletAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long auditId;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false)
    private AuditAction action;  // INSERT, UPDATE, DELETE

    @Column(name = "old_balance_minor")
    private Long oldBalanceMinor;

    @Column(name = "new_balance_minor")
    private Long newBalanceMinor;

    @Column(name = "changed_by", nullable = false)
    private String changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Column(name = "correlation_id")
    private String correlationId;
}</pre>` },
    { title: `Structure`, figureAfter: "audit-flow", body: `<p>An audit table mirrors the key columns of the source plus metadata about the change itself:</p>
<p><code>CREATE TABLE wallet_audit (audit_id BIGSERIAL PRIMARY KEY, wallet_id BIGINT NOT NULL, action TEXT NOT NULL, old_balance NUMERIC(18,2), new_balance NUMERIC(18,2), changed_by TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), txn_id TEXT);</code></p>
<p>Key properties: it is <b>append-only</b> (never <code>UPDATE</code> or <code>DELETE</code> an audit row), it records the <b>actor</b> (<code>changed_by</code>) and a <b>correlation id</b> (<code>txn_id</code>/trace id) so a change links back to the request that caused it, and it stores enough of the before/after values to reconstruct history.</p>
<pre>public enum AuditAction { INSERT, UPDATE, DELETE }

@Entity
@Table(name = "ledger_entry_audit")
public class LedgerEntryAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long auditId;

    @Column(name = "ledger_entry_id", nullable = false)
    private Long ledgerEntryId;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "payment_id")
    private String paymentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false)
    private AuditAction action;

    @Column(name = "changed_by", nullable = false)
    private String changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Column(name = "correlation_id")
    private String correlationId;
}</pre>` },
    { title: `How rows get written`, body: `<p>There are three ways to populate it, trading isolation for effort:</p>
<ol>
<li><b>Database triggers</b> — an <code>AFTER INSERT OR UPDATE OR DELETE</code> trigger writes the audit row automatically. Impossible to bypass from application code, but the trigger struggles to know the human actor unless you pass it via a session variable.</li>
<li><b>Application / ORM hooks</b> — a repository or ORM interceptor writes the audit row in the same transaction as the change. Easy access to the authenticated user and request context; must be applied consistently everywhere.</li>
<li><b>Change data capture (CDC)</b> — read the database's write-ahead log (Debezium) and materialize an audit stream out-of-band. Zero write-path cost, but eventually consistent and blind to application-level actor context.</li>
</ol>
<p>Whichever you choose, write the audit row in the <em>same transaction</em> as the business change (or derive it from the same log) so the two can never disagree.</p>
<pre>@Service
public class AuditedWalletService {

    private final WalletRepository walletRepository;
    private final WalletAuditRepository auditRepository;

    @Transactional
    public void debitWallet(String walletId, long amountMinor, String paymentId) {
        Wallet wallet = walletRepository.findById(walletId).orElseThrow();
        long oldBalance = wallet.getBalanceMinor();
        wallet.debit(amountMinor);
        walletRepository.save(wallet);

        // Audit row in SAME transaction — atomic with the debit
        WalletAudit audit = new WalletAudit();
        audit.setWalletId(walletId);
        audit.setAction(AuditAction.UPDATE);
        audit.setOldBalanceMinor(oldBalance);
        audit.setNewBalanceMinor(wallet.getBalanceMinor());
        audit.setChangedBy(SecurityContext.getCurrentUser());
        audit.setChangedAt(Instant.now());
        audit.setCorrelationId(RequestContext.correlationId());
        auditRepository.save(audit);
    }
}</pre>` },
    { title: `Keeping the trail trustworthy`, body: `<p>An audit trail is only useful if it cannot be quietly altered. Restrict write permissions so application roles can <code>INSERT</code> but not <code>UPDATE</code>/<code>DELETE</code> audit rows. Consider append-only guarantees (a trigger that rejects updates) and, for high assurance, hash-chaining each row to the previous one so tampering is detectable. Never let an audit write fail silently — if the audit insert throws, the whole transaction should roll back.</p>
<pre>// JPA @PreUpdate/@PreRemove listener — consistent audit on every path
@Component
public class WalletAuditListener {

    @Autowired
    private WalletAuditRepository auditRepository;

    @PreUpdate
    public void onWalletUpdate(Wallet wallet) {
        // Called before flush — capture old state from persistence context
        WalletAudit audit = new WalletAudit();
        audit.setWalletId(wallet.getId());
        audit.setAction(AuditAction.UPDATE);
        audit.setNewBalanceMinor(wallet.getBalanceMinor());
        audit.setChangedBy(SecurityContext.getCurrentUser());
        audit.setChangedAt(Instant.now());
        audit.setCorrelationId(RequestContext.correlationId());
        auditRepository.save(audit);
    }
}

@Entity
@EntityListeners(WalletAuditListener.class)
@Table(name = "wallets")
public class Wallet { /* ... */ }</pre>` },
    { title: `Trade-offs`, body: `<p>Audit tables grow fast — often larger than the tables they shadow — so partition them by time and archive cold partitions to cheaper storage rather than deleting them. They add write amplification (every business write becomes two). And they are a <em>change log</em>, not a queryable "state as of date T" — reconstructing a point-in-time value means replaying rows. When you need first-class time-travel queries instead of a forensic log, reach for <b>temporal tables</b>; when you only need "is this row deleted," <b>soft delete</b> is lighter.</p>
<pre>// Reconstruct balance at a point in time by replaying audit rows
@Repository
public interface WalletAuditRepository extends JpaRepository&lt;WalletAudit, Long&gt; {

    @Query("""
        SELECT a FROM WalletAudit a
        WHERE a.walletId = :walletId
          AND a.changedAt &lt;= :asOf
        ORDER BY a.changedAt DESC, a.auditId DESC
        LIMIT 1
        """)
    Optional&lt;WalletAudit&gt; findLastChangeBefore(
        @Param("walletId") String walletId,
        @Param("asOf") Instant asOf);
}

public long balanceAsOf(String walletId, Instant asOf) {
    return auditRepository.findLastChangeBefore(walletId, asOf)
        .map(WalletAudit::getNewBalanceMinor)
        .orElse(0L);
}</pre>` },
  ],
  figures: [
    { id: "audit-flow", svg: AUDIT_SVG, caption: "Every write to the base table appends an immutable row to the audit table capturing actor, timestamp, and before/after values." },
  ],
  related: ["soft-delete", "temporal-tables", "scd-type-1-2", "transactional-boundaries"],
});

export const meta = topic.meta;
export const content = topic.content;
