// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "hybrid", title: "Hybrid Locking", category: "opt-pess" };

export const content = {
  oneliner: `Neither optimistic nor pessimistic is best everywhere — choose per operation, or switch adaptively as measured contention rises.`,
  archetype: "tradeoff",
  sections: [
    { title: `Why one strategy is not enough`, body: `<p>Optimistic and pessimistic concurrency solve the same problem — preventing lost updates — with opposite bets. Optimistic wins when conflicts are rare (no locks, high throughput, retries cheap); pessimistic wins when conflicts are common (serialize up front, no retry thrash). Real systems have <b>both</b> regimes at once: most wallets are cold and see one writer, while a handful of hot wallets or a flash-sale SKU see fierce contention. A <b>hybrid</b> strategy applies the right control to each case instead of forcing a single global choice.</p>` },
    { title: `Optimistic vs pessimistic, side by side`, body: `<ul>
<li><b>Locking</b> — optimistic takes none until commit; pessimistic locks the row before the write.</li>
<li><b>Conflict handling</b> — optimistic detects at commit and retries; pessimistic prevents by blocking.</li>
<li><b>Best under</b> — optimistic: low contention, long think time; pessimistic: high contention, short critical section.</li>
<li><b>Failure mode</b> — optimistic: retry livelock on hot rows; pessimistic: blocking, deadlocks, pool exhaustion if a lock is held too long.</li>
<li><b>Cost profile</b> — optimistic wastes work on conflict; pessimistic wastes throughput on serialization.</li>
</ul>` },
    { title: `Ways to combine them`, body: `<p>Several hybrid designs are common:</p>
<ol>
<li><b>Static per-operation choice</b> — pessimistic (<code>SELECT ... FOR UPDATE</code>) for the few known hot paths (balance debit on a shared wallet), optimistic version checks for the many cold ones.</li>
<li><b>Adaptive escalation</b> — start optimistic; if a row's retry/conflict rate crosses a threshold, escalate that row (or key range) to pessimistic locking so hot rows stop thrashing while cold rows stay lock-free.</li>
<li><b>Optimistic-then-lock</b> — try the CAS update once; on the zero-row conflict, re-run under an explicit lock so the retry is guaranteed to make progress instead of colliding again.</li>
<li><b>Bounded optimistic retries → fallback</b> — allow N optimistic attempts, then fall back to a lock or a serialized queue for the remainder.</li>
</ol>
<pre>// Hybrid: optimistic first, escalate to pessimistic on hot wallet
@Service
public class HybridWalletService {
    private final WalletRepository repo;
    private final ConcurrentHashMap&lt;String, AtomicInteger&gt; conflictCounts
        = new ConcurrentHashMap&lt;&gt;();
    private static final int ESCALATION_THRESHOLD = 3;

    public void debit(String walletId, long amountCents) {
        AtomicInteger conflicts = conflictCounts
            .computeIfAbsent(walletId, k -&gt; new AtomicInteger());

        if (conflicts.get() &gt;= ESCALATION_THRESHOLD) {
            debitPessimistic(walletId, amountCents);
        } else {
            try {
                debitOptimistic(walletId, amountCents);
                conflicts.set(0);
            } catch (OptimisticLockException e) {
                if (conflicts.incrementAndGet() &gt;= ESCALATION_THRESHOLD) {
                    debitPessimistic(walletId, amountCents);
                } else {
                    throw e; // caller retries
                }
            }
        }
    }

    @Transactional
    void debitOptimistic(String walletId, long amountCents) {
        Wallet w = repo.findById(walletId).orElseThrow();
        w.setBalanceCents(w.getBalanceCents() - amountCents);
        repo.save(w); // @Version check at flush
    }

    @Transactional
    void debitPessimistic(String walletId, long amountCents) {
        Wallet w = repo.findByIdForUpdate(walletId).orElseThrow();
        w.setBalanceCents(w.getBalanceCents() - amountCents);
    }
}</pre>` },
    { title: `Making it work in practice`, body: `<p>Adaptive schemes need <b>signals</b>: track conflict rate, retry count, and lock-wait time per key or per operation, and drive the switch from those metrics. Keep the fallback deterministic so a request cannot bounce between strategies forever — cap retries, then commit to locking. Route by contention, not by convenience: a debit on a shared merchant float should lock; a user editing their own profile should stay optimistic.</p>
<p>The trade-off of hybrid itself is <b>complexity</b>: two code paths, thresholds to tune, and harder reasoning and testing. Adopt it only once a single strategy demonstrably fails — you have measured either optimistic retry storms on hot rows or pessimistic blocking on cold ones. Otherwise pick the simpler strategy that matches your dominant contention profile and revisit when the data says so.</p>` },
  ],
  related: ["optimistic", "pessimistic", "optimistic-locking-schema", "transactional-boundaries"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("hybrid", stage, panel, stageEl);
}
