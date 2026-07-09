// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "redlock", title: "Redlock Debate", category: "dist-lock" };

const QUORUM_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Redlock five-node quorum acquire">
  <defs><marker id="fig-redlock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="120" height="44" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="80" y="90" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <text x="80" y="105" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">SET NX on all 5</text>
  <g font-family="system-ui" font-size="10">
    <rect x="300" y="8" width="90" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="345" y="27" text-anchor="middle" fill="#3ddc97">R1 ok</text>
    <rect x="300" y="46" width="90" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="345" y="65" text-anchor="middle" fill="#3ddc97">R2 ok</text>
    <rect x="300" y="84" width="90" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="345" y="103" text-anchor="middle" fill="#3ddc97">R3 ok</text>
    <rect x="300" y="122" width="90" height="30" rx="5" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/><text x="345" y="141" text-anchor="middle" fill="#ff6b6b">R4 down</text>
    <rect x="300" y="160" width="90" height="16" rx="4" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.2"/><text x="345" y="172" text-anchor="middle" fill="#ff6b6b">R5 slow</text>
  </g>
  <line x1="140" y1="88" x2="298" y2="23" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-redlock-arr)"/>
  <line x1="140" y1="90" x2="298" y2="61" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-redlock-arr)"/>
  <line x1="140" y1="92" x2="298" y2="99" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-redlock-arr)"/>
  <line x1="140" y1="96" x2="298" y2="137" stroke="#ff6b6b" stroke-width="1" stroke-dasharray="3 3" marker-end="url(#fig-redlock-arr)"/>
  <text x="560" y="80" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">3 of 5 = majority</text>
  <text x="560" y="98" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">lock granted if quorum</text>
  <text x="560" y="114" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">acquired within TTL</text>
