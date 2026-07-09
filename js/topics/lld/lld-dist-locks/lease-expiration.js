// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "lease-expiration", title: "Lease Expiration", category: "dist-lock" };

const TIMELINE_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A GC pause causes lease expiry and two simultaneous writers">
  <defs><marker id="fig-lease-expiration-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <line x1="40" y1="40" x2="690" y2="40" stroke="#93a1bd" stroke-width="1"/>
  <text x="30" y="44" text-anchor="end" fill="#5b9dff" font-size="10" font-family="system-ui">A</text>
  <line x1="40" y1="150" x2="690" y2="150" stroke="#93a1bd" stroke-width="1"/>
  <text x="30" y="154" text-anchor="end" fill="#7c5cff" font-size="10" font-family="system-ui">B</text>
  <rect x="70" y="28" width="130" height="24" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/>
  <text x="135" y="44" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">A holds lease</text>
  <rect x="210" y="20" width="150" height="40" rx="4" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="285" y="36" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">A: GC pause (frozen)</text>
  <text x="285" y="50" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">no heartbeat sent</text>
  <line x1="330" y1="70" x2="330" y2="130" stroke="#ff6b6b" stroke-width="1" stroke-dasharray="4 3"/>
  <text x="330" y="98" text-anchor="middle" fill="#ff6b6b" font-size="8" font-family="system-ui">lease expires</text>
  <rect x="360" y="138" width="150" height="24" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/>
  <text x="435" y="154" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">B acquires lease</text>
  <rect x="440" y="28" width="130" height="24" rx="4" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="505" y="44" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">A resumes, WRITES</text>
  <rect x="520" y="138" width="120" height="24" rx="4" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="580" y="154" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">B also WRITES</text>
  <text x="360" y="185" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">Two writers in the "mutually exclusive" section — corruption</text>
</svg>`;

export const content = {
  oneliner: `The core danger of every lease-based lock: a paused holder wakes after its lease expired and writes at the same time as the new holder — two writers where there should be one.`,
  archetype: "failure",
  figures: [
    { id: "lease-race", svg: TIMELINE_SVG, caption: "A holds the lease, then freezes in a GC pause and stops heartbeating. The lease expires; B legitimately acquires it. A unfreezes still believing it holds the lock and writes — now both A and B write." },
  ],
  sections: [
    { title: `Symptom`, body: `<p>You protect a critical section with a distributed lock that has a timeout — a Redis <code>PX</code> expiry, an etcd lease, a ZooKeeper session. Almost always it works. But occasionally two processes execute the "mutually exclusive" section at the same time: a wallet is <b>double-debited</b>, a file is written by two workers and corrupted, or two schedulers both fire the same job. Logs show two different holders each convinced they owned the lock during overlapping windows. The bug is rare, non-deterministic, and impossible to reproduce on a laptop — the classic signature of a timing race.</p>` },
    { title: `Root cause: a lease is a promise about time`, body: `<p>Every automatic-release lock is a <b>lease</b> — ownership for a bounded duration. That timeout exists so a crashed holder does not keep the lock forever. But it silently assumes the holder can always renew (or finish) before the deadline, and in a distributed system that assumption is false. Between acquiring the lock and writing, a process can be suspended for an arbitrarily long time:</p>
<ul>
<li>A <b>stop-the-world GC pause</b> can freeze a JVM for hundreds of milliseconds to several seconds.</li>
<li>The OS can <b>deschedule</b> the process, or the hypervisor can pause the VM for live migration.</li>
<li>A slow disk or network syscall can block far longer than expected.</li>
</ul>
<p>While frozen, the holder sends no heartbeats, so the lock service concludes it is dead and hands the lease to the next waiter — correctly, from its point of view. When the original holder resumes, <em>it does not know time passed</em>; it proceeds into its critical section and writes. Now there are two live holders. No amount of tuning the TTL removes this: a shorter TTL just makes spurious expiries more common, and a longer one widens the window a truly-dead holder blocks everyone.</p>
<pre>// Timeline: A holds lease, GC pause, B acquires, both debit
public class LeaseExpirationRace {
    private final JedisRedisLock lock;
    private final WalletRepository wallets;

    // Client A — frozen mid-critical-section by stop-the-world GC
    public void clientA_debit(String walletId) {
        Optional&lt;String&gt; token = lock.tryAcquire(walletId);
        // ... GC pause 35s while TTL is 30s — no heartbeat sent ...
        wallets.debit(walletId, Money.of("USD", 50)); // A still believes it owns lock
        lock.release(walletId, token.get());
    }

    // Client B — legitimately acquires after lease expires
    public void clientB_debit(String walletId) {
        String token = lock.tryAcquire(walletId).orElseThrow();
        wallets.debit(walletId, Money.of("USD", 30)); // B also debits
        lock.release(walletId, token);
    }
    // Result: wallet debited twice — lock alone did not prevent it
}</pre>` },
    { title: `Why "check the lock again" does not fix it`, body: `<p>A tempting fix is to re-check ownership right before writing: "am I still the holder?" It fails because of the gap between the check and the write. The holder can pass the check, then get paused before the write lands; by the time the write reaches the storage, the lease is long gone and B is active. This is a <b>time-of-check to time-of-use</b> race — the validation and the action are not atomic across the network, so no client-side check can close it.</p>` },
    { title: `Fix: fencing tokens at the resource`, body: `<p>The only robust remedy moves the enforcement <b>out of the lock client and into the protected resource</b>. The lock service issues a <b>fencing token</b> — a monotonically increasing number — with every grant. The client sends its token with each write. The resource remembers the highest token it has accepted and <b>rejects any write carrying a lower token</b>. When paused holder A wakes with token 33 and writes, the resource has already accepted token 34 from B, so A's write is refused. Two writers can no longer both succeed, because the resource itself breaks the tie using a value that cannot go backwards.</p>
<p>Consensus stores hand you a natural token: ZooKeeper's <code>zxid</code>/sequence number, etcd's key revision or lease term. Redis does not, which is a central point in Kleppmann's critique of Redlock.</p>` },
    { title: `Prevention checklist`, body: `<ul>
<li><b>Use fencing tokens</b> for any lock guarding an operation that must not double-apply — this is the real fix, not a bigger timeout.</li>
<li><b>Make the protected operation idempotent</b> (idempotency keys, conditional writes) so a duplicated attempt is a no-op even if a token slips through.</li>
<li><b>Prefer optimistic concurrency at the store</b> (compare-and-set on a version) as a second line of defense — a stale writer's version check simply fails.</li>
<li><b>Do not rely on a lock alone for correctness.</b> Treat the lock as a fast path that reduces contention; treat fencing plus idempotency as the guarantee.</li>
</ul>` },
  ],
  related: ["fencing-tokens", "redis-lock", "redlock", "etcd-lease", "gc-pause", "idempotency-key"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("lease-expiration", stage, panel, stageEl);
}
