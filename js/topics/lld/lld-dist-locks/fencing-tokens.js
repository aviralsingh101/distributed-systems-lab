// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "fencing-tokens", title: "Fencing Tokens", category: "dist-lock" };

const FENCE_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fencing token rejected at the storage resource">
  <defs><marker id="fig-fencing-tokens-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="30" width="150" height="42" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="95" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client A (paused)</text>
  <text x="95" y="65" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">token = 33</text>
  <rect x="20" y="128" width="150" height="42" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="95" y="148" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client B (new holder)</text>
  <text x="95" y="163" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">token = 34</text>
  <rect x="470" y="72" width="230" height="56" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.8"/>
  <text x="585" y="94" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Storage / resource</text>
  <text x="585" y="112" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">max token seen = 34</text>
  <line x1="170" y1="55" x2="468" y2="92" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-fencing-tokens-arr)"/>
  <text x="320" y="66" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">write(token=33) → REJECTED (33 &lt; 34)</text>
  <line x1="170" y1="150" x2="468" y2="112" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-fencing-tokens-arr)"/>
  <text x="320" y="150" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">write(token=34) → accepted</text>
  <text x="360" y="190" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">The resource, not the lock, enforces single-writer — using a number that only grows</text>
</svg>`;

export const content = {
  oneliner: `A monotonically increasing number handed out with each lock grant and checked by the protected resource, so a stale lock holder's late write is rejected — the correct fix for the two-writers problem.`,
  archetype: "pattern",
  figures: [
    { id: "fence-flow", svg: FENCE_SVG, caption: "The resource remembers the highest token it has accepted (34). Paused holder A returns with the older token 33 and its write is rejected; only B's current token 34 is accepted." },
  ],
  sections: [
    { title: `The problem fencing solves`, body: `<p>Every lease-based distributed lock has the same hole: a holder can be paused (GC, VM migration, network stall) past its lease, the lock service reassigns the lease, and when the paused process wakes it writes anyway — two writers in a section that was supposed to be exclusive. You cannot close this from the client side, because any "am I still the holder?" check can be followed by a pause before the write lands. <b>Fencing tokens</b> fix it by moving enforcement to the one place that actually applies the effect: the resource being written.</p>` },
    { title: `What a fencing token is`, body: `<p>A fencing token is a <b>monotonically increasing integer</b> that the lock service issues with every successful acquisition. Each grant gets a strictly larger number than the previous one: 33, then 34, then 35, and so on. The number never repeats and never goes backward, so it uniquely orders lock holders in time. Consensus systems produce such a value naturally — ZooKeeper's <code>zxid</code> or sequential znode counter, etcd's key revision, a Raft leader term — which is a major reason to prefer them for correctness-critical locks over a plain Redis key that has no built-in fence.</p>` },
    { title: `How the mechanism works, step by step`, figureAfter: "fence-flow", body: `<ol>
<li><b>Acquire</b> the lock; the service returns a token, e.g. <code>34</code>.</li>
<li><b>Attach the token to every write</b> you send to the protected resource (database, object store, file service).</li>
<li>The <b>resource tracks the highest token it has ever accepted.</b> On each incoming write it compares: if the write's token is greater than or equal to the max, accept it and advance the max; if it is <em>lower</em>, reject it.</li>
<li>A paused old holder returns with token <code>33</code>, but the resource has already accepted <code>34</code> from the new holder, so <code>33 &lt; 34</code> is refused.</li>
</ol>
<p>The critical property: the tie is broken by the resource using a value that <b>cannot decrease</b>. It does not matter what any lock server believed, how long a pause lasted, or whether clocks were wrong — the write with the stale token simply loses.</p>` },
    { title: `Making the resource enforce it`, body: `<p>Fencing only works if the resource actually checks the token; a token nobody validates is decoration. Options depending on what you can control:</p>
<ul>
<li><b>Store the token in the row</b> and use a conditional write: <code>UPDATE ... SET ..., fence = :t WHERE fence &lt;= :t</code>. This folds the fence check into optimistic concurrency.</li>
<li><b>Object stores</b> with conditional puts (ETags / <code>If-Match</code>, or a version precondition) can reject an out-of-order write.</li>
<li>When you cannot modify the resource, put a small <b>guard service</b> in front of it that holds the max token and enforces the comparison.</li>
</ul>
<p>Note the token must be per-<em>resource</em> (or per-key) so independent locks do not interfere, and it must be persisted alongside the data it protects.</p>
<pre>// LedgerService enforces fencing at the resource — the real guarantee
@Entity
@Table(name = "wallets")
public class Wallet {
    @Id private String id;
    private long balanceCents;
    private long maxFenceToken; // highest token ever accepted
}

public class LedgerService {
    private final WalletRepository repo;

    @Transactional
    public void debit(String walletId, Money amount,
                      String paymentId, long fenceToken) {
        Wallet wallet = repo.findByIdForUpdate(walletId)
            .orElseThrow();

        if (fenceToken &lt; wallet.getMaxFenceToken()) {
            // Stale holder A (token 33) rejected after B wrote with 34
            throw new StaleFenceTokenException(fenceToken,
                wallet.getMaxFenceToken());
        }
        if (wallet.getBalanceCents() &lt; amount.cents()) {
            throw new InsufficientFundsException(walletId);
        }
        wallet.setBalanceCents(wallet.getBalanceCents() - amount.cents());
        wallet.setMaxFenceToken(fenceToken);
        repo.save(wallet);
        repo.recordDebit(walletId, paymentId, amount, fenceToken);
    }
}

// Lock client passes the token from ZooKeeper sequence or etcd revision
public class FencedWalletDebitService {
    private final CuratorWalletLock lock;
    private final LedgerService ledger;

    public void debit(String walletId, Money amount, String paymentId) {
        lock.withLock(walletId, Duration.ofSeconds(5), () -&gt; {
            long fence = lock.currentSequence(walletId);
            ledger.debit(walletId, amount, paymentId, fence);
            return null;
        });
    }
}</pre>` },
    { title: `Where it fits`, body: `<p>Fencing is the accepted answer to Kleppmann's critique of lock safety: use the lock (Redis, Redlock, etcd, ZooKeeper) as the fast path to reduce contention, and use the fencing token as the actual correctness guarantee. Pair it with <b>idempotency</b> on the operation so even an accepted-but-duplicated write does no harm. Anywhere a double execution is unacceptable — moving money, mutating shared storage, single-leader control loops — the protected resource should reject stale tokens rather than trust that the lock alone kept the section exclusive.</p>` },
  ],
  related: ["lease-expiration", "redis-lock", "redlock", "etcd-lease", "zookeeper-lock", "optimistic"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("fencing-tokens", stage, panel, stageEl);
}
