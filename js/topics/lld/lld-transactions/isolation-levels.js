// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "isolation-levels", title: "Isolation Levels", category: "transactions" };

export const content = {
  oneliner: `Weaker isolation trades correctness for throughput — each level is defined by exactly which read anomalies it still permits.`,
  archetype: "concept",
  sections: [
    { title: `Why levels exist`, body: `<p>Perfect isolation (<b>serializability</b>) makes concurrent transactions behave as if run one at a time, but enforcing it costs locking and aborts. The SQL standard therefore defines weaker <b>isolation levels</b>, each specified not by how it is implemented but by which <b>read phenomena (anomalies)</b> it forbids. To choose a level you first have to know the three anomalies precisely.</p>
<pre>import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

// Spring maps isolation levels to JDBC connection settings
@Transactional(isolation = Isolation.READ_COMMITTED)      // default on PostgreSQL
public WalletBalance getBalance(String walletId) { ... }

@Transactional(isolation = Isolation.REPEATABLE_READ)    // snapshot for transaction duration
public List&lt;LedgerEntry&gt; reconcile(String walletId) { ... }

@Transactional(isolation = Isolation.SERIALIZABLE)       // strongest — prevents write skew
public void chargeWallet(ChargeCommand cmd) { ... }</pre>` },
    { title: `The three anomalies`, body: `<ul>
<li><b>Dirty read</b> — T1 reads a row that T2 has written but not yet committed. If T2 later rolls back, T1 acted on data that never officially existed. Example: reading a wallet balance mid-way through another charge that then aborts.</li>
<li><b>Non-repeatable read</b> — T1 reads a row, T2 <em>updates that same row</em> and commits, and T1 reads it again within the same transaction and sees a different value. The single row's value is not stable across the transaction.</li>
<li><b>Phantom read</b> — T1 runs a query over a <em>range</em> (e.g. "all pending charges &gt; $100"), T2 <em>inserts or deletes</em> a row matching that predicate and commits, and T1 re-runs the query and sees a different <em>set</em> of rows. The anomaly is about rows appearing/disappearing, not a single row changing.</li>
</ul>
<pre>// DIRTY READ demo — only possible at READ_UNCOMMITTED (avoid in production)
@Transactional(isolation = Isolation.READ_UNCOMMITTED)
public long readBalanceUnsafe(String walletId) {
    // sees uncommitted debits from another in-flight transaction
    return walletRepo.findBalance(walletId);
}

// Transaction A: debits 5000, then rolls back
@Transactional
public void failedCharge(String walletId) {
    walletRepo.debit(walletId, 5000);
    throw new PaymentDeclinedException();  // rollback — debit never happened
}

// Transaction B at READ_UNCOMMITTED briefly saw balance - 5000 — dirty read</pre>` },
    { title: `The levels and what each prevents`, body: `<p>Each stronger level forbids one more anomaly:</p>
<table>
<tr><td><b>Level</b></td><td><b>Dirty read</b></td><td><b>Non-repeatable</b></td><td><b>Phantom</b></td></tr>
<tr><td>Read Uncommitted</td><td>possible</td><td>possible</td><td>possible</td></tr>
<tr><td>Read Committed</td><td>prevented</td><td>possible</td><td>possible</td></tr>
<tr><td>Repeatable Read</td><td>prevented</td><td>prevented</td><td>possible*</td></tr>
<tr><td>Serializable</td><td>prevented</td><td>prevented</td><td>prevented</td></tr>
</table>
<p>*ANSI permits phantoms at repeatable read; some engines (MySQL InnoDB via next-key locks) prevent them there anyway. Read committed is the common default (PostgreSQL, Oracle, SQL Server).</p>
<pre>// READ COMMITTED — safe for dashboards, prevents dirty reads
@Transactional(isolation = Isolation.READ_COMMITTED, readOnly = true)
public PaymentSummary getPaymentSummary(String paymentId) {
    return paymentRepo.findSummary(paymentId);
}

// REPEATABLE READ — balance stable for entire reconciliation pass
@Transactional(isolation = Isolation.REPEATABLE_READ)
public ReconciliationReport reconcileWallet(String walletId) {
    long openingBalance = walletRepo.findBalance(walletId);
    List&lt;LedgerEntry&gt; entries = ledgerRepo.findByWallet(walletId);
    long closingBalance = walletRepo.findBalance(walletId);
    // openingBalance unchanged even if another txn committed mid-pass
    return new ReconciliationReport(openingBalance, entries, closingBalance);
}</pre>` },
    { title: `How engines implement it`, body: `<p>Two families of mechanism. <b>Lock-based</b> (traditional 2-phase locking) takes shared locks for reads and exclusive locks for writes; longer-held read locks buy stronger levels, and range/gap locks kill phantoms at serializable. <b>MVCC / snapshot isolation</b> (PostgreSQL, InnoDB) works by giving each transaction a consistent <b>snapshot</b> as of its start, so reads never block writes — repeatable-read-like behaviour comes free from the snapshot, and PostgreSQL's <b>Serializable Snapshot Isolation (SSI)</b> adds runtime conflict detection to catch the write-skew anomaly that plain snapshot isolation misses.</p>
<pre>// Explicit row lock at READ COMMITTED — alternative to SERIALIZABLE
@Transactional(isolation = Isolation.READ_COMMITTED)
public void chargeWithRowLock(ChargeCommand cmd) {
    Wallet wallet = walletRepo.findByIdForUpdate(cmd.walletId()).orElseThrow();
    // SELECT ... FOR UPDATE holds exclusive lock until commit
    if (wallet.balanceCents() &lt; cmd.amountCents()) {
        throw new InsufficientFundsException(cmd.walletId());
    }
    walletRepo.debit(cmd.walletId(), cmd.amountCents());
}</pre>
<p>Note that snapshot isolation is <em>not</em> identical to serializable: it prevents dirty, non-repeatable, and phantom reads but still allows <b>write skew</b> (two transactions each read an overlapping set, then write disjoint rows, jointly breaking an invariant neither saw violated).</p>` },
    { title: `Choosing a level`, body: `<p>Match the level to the invariant's cost of being wrong. Analytics and dashboards tolerate read committed. A <b>money-moving path</b> — checking a wallet balance and then debiting it — needs protection against lost updates and write skew, so use serializable (or explicit <code>SELECT ... FOR UPDATE</code> row locks at read committed) on that transaction, and reserve the expensive level for just those statements.</p>
<pre>@Service
public class PaymentIsolationPolicy {

    @Transactional(isolation = Isolation.READ_COMMITTED, readOnly = true)
    public List&lt;Payment&gt; listRecentPayments(String walletId) {
        return paymentRepo.findRecent(walletId, 50);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public void capturePayment(CaptureCommand cmd) {
        Payment payment = paymentRepo.findByIdForUpdate(cmd.paymentId()).orElseThrow();
        Wallet wallet = walletRepo.findByIdForUpdate(cmd.walletId()).orElseThrow();
        if (wallet.balanceCents() &lt; cmd.amountCents()) {
            throw new InsufficientFundsException(cmd.walletId());
        }
        walletRepo.debit(cmd.walletId(), cmd.amountCents());
        paymentRepo.markCaptured(cmd.paymentId());
    }
}</pre>
<p>Raising the level reduces anomalies but increases lock contention and serialization-failure retries, so measure conflict/abort rates after changing it rather than defaulting everything to serializable.</p>` },
  ],
  related: ["acid", "optimistic", "pessimistic", "transactional-boundaries"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("isolation-levels", stage, panel, stageEl);
}
