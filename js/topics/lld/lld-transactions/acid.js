// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "acid", title: "ACID", category: "transactions" };

export const content = {
  oneliner: `The four guarantees a single-node transaction gives you — atomicity, consistency, isolation, durability — and what each one actually means.`,
  archetype: "concept",
  sections: [
    { title: `What ACID promises`, body: `<p><b>ACID</b> is the contract a database transaction offers: a group of reads and writes between <code>BEGIN</code> and <code>COMMIT</code> behaves as one indivisible, reliable unit. The four letters are independent properties, and conflating them is the most common mistake. Below, each is defined precisely with the payment example of debiting a wallet and crediting a ledger in one transaction.</p>
<pre>@Service
public class PaymentTransferService {
    private final WalletRepository walletRepo;
    private final LedgerRepository ledgerRepo;

    public PaymentTransferService(WalletRepository walletRepo, LedgerRepository ledgerRepo) {
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
    }

    @Transactional
    public TransferResult transfer(TransferCommand cmd) {
        Wallet wallet = walletRepo.findByIdForUpdate(cmd.walletId())
            .orElseThrow(() -&gt; new WalletNotFoundException(cmd.walletId()));

        if (wallet.balanceCents() &lt; cmd.amountCents()) {
            throw new InsufficientFundsException(cmd.walletId());
        }

        walletRepo.debit(cmd.walletId(), cmd.amountCents());
        ledgerRepo.recordCredit(cmd.ledgerAccountId(), cmd.amountCents(), cmd.paymentId());

        return new TransferResult(cmd.paymentId(), TransferStatus.COMPLETED);
    }
}</pre>
<p>Spring's <code>@Transactional</code> wraps this method in a single database transaction — all four ACID properties apply to the debit and credit together.</p>` },
    { title: `Atomicity`, body: `<p><b>Atomicity</b> is all-or-nothing: every write in the transaction takes effect, or none does. If the wallet debit succeeds but the ledger credit fails (constraint violation, crash, explicit <code>ROLLBACK</code>), the debit is undone — the system never shows money leaving one account without arriving in the other.</p>
<pre>@Transactional
public TransferResult transfer(TransferCommand cmd) {
    walletRepo.debit(cmd.walletId(), cmd.amountCents());       // write 1
    ledgerRepo.recordCredit(cmd.ledgerAccountId(), ...);       // write 2 — fails here?
    // Spring rolls back BOTH writes automatically
    return new TransferResult(cmd.paymentId(), TransferStatus.COMPLETED);
}

// Explicit rollback on business rule violation
@Transactional
public void capturePayment(CaptureCommand cmd) {
    Payment payment = paymentRepo.findById(cmd.paymentId()).orElseThrow();
    if (payment.status() != PaymentStatus.AUTHORIZED) {
        throw new IllegalStateException("Cannot capture unauthorized payment");
        // exception triggers rollback — no partial state change
    }
    paymentRepo.markCaptured(cmd.paymentId());
    walletRepo.debit(cmd.walletId(), cmd.amountCents());
}</pre>
<p>Here is how a rollback works internally: the engine keeps an <b>undo log</b> (or MVCC versions) recording the pre-image of every change, and on abort it reverses them. Atomicity is about failure handling, not concurrency.</p>` },
    { title: `Consistency`, body: `<p><b>Consistency</b> (the C in ACID, distinct from the C in CAP) means a transaction moves the database from one valid state to another, never violating declared <b>invariants</b> — primary keys, foreign keys, check constraints, unique indexes. If a <code>balance &gt;= 0</code> check would be broken, the transaction is rejected.</p>
<pre>-- Database enforces invariants the application declares
CREATE TABLE wallets (
    wallet_id   VARCHAR(36) PRIMARY KEY,
    balance_cents BIGINT NOT NULL CHECK (balance_cents &gt;= 0)
);

CREATE TABLE ledger_entries (
    entry_id    BIGSERIAL PRIMARY KEY,
    payment_id  VARCHAR(36) NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents &gt; 0),
    entry_type  VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT'))
);</pre>
<pre>// Application-level invariant: debits must equal credits for a payment
@Transactional
public void recordDoubleEntry(String paymentId, long amountCents) {
    ledgerRepo.insert(new LedgerEntry(paymentId, amountCents, EntryType.DEBIT));
    ledgerRepo.insert(new LedgerEntry(paymentId, amountCents, EntryType.CREDIT));
    // if either insert fails, both roll back — double-entry preserved
}</pre>
<p>Crucially, this is a joint responsibility: the database enforces the constraints you declare, but application-level invariants ("debits equal credits") are only preserved if your transaction logic is correct. ACID does not invent correctness — it preserves the rules you define.</p>` },
    { title: `Isolation`, body: `<p><b>Isolation</b> governs concurrency: concurrent transactions must not see each other's uncommitted, intermediate state. The gold standard is <b>serializability</b> — the result of running transactions concurrently equals <em>some</em> serial order of them. Full serializability is expensive, so databases offer weaker <b>isolation levels</b> (read committed, repeatable read, snapshot) that permit specific anomalies in exchange for throughput.</p>
<pre>@Transactional(isolation = Isolation.SERIALIZABLE)
public void chargeWallet(ChargeCommand cmd) {
    // SELECT ... FOR UPDATE inside — prevents lost-update on balance
    Wallet wallet = walletRepo.findByIdForUpdate(cmd.walletId()).orElseThrow();
    if (wallet.balanceCents() &lt; cmd.amountCents()) {
        throw new InsufficientFundsException(cmd.walletId());
    }
    walletRepo.debit(cmd.walletId(), cmd.amountCents());
}</pre>
<p>Two concurrent charges against the same wallet must not both read the old balance and each subtract from it — that lost-update anomaly is exactly what isolation controls.</p>` },
    { title: `Durability`, body: `<p><b>Durability</b> means once <code>COMMIT</code> returns success, the change survives crashes, power loss, and restarts. It is achieved with a <b>write-ahead log (WAL)</b>: the transaction's changes are flushed to durable storage (and <code>fsync</code>'d) <em>before</em> the commit is acknowledged, so recovery can replay them even if the in-memory buffer never reached the main data files.</p>
<pre>@Transactional
public TransferResult transfer(TransferCommand cmd) {
    walletRepo.debit(cmd.walletId(), cmd.amountCents());
    ledgerRepo.recordCredit(cmd.ledgerAccountId(), cmd.amountCents(), cmd.paymentId());
    // method returns only after COMMIT + WAL fsync
    return new TransferResult(cmd.paymentId(), TransferStatus.COMPLETED);
}

// Caller can safely emit event only after commit succeeds
public void processPayment(TransferCommand cmd) {
    TransferResult result = transferService.transfer(cmd);
    outboxRepo.insert(new OutboxEvent("PaymentCompleted", cmd.paymentId()));
    // outbox write is a separate transaction — see transactional-outbox pattern
}</pre>
<p>Durability's guarantee is only as strong as the storage stack — replication and <code>fsync</code> policy determine whether "committed" means "on one disk" or "acknowledged by a quorum."</p>
<p>Together these four make a single database transaction trustworthy. The moment a logical operation spans <em>two</em> databases, no single engine can offer ACID across both — which is why distributed transactions (2PC, saga, TCC) exist.</p>` },
  ],
  related: ["isolation-levels", "two-pc", "saga", "transactional-boundaries"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("acid", stage, panel, stageEl);
}