</svg>`;

export const content = {
  oneliner: `Redis's multi-node lock algorithm — acquire on a majority of independent nodes — and the well-known critique that it is still unsafe for correctness without fencing.`,
  archetype: "pattern",
  figures: [
    { id: "redlock-quorum", svg: QUORUM_SVG, caption: "Redlock acquires the same key on N independent masters and considers the lock held only if a majority (here 3 of 5) grant it before the TTL, using the elapsed time to shrink the validity window." },
  ],
  sections: [
    { title: `Why Redlock exists`, body: `<p>A single-instance Redis lock has an obvious weak point: the whole lock lives on one node, and Redis replication is asynchronous. If the primary dies right after granting a lock but before replicating it, the promoted replica shows the key as free and can grant the same lock again — two holders. <b>Redlock</b>, proposed by Redis's author Salvatore Sanfilippo, tries to remove that single point of failure by spreading the lock across several independent Redis masters.</p>` },
    { title: `The algorithm, step by step`, figureAfter: "redlock-quorum", body: `<p>You run <b>N independent</b> Redis masters (typically N = 5), with no replication between them. To acquire:</p>
<ol>
<li>Record the current time, then try to <code>SET key token NX PX</code> on <em>all N</em> nodes sequentially, using a short per-node timeout so a dead node cannot stall you.</li>
<li>Count the successes. The lock is considered acquired only if you got it on a <b>majority</b> (⌊N/2⌋ + 1, i.e. 3 of 5) <em>and</em> the total elapsed time is less than the lock TTL.</li>
<li>The effective validity is the TTL minus the elapsed acquisition time (and minus a clock-drift margin). If that remaining window is positive, you hold the lock; otherwise you failed.</li>
<li>On failure — or on release — send the token-checked delete to <em>all</em> N nodes, including ones you thought failed.</li>
</ol>
<p>A majority requirement means a minority of crashed or partitioned nodes cannot grant the lock to a second client.</p>
<pre>// Redlock attempt across N independent Redis masters
public final class Redlock {
    private final List&lt;JedisPool&gt; nodes;
    private final int quorum;
    private final long leaseMs;
    private final long acquireTimeoutMs;

    public Redlock(List&lt;JedisPool&gt; nodes, long leaseMs) {
        this.nodes = nodes;
        this.quorum = nodes.size() / 2 + 1;
        this.leaseMs = leaseMs;
        this.acquireTimeoutMs = leaseMs / 3;
    }

    public Optional&lt;RedlockHandle&gt; tryAcquire(String resource) {
        String token = UUID.randomUUID().toString();
        String key = "lock:" + resource;
        long start = System.nanoTime();
        int successes = 0;

        for (JedisPool pool : nodes) {
            try (Jedis jedis = pool.getResource()) {
                SetParams p = SetParams.setParams().nx().px(leaseMs);
                if ("OK".equals(jedis.set(key, token, p))) successes++;
            } catch (JedisConnectionException ignored) { /* node down */ }
        }

        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        long validityMs = leaseMs - elapsedMs - 50; // clock drift margin
        if (successes &gt;= quorum &amp;&amp; validityMs &gt; 0) {
            return Optional.of(new RedlockHandle(token, validityMs));
        }
        // Failed — unlock all nodes (including ones we thought failed)
        releaseAll(resource, token);
        return Optional.empty();
    }

    private void releaseAll(String resource, String token) {
        String script = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
        for (JedisPool pool : nodes) {
            try (Jedis jedis = pool.getResource()) {
                jedis.eval(script, List.of("lock:" + resource), List.of(token));
            } catch (JedisConnectionException ignored) {}
        }
    }
}

// Charge retry worker — lock is best-effort, not the correctness guarantee
public class PaymentChargeWorker {
    private final Redlock redlock;
    private final PaymentGateway gateway;

    public ChargeResult chargeWithLock(String orderId, ChargeRequest req) {
        return redlock.tryAcquire("charge:" + orderId)
            .map(h -&gt; {
                try {
                    return gateway.charge(req); // still needs idempotency key
                } finally {
                    redlock.releaseAll("charge:" + orderId, h.token());
                }
            })
            .orElseThrow(() -&gt; new BusyException(orderId));
    }
}</pre>` },
    { title: `Kleppmann's critique`, body: `<p>Martin Kleppmann's widely-cited analysis argues Redlock solves the wrong half of the problem. Its extra machinery hardens against <em>node failures</em>, but a lock's correctness ultimately depends on <b>timing assumptions</b>, and distributed systems violate those routinely:</p>
<ul>
<li><b>Process pauses.</b> A holder can be frozen by a stop-the-world GC pause, page fault, or VM migration for seconds. By the time it wakes, its lease has expired and another client legitimately holds the lock — Redlock's quorum does nothing to prevent the two overlapping.</li>
<li><b>Clock jumps.</b> Redlock's validity calculation relies on each node's monotonic sense of expiry; an administrator NTP step or a bad clock can expire keys early or late, breaking the majority reasoning.</li>
<li><b>Network delays.</b> A packet delayed past the TTL means a client's write lands after its lease is gone.</li>
</ul>
<p>His conclusion: if you use a lock merely for <em>efficiency</em> (avoid duplicate work), a single Redis instance is fine and Redlock is overkill. If you use it for <em>correctness</em> (never two writers), no lock alone is enough — you must add a <b>fencing token</b> checked by the resource.</p>` },
    { title: `Fencing is the real fix`, body: `<p>The durable resolution both sides accept is fencing. The lock service returns a monotonically increasing token with each grant; every write to the protected resource carries its token, and the resource <b>rejects any write whose token is lower than the highest it has already accepted</b>. A paused old holder that wakes up and writes is stopped at the resource, because its token is now stale — regardless of what any lock server believed. Redis does not naturally emit such a monotonic fence, which is a key part of the argument for using a consensus system (ZooKeeper's <code>zxid</code>, etcd's revision) when correctness is on the line.</p>` },
    { title: `What to take away`, body: `<p>Redlock is a reasonable engineering trade-off for mutual exclusion under node failure, and it is genuinely stronger than a lone instance against failover. But treat it as best-effort: it does not make lock-based exclusion <em>safe</em> under the pauses and clock issues that real systems exhibit. For anything that must never double-apply — moving money, mutating a shared file — enforce correctness at the resource with fencing and idempotency, and let the lock be the fast path, not the guarantee.</p>` },
  ],
  related: ["redis-lock", "fencing-tokens", "lease-expiration", "etcd-lease", "zookeeper-lock", "gc-pause"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("redlock", stage, panel, stageEl);
}
