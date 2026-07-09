// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "pessimistic", title: "Pessimistic Concurrency", category: "opt-pess" };

export const content = {
  oneliner: `Assume conflicts are likely: lock the row before you touch it with SELECT ... FOR UPDATE, so concurrent writers wait their turn.`,
  archetype: "concept",
  sections: [
    { title: `The core idea`, body: `<p><b>Pessimistic concurrency control</b> assumes contention is common, so it prevents conflicts instead of detecting them. Before a transaction modifies a row, it <b>acquires a lock</b> on that row; any other transaction that wants to write (or lock) it must <b>wait</b> until the first commits or rolls back and releases the lock. Conflicts are serialized away up front rather than caught at commit.</p>
<p>Here is how it works: acquiring the lock creates a critical section around the row, so the read-modify-write sequence runs to completion with no one else interleaving on that row.</p>` },
    { title: `SELECT ... FOR UPDATE`, body: `<p>The workhorse is a locking read inside a transaction. <code>SELECT ... FOR UPDATE</code> reads the row <em>and</em> takes an exclusive row lock held until the transaction ends:</p>
<p><code>BEGIN; SELECT balance FROM wallet WHERE id = :id FOR UPDATE; -- others block here UPDATE wallet SET balance = balance - :amt WHERE id = :id; COMMIT;</code></p>
<p>Between the <code>FOR UPDATE</code> and the <code>COMMIT</code>, any other transaction issuing <code>FOR UPDATE</code> on that wallet blocks. This eliminates the lost update by construction — there is no window in which two transactions both read the same balance and both write. Related modes: <code>FOR SHARE</code> takes a shared lock (many readers, no writer), and <code>FOR UPDATE SKIP LOCKED</code> / <code>NOWAIT</code> control what happens when the row is already locked (skip it, or fail immediately) — the basis of safe SQL work queues.</p>
<pre>@Entity
@Table(name = "wallets")
public class Wallet {
    @Id private String id;
    private long balanceCents;
}

public interface WalletRepository extends JpaRepository&lt;Wallet, String&gt; {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.id = :id")
    Optional&lt;Wallet&gt; findByIdForUpdate(@Param("id") String id);
}

@Service
public class PessimisticWalletService {
    private final WalletRepository repo;

    @Transactional
    public void debit(String walletId, long amountCents, String paymentId) {
        Wallet w = repo.findByIdForUpdate(walletId)
            .orElseThrow(() -&gt; new WalletNotFoundException(walletId));

        if (w.getBalanceCents() &lt; amountCents) {
            throw new InsufficientFundsException(walletId);
        }
        w.setBalanceCents(w.getBalanceCents() - amountCents);
        // lock held until commit — no other writer can interleave
        repo.save(w);
    }

    @Transactional
    public void transfer(String from, String to, long amountCents) {
        // Lock in consistent order to avoid deadlock
        List&lt;String&gt; ids = Stream.of(from, to).sorted().toList();
        Wallet first = repo.findByIdForUpdate(ids.get(0)).orElseThrow();
        Wallet second = repo.findByIdForUpdate(ids.get(1)).orElseThrow();
        first.setBalanceCents(first.getBalanceCents() - amountCents);
        second.setBalanceCents(second.getBalanceCents() + amountCents);
    }
}</pre>` },
    { title: `Blocking, timeouts, and deadlocks`, body: `<p>Locks introduce their own failure modes. A slow lock holder makes everyone behind it wait, so set a <b>lock/statement timeout</b> so waiters fail fast instead of piling up and exhausting the connection pool. The classic hazard is <b>deadlock</b>: transaction A locks row 1 then wants row 2, while B locks row 2 then wants row 1 — each waits forever. Databases detect the cycle and kill one victim with a deadlock error. Prevent it by <b>acquiring locks in a consistent order</b> (always lock wallets by ascending id), keeping transactions short, and locking the minimum set of rows.</p>` },
    { title: `When to use it`, body: `<p>Pessimistic locking is the right default under <b>high contention</b> on the same row — a hot wallet, inventory of a flash-sale item, a shared counter — where optimistic retries would thrash. It gives predictable, first-come-first-served behavior and guarantees the writer sees and mutates current state.</p>
<p>Its costs are reduced concurrency (writers on the same row serialize), the risk of deadlocks, and the danger of holding a lock across slow work. Two hard rules: never hold a row lock across an external network call (a Gateway request) — you will stall every other writer; and always lock the true point of contention, not a broad range, or you serialize unrelated work. When contention is actually low, <b>optimistic</b> concurrency gives more throughput for the same correctness; <b>hybrid</b> strategies switch between the two by measured contention.</p>` },
  ],
  related: ["optimistic", "hybrid", "optimistic-locking-schema", "transactional-boundaries"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("pessimistic", stage, panel, stageEl);
}
