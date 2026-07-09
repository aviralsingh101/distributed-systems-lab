// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "zookeeper-lock", title: "ZooKeeper Locks", category: "dist-lock" };

const ZNODE_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ZooKeeper sequential ephemeral znodes forming a lock queue">
  <defs><marker id="fig-zookeeper-lock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="24" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">/lock  (children ordered by sequence number)</text>
  <rect x="40" y="60" width="150" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.8"/>
  <text x="115" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">lock-0001</text>
  <text x="115" y="99" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">lowest → HOLDS lock</text>
  <rect x="240" y="60" width="150" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="315" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">lock-0002</text>
  <text x="315" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">watches 0001</text>
  <rect x="440" y="60" width="150" height="52" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="515" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">lock-0003</text>
  <text x="515" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">watches 0002</text>
  <line x1="240" y1="130" x2="180" y2="130" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-zookeeper-lock-arr)"/>
  <text x="215" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">watch</text>
  <line x1="440" y1="130" x2="380" y2="130" stroke="#7c5cff" stroke-width="1.4" marker-end="url(#fig-zookeeper-lock-arr)"/>
  <text x="415" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">watch</text>
  <line x1="115" y1="112" x2="315" y2="128" stroke="#93a1bd" stroke-width="0" />
  <text x="360" y="170" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Each waiter watches only its predecessor — no thundering herd when 0001 releases</text>
</svg>`;

export const content = {
  oneliner: `A fair, correct distributed lock built from ZooKeeper's sequential ephemeral znodes: the lowest sequence number holds the lock, and each waiter watches only its predecessor.`,
  archetype: "pattern",
  figures: [
    { id: "zk-queue", svg: ZNODE_SVG, caption: "Contenders create sequential ephemeral children under /lock; the lowest sequence holds the lock and each other watches exactly the node just below it, turning the lock into a fair FIFO queue." },
  ],
  sections: [
    { title: `Why ZooKeeper makes a strong lock`, body: `<p>Unlike Redis, <b>ZooKeeper</b> is a consensus system: writes go through an atomic broadcast protocol (Zab) and are committed by a majority of the ensemble before they are acknowledged. That gives it two properties a lock badly needs — a <b>linearizable</b> view of the key space and <b>ephemeral nodes</b> that vanish automatically when a client's session ends. Together they let you build a lock that is fair, avoids the thundering herd, and releases correctly when a holder crashes.</p>` },
    { title: `Sequential ephemeral znodes`, figureAfter: "zk-queue", body: `<p>Two znode flags do the heavy lifting:</p>
<ul>
<li><b>Ephemeral</b> — the znode is tied to the client's session. If the client disconnects or crashes and its session times out, ZooKeeper deletes the node. This is the built-in liveness guarantee: a dead holder's lock is released without any TTL guesswork.</li>
<li><b>Sequential</b> — when you create a child under a parent, ZooKeeper appends a monotonically increasing counter to the name (<code>lock-0001</code>, <code>lock-0002</code>, …). The counter is assigned atomically by the leader, so it also serves as a natural fencing token.</li>
</ul>
<p>The lock directory is simply a parent znode like <code>/lock/wallet-42</code>, and every contender creates one sequential ephemeral child inside it.</p>` },
    { title: `The lock recipe, step by step`, body: `<ol>
<li><b>Create</b> a sequential ephemeral child under the lock node and remember your assigned name, e.g. <code>lock-0007</code>.</li>
<li><b>List</b> the children and sort by sequence number. If <em>yours is the lowest</em>, you hold the lock — proceed into the critical section.</li>
<li>Otherwise, find the child with the <b>next-lower</b> sequence number and set a <b>watch</b> on <em>only that predecessor</em>. Then wait.</li>
<li>When the predecessor's znode is deleted (it released, or its session died), your watch fires. Re-check step 2; you are now likely the lowest.</li>
<li><b>Release</b> by deleting your own znode, which fires the watch of the node behind you.</li>
</ol>
<p>Watching only the immediate predecessor — not the whole directory — is the key detail: when the holder releases, exactly one waiter wakes, avoiding the "herd" of every waiter re-reading at once.</p>
<pre>// Apache Curator: InterProcessMutex wraps the sequential-ephemeral recipe
public final class CuratorWalletLock {
    private final CuratorFramework client;

    public CuratorWalletLock(CuratorFramework client) {
        this.client = client;
    }

    public &lt;T&gt; T withLock(String walletId, Duration wait, Supplier&lt;T&gt; work) {
        InterProcessMutex mutex = new InterProcessMutex(
            client, "/lock/wallet/" + walletId);
        boolean acquired = false;
        try {
            acquired = mutex.acquire(wait.toMillis(), TimeUnit.MILLISECONDS);
            if (!acquired) throw new LockNotAcquiredException(walletId);
            return work.get();
        } catch (Exception e) {
            throw new LockException(walletId, e);
        } finally {
            if (acquired) {
                try { mutex.release(); } catch (Exception ignored) {}
            }
        }
    }
}

// The sequence number Curator assigns is your fencing token
public class WalletDebitService {
    private final CuratorWalletLock lock;
    private final LedgerService ledger;

    public void debit(String walletId, Money amount, String paymentId) {
        lock.withLock(walletId, Duration.ofSeconds(10), () -&gt; {
            long fence = lock.currentSequence(walletId); // from znode name
            ledger.debit(walletId, amount, paymentId, fence);
            return null;
        });
    }
}</pre>` },
    { title: `Why this is fair and safe`, body: `<p>Because sequence numbers are assigned in order, the lock is granted <b>FIFO</b> — no starvation. Because the znode is ephemeral, a crashed holder is cleaned up by session expiry rather than an arbitrary lease timeout you have to tune. And because ZooKeeper is linearizable, all clients agree on who is lowest; there is no split-view like an async Redis failover.</p>
<p>One subtlety remains: a holder can still be paused (GC) past its session timeout, at which point ZooKeeper expires its session and grants the lock to the next waiter while the paused process believes it holds it. The monotonic sequence number is exactly the <b>fencing token</b> to defend against this — pass it to the protected resource so a stale holder's late write is rejected.</p>` },
    { title: `Costs and when to use`, body: `<p>ZooKeeper locks cost more than a Redis <code>SET</code>: every acquire/release is a quorum write, and you must run and operate a 3- or 5-node ensemble. Session and watch handling is fiddly enough that you should use a battle-tested recipe library (Apache Curator's <code>InterProcessMutex</code>) rather than hand-rolling it. Choose ZooKeeper (or etcd) locks when you need <b>correctness</b> — leader election, single-writer ownership of a shard — and can pair the sequence number with fencing. For pure best-effort deduplication where an occasional double-run is harmless, a Redis lock is cheaper.</p>` },
  ],
  related: ["etcd-lease", "fencing-tokens", "redis-lock", "redlock", "lease-expiration", "split-brain"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("zookeeper-lock", stage, panel, stageEl);
}
