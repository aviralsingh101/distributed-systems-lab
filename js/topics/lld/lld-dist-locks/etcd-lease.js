// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "etcd-lease", title: "etcd Lease Locks", category: "dist-lock" };

const LEASE_SVG = `<svg viewBox="0 0 720 175" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="etcd lease with keepalive keeping a lock key alive">
  <defs><marker id="fig-etcd-lease-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="60" width="150" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="105" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Holder</text>
  <text x="105" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">KeepAlive every 3s</text>
  <rect x="300" y="40" width="180" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="390" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">etcd (Raft quorum)</text>
  <text x="390" y="79" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">key → lease (TTL 10s)</text>
  <line x1="180" y1="78" x2="298" y2="66" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-etcd-lease-arr)"/>
  <text x="240" y="58" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">renew</text>
  <rect x="300" y="120" width="180" height="40" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.4"/>
  <text x="390" y="140" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">no KeepAlive → TTL 0</text>
  <text x="390" y="154" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">key auto-deleted → lock freed</text>
  <line x1="390" y1="92" x2="390" y2="118" stroke="#ff6b6b" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-etcd-lease-arr)"/>
  <text x="620" y="72" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Key created with</text>
  <text x="620" y="88" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">CreateRevision = fence</text>
</svg>`;

export const content = {
  oneliner: `A correct distributed lock from etcd: bind a key to a time-to-live lease, keep it alive while you work, and let the key auto-delete the moment you stop — as used by Kubernetes leader election.`,
  archetype: "pattern",
  figures: [
    { id: "etcd-lease-flow", svg: LEASE_SVG, caption: "The holder attaches the lock key to a lease and renews it with periodic KeepAlives; miss the renewals (crash, pause) and the lease expires so etcd deletes the key and frees the lock automatically." },
  ],
  sections: [
    { title: `Leases instead of TTL-per-key`, body: `<p><b>etcd</b> is a strongly-consistent key-value store built on the <b>Raft</b> consensus algorithm: every write is committed by a majority of the cluster and reads are linearizable. Its locking primitive is the <b>lease</b>. You create a lease with a TTL (say 10 seconds), then attach one or more keys to it. As long as the lease is alive the keys exist; when the lease expires, etcd atomically deletes every key bound to it.</p>
<p>This decouples liveness from the key: a holder keeps a <em>single</em> lease alive with periodic <code>KeepAlive</code> heartbeats, and all of its lock keys ride on that lease. Stop heartbeating — because you crashed or paused — and the lease lapses, releasing the lock without any external janitor.</p>` },
    { title: `How the lock works`, figureAfter: "etcd-lease-flow", body: `<p>The canonical recipe (implemented by etcd's own <code>concurrency</code> package):</p>
<ol>
<li><b>Grant a lease</b> with a chosen TTL and start a background KeepAlive that renews it well within the TTL.</li>
<li><b>Create the lock key</b> under a prefix like <code>/lock/wallet-42/</code>, attached to that lease, using a transaction that also records the key's <b>CreateRevision</b> — etcd's global, monotonically increasing revision counter.</li>
<li><b>Determine ownership</b> by the ordering of revisions among keys sharing the prefix: the client whose key has the lowest CreateRevision holds the lock. Others <b>watch the key immediately before theirs</b> and wait — the same predecessor-watch trick as ZooKeeper, avoiding a herd.</li>
<li><b>Release</b> by deleting the key (or revoking the lease), which lets the next revision proceed.</li>
</ol>
<p>Because acquisition is a Raft-committed transaction, all clients agree on the revision order — there is no split view.</p>
<pre>// jetcd: grant lease, attach lock key, keepalive while working
public final class EtcdLeaseLock {
    private final Client etcd;
    private final long ttlSeconds;

    public EtcdLeaseLock(Client etcd, long ttlSeconds) {
        this.etcd = etcd;
        this.ttlSeconds = ttlSeconds;
    }

    public LockGrant tryAcquire(String resource) throws Exception {
        Lease lease = etcd.getLeaseClient();
        long leaseId = lease.grant(ttlSeconds).get().getID();

        // Background renew — stops on crash or long GC pause
        CloseableClient keepAlive = lease.keepAlive(leaseId);

        String key = "/lock/" + resource + "/";
        PutResponse put = etcd.getKVClient()
            .put(ByteSequence.from(key + UUID.randomUUID(), UTF_8),
                 PutOption.newBuilder().withLeaseId(leaseId).build())
            .get();

        long createRevision = put.getHeader().getRevision(); // fencing token
        return new LockGrant(leaseId, key, createRevision, keepAlive);
    }

    public void release(LockGrant grant) {
        etcd.getKVClient().delete(ByteSequence.from(grant.key(), UTF_8));
        etcd.getLeaseClient().revoke(grant.leaseId());
        grant.keepAlive().close();
    }
}

public class ShardLeaderElection {
    private final EtcdLeaseLock lock;

    public void runAsLeader(String shardId, Runnable reconcile) throws Exception {
        LockGrant grant = lock.tryAcquire("shard/" + shardId);
        try {
            reconcile.run(); // e.g. single-writer wallet shard
        } finally {
            lock.release(grant);
        }
    }
}</pre>` },
    { title: `Kubernetes leader election`, body: `<p>This is exactly how <b>Kubernetes</b> components elect a leader. The <code>kube-controller-manager</code> and <code>kube-scheduler</code> run several replicas for availability, but only one may act at a time. Each replica races to write a Lease object (stored in etcd); the winner renews it every few seconds via <code>renewDeadline</code>, and the others watch. If the leader stops renewing — crash, network partition, long pause — the lease expires and a standby acquires it and takes over. The controllers use this to ensure a single active reconciler without a separate lock server.</p>` },
    { title: `Still needs fencing`, body: `<p>A lease lock is far safer than an async-replicated Redis key, but it does <b>not</b> eliminate the two-writers hazard from process pauses. If the leader is frozen by a GC pause longer than the lease TTL, etcd expires the lease and promotes a new leader while the old one is still, from its own perspective, in charge. When it unfreezes it may issue a stale write.</p>
<p>The defense is the same monotonic fence: use the key's <b>CreateRevision</b> (or the lease/leader term) as a fencing token and have the protected resource reject writes carrying an older token than it has already accepted. Kubernetes controllers rely on optimistic concurrency (resource versions on API objects) to make a stale leader's writes fail rather than corrupt state.</p>` },
    { title: `When to choose etcd`, body: `<p>Pick an etcd lease lock when you want strong, correct coordination and you already run etcd (any Kubernetes cluster does) — leader election, single-writer shard ownership, config coordination. The trade-offs versus ZooKeeper are minor and mostly ecosystem-driven; both give linearizable ordering plus automatic release on session/lease loss. As always, use it for correctness only in combination with resource-side fencing or optimistic checks; use a Redis lock when best-effort exclusion is all you need.</p>` },
  ],
  related: ["zookeeper-lock", "fencing-tokens", "lease-expiration", "redis-lock", "redlock", "split-brain"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("etcd-lease", stage, panel, stageEl);
}
