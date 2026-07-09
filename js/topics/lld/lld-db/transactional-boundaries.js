// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const TXB_SVG = `<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A transaction boundary wrapping local writes, with the external gateway call kept outside">
  <rect x="30" y="45" width="330" height="120" rx="8" fill="none" stroke="#3ddc97" stroke-width="1.6" stroke-dasharray="6 4"/>
  <text x="195" y="38" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">BEGIN … COMMIT (one unit of work)</text>
  <rect x="50" y="70" width="130" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="115" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">debit wallet</text>
  <rect x="50" y="115" width="130" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="115" y="135" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">insert ledger</text>
  <rect x="210" y="92" width="130" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.3"/>
  <text x="275" y="112" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">insert outbox</text>
  <rect x="430" y="92" width="170" height="34" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="515" y="107" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">Gateway HTTP call</text>
  <text x="515" y="120" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">OUTSIDE the txn</text>
  <text x="395" y="160" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Local writes commit atomically; slow/uncertain external work stays outside the lock window.</text>
</svg>`;

const topic = makeTopic({
  id: "transactional-boundaries",
  title: "Transactional Boundaries",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Deciding exactly where a transaction begins and commits — the unit of work that must be all-or-nothing, and everything that must stay outside it.`,
  sections: [
    { title: `What a boundary is`, body: `<p>A <b>transactional boundary</b> is the scope enclosed by <code>BEGIN</code> and <code>COMMIT</code>: the set of writes that must succeed or fail together. This is the <b>Unit of Work</b> — a single business operation whose invariants must hold atomically. Getting the boundary right is the difference between a system that is consistent by construction and one that leaks half-applied state: money debited but no ledger entry, an order marked paid with no payment recorded.</p>
<p>The guiding principle: the boundary should wrap <em>exactly</em> the writes that share an invariant, and no more. Too small and you split an atomic operation into corruptible pieces; too large and you hold locks and connections across slow work.</p>
<pre>@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    private String id;

    @Column(name = "balance_minor", nullable = false)
    private long balanceMinor;

    @Version
    @Column(name = "version", nullable = false)
    private int version;
}

@Entity
@Table(name = "ledger_entries")
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "payment_id")
    private String paymentId;
}</pre>` },
    { title: `One boundary per use case`, body: `<p>Put the boundary at the <b>application/use-case layer</b> — one transaction per business operation — not sprinkled inside repositories. If each repository call opened its own transaction, debiting the wallet and inserting the ledger row would be two independent commits, and a crash between them would corrupt the balance. Instead the service method opens one transaction and both writes commit as a unit. Implement the flow so the boundary lives in one place:</p>
<p><code>BEGIN; UPDATE wallet SET balance = balance - :amt WHERE id = :w AND balance &gt;= :amt; INSERT INTO ledger_entry(wallet_id, amount) VALUES (:w, -:amt); COMMIT;</code></p>
<p>The HTTP handler stays thin; the domain service owns the boundary; repositories just run statements inside whatever transaction is active.</p>
<pre>@Service
public class WalletDebitService {

    private final WalletRepository walletRepository;
    private final LedgerEntryRepository ledgerRepository;
    private final OutboxRepository outboxRepository;

    // One @Transactional boundary per business operation
    @Transactional
    public void debitWallet(String walletId, long amountMinor, String paymentId) {
        Wallet wallet = walletRepository.findByIdForUpdate(walletId)
            .orElseThrow(() -&gt; new WalletNotFoundException(walletId));

        if (wallet.getBalanceMinor() &lt; amountMinor) {
            throw new InsufficientFundsException(walletId);
        }

        wallet.setBalanceMinor(wallet.getBalanceMinor() - amountMinor);
        walletRepository.save(wallet);

        ledgerRepository.save(new LedgerEntry(walletId, -amountMinor, paymentId));

        // Outbox row in same transaction — publish intent after commit
        outboxRepository.save(OutboxEvent.walletDebited(walletId, amountMinor));
    }
}</pre>` },
    { title: `Keep external calls outside`, figureAfter: "txn-boundary", body: `<p>The most damaging anti-pattern is holding a transaction open across a slow or unreliable external call — a payment Gateway HTTP request, a queue publish, a third-party API. Locks and a pooled connection are held for the entire round trip, so one slow dependency drains the connection pool and blocks unrelated writers.</p>
<p>Keep I/O outside the boundary. Do validation and any external reads <em>before</em> <code>BEGIN</code>; do the external <em>write</em> after <code>COMMIT</code>, made reliable with the <b>transactional outbox</b>: inside the transaction you insert an outbox row describing the event, and a separate relay publishes it after commit. That way the DB commit and the intent to publish are atomic, but the network call is not inside the lock.</p>
<pre>@Service
public class PaymentCaptureService {

    private final PaymentGateway paymentGateway;
    private final PaymentRepository paymentRepository;
    private final OutboxRelay outboxRelay;

    public PaymentResponse capture(String paymentId) {
        // Phase 1: external call OUTSIDE any DB transaction
        ChargeResult gatewayResult = paymentGateway.capture(paymentId);

        // Phase 2: local writes in one short transaction
        Payment payment = recordCapture(paymentId, gatewayResult);

        // Phase 3: relay publishes outbox events (also outside txn)
        outboxRelay.dispatchPending();
        return toResponse(payment);
    }

    @Transactional
    protected Payment recordCapture(String paymentId, ChargeResult result) {
        Payment payment = paymentRepository.findById(paymentId)
            .orElseThrow(() -&gt; new PaymentNotFoundException(paymentId));
        payment.markCaptured(result.processorRef());
        ledgerRepository.recordCredit(payment.getWalletId(), payment.getAmountMinor());
        outboxRepository.save(OutboxEvent.paymentCaptured(paymentId));
        return paymentRepository.save(payment);
    }
}</pre>` },
    { title: `Boundaries and isolation`, body: `<p>The boundary is also where <b>isolation level</b> applies. Within it, <code>READ COMMITTED</code> (the common default) prevents dirty reads but allows non-repeatable reads; <code>REPEATABLE READ</code> / <code>SERIALIZABLE</code> add stronger guarantees at the cost of more aborts. For a read-modify-write on the same row (a balance check then debit), either widen isolation, take an explicit lock (<code>SELECT ... FOR UPDATE</code>), or use an optimistic version check — the boundary alone does not stop concurrent writers unless the isolation level or an explicit lock does.</p>
<pre>@Repository
public interface WalletRepository extends JpaRepository&lt;Wallet, String&gt; {

    // Pessimistic lock within the @Transactional boundary
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.id = :id")
    Optional&lt;Wallet&gt; findByIdForUpdate(@Param("id") String id);
}

@Service
public class WalletTransferService {

    // Stronger isolation for multi-row transfer
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void transfer(String fromId, String toId, long amountMinor) {
        Wallet from = walletRepository.findByIdForUpdate(fromId).orElseThrow();
        Wallet to = walletRepository.findByIdForUpdate(toId).orElseThrow();
        from.debit(amountMinor);
        to.credit(amountMinor);
        walletRepository.saveAll(List.of(from, to));
    }
}</pre>` },
    { title: `Guidelines`, body: `<p>Keep transactions <b>short</b> — enter with data ready, do the writes, commit, get out — because long transactions hold locks, bloat MVCC versions, and starve the pool. Make the operation <b>idempotent</b> (an idempotency key) so a client retry after an ambiguous commit does not double-apply. Prefer <b>one</b> local transaction over a distributed one: if an operation spans services, model it as a <b>saga</b> of local transactions with compensations rather than a lock held across the network. Match the boundary to the business invariant, and everything else follows.</p>
<pre>// Propagation: nested calls join the outer boundary, don't fork
@Service
public class OrderPlacementService {

    @Transactional
    public Order placeOrder(PlaceOrderCommand cmd) {
        Order order = orderRepository.save(Order.create(cmd));
        walletDebitService.debitWallet(   // joins existing transaction
            cmd.walletId(), order.totalMinor(), order.paymentId());
        return order;
    }
}

// readOnly=true — no writes, can route to replica safely
@Transactional(readOnly = true)
public WalletBalance getBalance(String walletId) {
    return walletRepository.findById(walletId)
        .map(w -&gt; new WalletBalance(w.getId(), w.getBalanceMinor()))
        .orElseThrow(() -&gt; new WalletNotFoundException(walletId));
}</pre>` },
  ],
  figures: [
    { id: "txn-boundary", svg: TXB_SVG, caption: "The unit of work commits wallet, ledger, and outbox writes atomically; the external Gateway call is deliberately outside the transaction." },
  ],
  related: ["connection-pooling", "optimistic-locking-schema", "read-replica-routing", "audit-tables"],
});

export const meta = topic.meta;
export const content = topic.content;
