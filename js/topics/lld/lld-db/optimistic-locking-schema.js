// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const CAS_SVG = `<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two transactions racing on a versioned row; the second update fails the version check">
  <defs><marker id="fig-optimistic-locking-schema-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="250" y="15" width="140" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="320" y="37" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="ui-monospace,monospace">wallet v=5</text>
  <rect x="30" y="80" width="230" height="34" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="145" y="102" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">Txn A: read v=5, write WHERE v=5</text>
  <rect x="380" y="80" width="230" height="34" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="495" y="102" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">Txn B: read v=5, write WHERE v=5</text>
  <rect x="30" y="150" width="230" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="145" y="172" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="ui-monospace,monospace">1 row updated → v=6 ✓ commit</text>
  <rect x="380" y="150" width="230" height="34" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="495" y="172" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="ui-monospace,monospace">0 rows updated → conflict, retry</text>
  <line x1="290" y1="49" x2="150" y2="78" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-optimistic-locking-schema-arr)"/>
  <line x1="350" y1="49" x2="490" y2="78" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-optimistic-locking-schema-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "optimistic-locking-schema",
  title: "Optimistic Locking Schema",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A version column plus a compare-and-set UPDATE lets concurrent writers detect a lost update at commit time — no long-held row locks required.`,
  sections: [
    { title: `The problem it prevents`, body: `<p>The classic <b>lost update</b>: two requests read a wallet balance of 100, each computes a new value in application code, and each writes it back. The second write silently overwrites the first, and one debit vanishes. This happens whenever read-modify-write straddles a network round trip and the reads are not serialized.</p>
<p><b>Optimistic locking</b> assumes conflicts are rare and does not lock the row while the user thinks. Instead it detects, at write time, that the row changed underneath you — and forces a retry rather than allowing the overwrite.</p>
<pre>// Without @Version: second write silently overwrites first
// Txn A reads balance=100, Txn B reads balance=100
// Txn A writes balance=80, Txn B writes balance=70
// Result: balance=70 — one debit lost

@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Version
    @Column(name = "version", nullable = false)
    private int version;  // JPA auto-appends WHERE version = ? on UPDATE
}</pre>` },
    { title: `Structure: the version column`, figureAfter: "cas-race", body: `<p>Add a monotonic <b>version</b> column (an integer bumped on every write; a timestamp works too but is weaker under clock skew):</p>
<p><code>ALTER TABLE wallet ADD COLUMN version INT NOT NULL DEFAULT 0;</code></p>
<p>The write becomes a <b>compare-and-set (CAS)</b>: update only if the version is still the one you read, and bump it in the same statement:</p>
<p><code>UPDATE wallet SET balance = :new_balance, version = version + 1 WHERE id = :id AND version = :read_version;</code></p>
<p>The database reports how many rows matched. <b>1 row</b> means you won — nobody changed it since your read. <b>0 rows</b> means someone else committed first (the version moved), so your update is a no-op and you must retry.</p>
<pre>// JPA @Version — Hibernate auto-generates the CAS predicate
@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    public void debit(long amountMinor) {
        if (balanceMinor &lt; amountMinor) {
            throw new InsufficientFundsException(id);
        }
        balanceMinor -= amountMinor;
        // version bumped automatically on save()
    }
}</pre>` },
    { title: `The retry loop`, body: `<p>Optimistic locking is only complete with a caller that reacts to the zero-row result:</p>
<ol>
<li>Read the row and its <code>version</code>.</li>
<li>Compute the new state in application code.</li>
<li>Run the CAS <code>UPDATE ... WHERE id = ? AND version = ?</code>.</li>
<li>If <code>rowsAffected == 1</code>, commit. If <code>0</code>, discard, re-read the fresh row, and repeat — usually with a small bounded number of attempts and jittered backoff.</li>
</ol>
<p>Never treat 0 rows as success. Frameworks package this: JPA/Hibernate <code>@Version</code> auto-appends the predicate and throws <code>OptimisticLockException</code> on a zero-row update.</p>
<pre>@Service
public class WalletDebitService {

    private static final int MAX_RETRIES = 3;
    private final WalletRepository walletRepository;
    private final LedgerEntryRepository ledgerRepository;

    @Transactional
    public void debitWithRetry(String walletId, long amountMinor, String paymentId) {
        for (int attempt = 0; attempt &lt; MAX_RETRIES; attempt++) {
            try {
                Wallet wallet = walletRepository.findById(walletId).orElseThrow();
                wallet.debit(amountMinor);
                walletRepository.save(wallet);
                ledgerRepository.save(new LedgerEntry(walletId, -amountMinor, paymentId));
                return;
            } catch (OptimisticLockException ex) {
                if (attempt == MAX_RETRIES - 1) {
                    throw new WalletConflictException(walletId);
                }
                // jittered backoff before re-read
                Thread.sleep(10 + ThreadLocalRandom.current().nextInt(20));
            }
        }
    }
}</pre>` },
    { title: `Where it shines and where it hurts`, body: `<p>Because no lock is held between read and write, optimistic locking gives high throughput and no risk of one slow client blocking others — ideal under <b>low to moderate contention</b> (distinct wallets, distinct orders). Its weakness is <b>hot rows</b>: if hundreds of requests target the same wallet, the version keeps moving, retries pile up, and you get a livelock of wasted work. There, a serialized approach (pessimistic <code>SELECT ... FOR UPDATE</code>, or funneling updates through a single writer/queue) wins.</p>
<pre>// Hot row: pessimistic lock instead of optimistic retry storm
@Repository
public interface WalletRepository extends JpaRepository&lt;Wallet, String&gt; {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.id = :id")
    Optional&lt;Wallet&gt; findByIdForUpdate(@Param("id") String id);
}

@Service
public class HotWalletDebitService {
    @Transactional
    public void debitHotWallet(String walletId, long amountMinor) {
        Wallet wallet = walletRepository.findByIdForUpdate(walletId).orElseThrow();
        wallet.debit(amountMinor);
        walletRepository.save(wallet);
    }
}</pre>` },
    { title: `Notes and pitfalls`, body: `<p>Bump the version on <em>every</em> meaningful write path, or a change through a forgotten path becomes an invisible lost update. For multi-row aggregates, version the aggregate root so a change to any child invalidates concurrent readers of the whole. Return a clear <code>409 Conflict</code> to clients when retries are exhausted rather than retrying forever. And pair optimistic locking with an <b>idempotency key</b> on the request so an automatic client retry after a conflict does not double-apply the effect.</p>
<pre>@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private String id;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;
}

@ExceptionHandler(WalletConflictException.class)
public ProblemDetail handleConflict(WalletConflictException ex) {
    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
    problem.setProperty("code", "wallet_optimistic_lock_conflict");
    problem.setDetail("Concurrent update on wallet " + ex.getWalletId() + ". Retry with same idempotency key.");
    return problem;
}</pre>` },
  ],
  figures: [
    { id: "cas-race", svg: CAS_SVG, caption: "Both transactions read version 5. The first CAS update bumps it to 6 and wins; the second matches zero rows and must re-read and retry." },
  ],
  related: ["optimistic", "pessimistic", "lost-update", "audit-tables"],
});

export const meta = topic.meta;
export const content = topic.content;
