// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "denormalization-patterns",
  title: "Denormalization Patterns",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Deliberately storing redundant, precomputed, or duplicated data to make a hot read path fast — and paying for it with write-time consistency work.`,
  sections: [
    { title: `When and why to denormalize`, body: `<p><b>Denormalization</b> is the controlled reintroduction of redundancy on top of a normalized schema. You do it when a specific read is hot and its normalized form is too expensive — many joins, a large aggregate computed on every request, or fan-out across shards. The trade you are making is explicit: <b>faster reads in exchange for slower, more complex writes</b>, because every duplicated fact now has more than one place that must be kept in sync.</p>
<p>The rule of thumb: normalize first, measure, then denormalize the proven bottleneck. Denormalizing before you have a read problem just buys you consistency bugs.</p>
<pre>// Normalized: balance = SUM(ledger_entries.amount_minor) — accurate but slow
// Denormalized: wallet.balance_minor column — fast read, maintained on write

@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;  // DERIVED — maintained from ledger_entries

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Version
    @Column(name = "version", nullable = false)
    private int version;
}</pre>` },
    { title: `Common structures`, body: `<p>The main patterns, each a different way to trade write cost for read cost:</p>
<ul>
<li><b>Precomputed aggregate</b> — store <code>wallet.balance</code> as a column instead of summing the Ledger on every read. The sum is maintained on each ledger write.</li>
<li><b>Duplicated column</b> — copy a rarely-changing attribute onto the child, e.g. <code>order.customer_name</code>, so listing orders needs no join to Customer.</li>
<li><b>Materialized view</b> — let the database maintain a physical, indexable snapshot of a query (<code>CREATE MATERIALIZED VIEW</code>), refreshed on a schedule or on demand.</li>
<li><b>Read model / projection</b> — a separate table (or store) shaped exactly for one screen, populated asynchronously from events (CQRS).</li>
</ul>
<pre>// Duplicated column: payment stores wallet owner name — no join on list
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private String id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "wallet_owner_name")  // copied from wallet at creation time
    private String walletOwnerName;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}</pre>` },
    { title: `Implementation flow for a maintained aggregate`, body: `<p>Take the wallet balance. To keep the denormalized <code>balance</code> correct you fold the maintenance into the same transaction that writes the source of truth:</p>
<ol>
<li>Open a transaction.</li>
<li>Insert the immutable Ledger row (the source of truth).</li>
<li>In the <em>same</em> transaction, update the aggregate: <code>UPDATE wallet SET balance = balance + :amount WHERE id = :wallet_id;</code></li>
<li>Commit. Because both writes share one transaction, the aggregate can never drift from the ledger due to a partial failure.</li>
</ol>
<p>If maintenance cannot be transactional (the copy lives in another store), you rebuild it asynchronously from an event stream or the transactional outbox, accepting bounded staleness instead of drift.</p>
<pre>@Service
public class LedgerWriteService {

    private final WalletRepository walletRepository;
    private final LedgerEntryRepository ledgerRepository;

    @Transactional
    public void recordEntry(String walletId, long amountMinor, String paymentId) {
        // 1. Insert immutable ledger row (source of truth)
        LedgerEntry entry = new LedgerEntry();
        entry.setWalletId(walletId);
        entry.setAmountMinor(amountMinor);
        entry.setPaymentId(paymentId);
        entry.setCreatedAt(Instant.now());
        ledgerRepository.save(entry);

        // 2. Maintain denormalized aggregate in SAME transaction
        Wallet wallet = walletRepository.findById(walletId).orElseThrow();
        wallet.setBalanceMinor(wallet.getBalanceMinor() + amountMinor);
        walletRepository.save(wallet);
        // Both commit atomically — aggregate cannot drift
    }
}</pre>` },
    { title: `Keeping copies consistent`, body: `<p>Every duplicated fact needs an owner and a maintenance strategy. Options, from strongest to weakest: (1) <b>same-transaction update</b> — synchronous, strongly consistent, but couples the write path; (2) <b>database trigger</b> — keeps logic in the DB but is easy to overlook in reviews; (3) <b>asynchronous projection</b> from events — decoupled and scalable but eventually consistent. Pick based on whether a stale copy is merely ugly or actually dangerous (a stale balance that lets a customer overspend is dangerous).</p>
<pre>// Reconciliation job — detect drift between aggregate and source of truth
@Scheduled(cron = "0 4 * * *")
@Service
public class BalanceReconciliationJob {

    private final WalletRepository walletRepository;
    private final LedgerEntryRepository ledgerRepository;

    @Transactional(readOnly = true)
    public void reconcile() {
        List&lt;Wallet&gt; wallets = walletRepository.findAll();
        for (Wallet wallet : wallets) {
            long computed = ledgerRepository
                .sumAmountByWalletId(wallet.getId());
            if (computed != wallet.getBalanceMinor()) {
                log.error("balance drift wallet={} stored={} computed={}",
                    wallet.getId(), wallet.getBalanceMinor(), computed);
                alertOps(wallet.getId(), wallet.getBalanceMinor(), computed);
            }
        }
    }
}</pre>` },
    { title: `Costs and safeguards`, body: `<p>Denormalized data can and will drift — from bugs, backfills, or races. Build a <b>reconciliation job</b> that periodically recomputes the truth (sum the Ledger) and compares it against the stored aggregate, alerting on mismatch. Keep the normalized source of truth authoritative so you can always rebuild the copies. And document which columns are derived, so a future engineer does not "fix" a balance by writing to it directly. Denormalize the few paths that need it; leave the rest normalized.</p>
<pre>@Repository
public interface LedgerEntryRepository extends JpaRepository&lt;LedgerEntry, Long&gt; {

    @Query("SELECT COALESCE(SUM(e.amountMinor), 0) FROM LedgerEntry e WHERE e.walletId = :walletId")
    long sumAmountByWalletId(@Param("walletId") String walletId);
}

// Rebuild denormalized balance from authoritative ledger
@Transactional
public void rebuildBalance(String walletId) {
    long computed = ledgerRepository.sumAmountByWalletId(walletId);
    Wallet wallet = walletRepository.findById(walletId).orElseThrow();
    wallet.setBalanceMinor(computed);
    walletRepository.save(wallet);
    log.info("rebuilt balance wallet={} balance={}", walletId, computed);
}</pre>` },
  ],
  related: ["normal-forms-bcnf", "read-replica-routing", "indexing-strategies", "audit-tables"],
});

export const meta = topic.meta;
export const content = topic.content;
