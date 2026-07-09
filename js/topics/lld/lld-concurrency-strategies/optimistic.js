// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "optimistic", title: "Optimistic Concurrency", category: "opt-pess" };

export const content = {
  oneliner: `Assume conflicts are rare: don't lock, detect a concurrent change at commit time via a version check, and retry the loser.`,
  archetype: "concept",
  sections: [
    { title: `The core idea`, body: `<p><b>Optimistic concurrency control (OCC)</b> bets that two transactions rarely touch the same row at the same time. So it takes no locks while a transaction reads and thinks; it only <b>validates at commit</b> that the data it read has not changed underneath it. If nobody else wrote the row, the commit succeeds; if someone did, the transaction is rejected and the caller retries with fresh data.</p>
<p>This is how it works in practice: reads proceed freely and conflict detection is deferred to the last moment. The cost of a conflict is a wasted attempt plus a retry — cheap when conflicts are rare, wasteful when they are common.</p>` },
    { title: `How conflict detection works`, body: `<p>The standard mechanism is a <b>version column</b> (or a last-updated timestamp) on the row. The transaction reads the current version, does its work, then issues a <b>compare-and-set</b> update that only applies if the version is unchanged, bumping it atomically:</p>
<p><code>UPDATE wallet SET balance = :new, version = version + 1 WHERE id = :id AND version = :seen_version;</code></p>
<p>The database returns the number of rows changed. <b>One row</b> means you won the race; <b>zero rows</b> means another transaction committed first and moved the version — your write applied to nothing, which is the conflict signal. There are no dirty reads and no blocking; correctness comes entirely from the version predicate.</p>` },
    { title: `The retry loop`, body: `<p>OCC is only safe if the caller handles the zero-row case:</p>
<ol>
<li>Read the entity and its version.</li>
<li>Compute the new state.</li>
<li>Run the CAS update. If one row changed, commit.</li>
<li>If zero rows changed, re-read the fresh row and repeat, bounded by a max attempt count with jittered backoff.</li>
</ol>
<p>ORMs automate the predicate: JPA/Hibernate <code>@Version</code> appends <code>AND version = ?</code> and raises <code>OptimisticLockException</code> when no row matches. Never treat zero rows as success — that is a silent lost update.</p>
<pre>@Entity
@Table(name = "wallets")
public class Wallet {
    @Id private String id;
    private long balanceCents;
    @Version private long version;
}

@Service
public class OptimisticWalletService {
    private final WalletRepository repo;
    private static final int MAX_RETRIES = 5;

    public void debit(String walletId, long amountCents) {
        for (int attempt = 0; attempt &lt; MAX_RETRIES; attempt++) {
            try {
                debitOnce(walletId, amountCents);
                return;
            } catch (OptimisticLockException | OptimisticLockingFailureException e) {
                backoff(attempt);
            }
        }
        throw new ConcurrencyException("wallet " + walletId);
    }

    @Transactional
    void debitOnce(String walletId, long amountCents) {
        Wallet w = repo.findById(walletId).orElseThrow();
        if (w.getBalanceCents() &lt; amountCents) {
            throw new InsufficientFundsException(walletId);
        }
        w.setBalanceCents(w.getBalanceCents() - amountCents);
        repo.save(w); // UPDATE ... WHERE id=? AND version=?
    }
}</pre>` },
    { title: `When to use it`, body: `<p>OCC excels under <b>low to moderate contention</b> and for workloads with a long "think time" you would never want to hold a lock through — a user editing a form, a wizard, distinct wallets each touched by one request. Because readers never block writers and no lock is held across a round trip, throughput is high and there is no deadlock risk.</p>
<p>It degrades under <b>high contention on a hot row</b>: many transactions read the same version, one wins, the rest fail and retry, and the retries themselves collide — throughput collapses into a livelock of wasted work. That is the regime where <b>pessimistic</b> locking (serialize up front) wins. Pair OCC with an idempotency key so a client's retry after a conflict cannot double-apply the effect.</p>` },
  ],
  related: ["pessimistic", "hybrid", "optimistic-locking-schema", "lost-update"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("optimistic", stage, panel, stageEl);
}
