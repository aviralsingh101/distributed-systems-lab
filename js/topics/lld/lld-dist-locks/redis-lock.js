// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "redis-lock", title: "Redis Lock", category: "dist-lock" };

const LOCK_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Single-instance Redis lock acquire and release">
  <defs><marker id="fig-redis-lock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="60" width="150" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="95" y="80" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client A</text>
  <text x="95" y="96" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">token = uuid-A</text>
  <rect x="285" y="30" width="170" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="370" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Redis</text>
  <text x="370" y="66" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lock:wallet = uuid-A (PX 30000)</text>
  <rect x="20" y="118" width="150" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="95" y="135" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client B</text>
  <text x="95" y="150" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">SET NX fails — waits</text>
  <line x1="170" y1="70" x2="283" y2="55" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-redis-lock-arr)"/>
  <text x="230" y="48" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">SET NX PX</text>
  <line x1="170" y1="132" x2="283" y2="66" stroke="#ff6b6b" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-redis-lock-arr)"/>
  <text x="620" y="60" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Release = Lua:</text>
  <text x="620" y="76" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">if GET == uuid-A</text>
  <text x="620" y="92" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">then DEL (compare-and-del)</text>
</svg>`;

export const content = {
  oneliner: `A single-instance mutex built on Redis: SET a key with a unique token NX PX, do the work, and delete only if you still own the token.`,
  archetype: "pattern",
  figures: [
    { id: "redis-lock-flow", svg: LOCK_SVG, caption: "Acquire with SET NX PX so only one client wins; release with a Lua compare-and-delete so a client never frees a lock it no longer owns." },
  ],
  sections: [
    { title: `What a Redis lock is for`, body: `<p>Sometimes two processes must not run the same critical section at once — for example only one worker should settle a given payout, or only one scheduler should fire a nightly job. A <b>Redis lock</b> is a lightweight mutual-exclusion primitive that lives in a shared Redis instance so that processes on different machines can coordinate, which a local mutex cannot do.</p>
<p>The appeal is speed and simplicity: acquiring the lock is a single round trip to an in-memory store. The cost is that Redis is not a consensus system, so the lock is <em>advisory</em> and has real safety limits that this page makes explicit.</p>` },
    { title: `Acquiring: SET key token NX PX`, figureAfter: "redis-lock-flow", body: `<p>The correct acquire is one atomic command: <code>SET lock:wallet-42 &lt;token&gt; NX PX 30000</code>.</p>
<ul>
<li><b>NX</b> means "only set if the key does not exist" — this is what makes acquisition mutually exclusive. Exactly one contender wins; the others get a nil reply and must retry or back off.</li>
<li><b>PX 30000</b> sets a 30-second expiry so a crashed holder does not keep the lock forever. The lock is really a <b>lease</b>: ownership is time-bounded.</li>
<li><b>token</b> is a value <em>unique to this acquisition</em> (a UUID or random nonce). It is the identity of the current owner and is essential for safe release.</li>
</ul>
<p>Never emulate this with <code>SETNX</code> then a separate <code>EXPIRE</code>: if the client crashes between the two commands the key has no TTL and the lock is stuck forever.</p>
<pre>// --- Jedis: single atomic SET NX PX ---
public final class JedisRedisLock {
    private final JedisPool pool;
    private static final long LEASE_MS = 30_000;

    public Optional&lt;String&gt; tryAcquire(String resource) {
        String token = UUID.randomUUID().toString();
        String key = "lock:" + resource;
        try (Jedis jedis = pool.getResource()) {
            SetParams params = SetParams.setParams().nx().px(LEASE_MS);
            String result = jedis.set(key, token, params);
            return "OK".equals(result) ? Optional.of(token) : Optional.empty();
        }
    }
}

// --- Lettuce: same semantics, reactive-friendly ---
public final class LettuceRedisLock {
    private final RedisCommands&lt;String, String&gt; redis;
    private static final long LEASE_MS = 30_000;

    public Optional&lt;String&gt; tryAcquire(String resource) {
        String token = UUID.randomUUID().toString();
        String key = "lock:" + resource;
        Boolean acquired = redis.set(key, token,
            SetArgs.Builder.nx().px(LEASE_MS));
        return Boolean.TRUE.equals(acquired) ? Optional.of(token) : Optional.empty();
    }
}</pre>
<p>Both clients issue one round trip. The token returned to the caller is what you pass to release — never hard-code a constant value.</p>` },
    { title: `Releasing: compare-and-delete`, body: `<p>Releasing is the step most implementations get wrong. A naive <code>DEL lock:wallet-42</code> is unsafe: if your critical section ran longer than the TTL, the lock already <b>expired and was re-acquired by another client</b>, and your <code>DEL</code> would delete <em>their</em> lock. So release must be a conditional delete — delete only if the stored value still equals my token. Because that is a read-then-write, it must run atomically as a Lua script:</p>
<ol>
<li>Read the current value at the key.</li>
<li>If it equals my token, delete it and report success.</li>
<li>If it differs (or is gone), do nothing — I no longer own the lock.</li>
</ol>
<p>This compare-and-delete keeps one client from ever unlocking another's work. To hold the lock longer than the TTL, run a background "watchdog" that periodically extends the expiry with a similar token-checked Lua script.</p>
<pre>// Lua compare-and-del — runs atomically on the Redis server
private static final String RELEASE_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then " +
    "  return redis.call('del', KEYS[1]) " +
    "else return 0 end";

public boolean release(String resource, String token) {
    String key = "lock:" + resource;
    try (Jedis jedis = pool.getResource()) {
        Object result = jedis.eval(RELEASE_SCRIPT,
            List.of(key), List.of(token));
        return Long.valueOf(1).equals(result);
    }
}

// --- Using the lock around a wallet payout ---
public class WalletSettlementService {
    private final JedisRedisLock lock;
    private final LedgerRepository ledger;

    public void settlePayout(String walletId, Money amount) {
        Optional&lt;String&gt; token = lock.tryAcquire(walletId);
        if (token.isEmpty()) {
            throw new LockNotAcquiredException(walletId);
        }
        try {
            ledger.debit(walletId, amount, "payout-settlement");
        } finally {
            lock.release(walletId, token.get()); // safe even if lease expired
        }
    }
}</pre>` },
    { title: `What it does NOT guarantee`, body: `<p>A single-instance Redis lock protects the <em>common</em> case but not the adversarial one. Two independent problems break mutual exclusion even with correct code:</p>
<ul>
<li><b>Process pauses.</b> If the holder stalls — a stop-the-world GC pause, VM migration, or a slow disk — past the TTL, Redis expires the lease and hands the lock to someone else while the first process is still, from its own view, "inside" the critical section. Now two clients believe they hold the lock.</li>
<li><b>Redis failover.</b> The lock lives on one node. If that node fails over to a replica that had not yet received the write (replication is asynchronous), the new primary shows the key as free and grants it again.</li>
</ul>
<p>The fix is not "hold the lock more carefully" — it is a <b>fencing token</b>: have Redis hand out a monotonically increasing number with the lock and make the protected resource reject any write carrying a token lower than the highest it has seen. Redlock attempts to harden the failover case with a multi-node quorum, but as Martin Kleppmann argues it still does not survive pauses without fencing.</p>` },
    { title: `When to use it`, body: `<p>Reach for a Redis lock when the lock is an <b>optimization</b> — reducing duplicate work, throttling a cron to one runner — and a rare double-execution is tolerable because the downstream operation is idempotent. Do not use it as the sole guard on an action that must happen at most once (double-debiting a wallet); back that with idempotency keys or fencing at the resource. For strong lock semantics prefer a lease from a consensus store like <b>etcd</b> or <b>ZooKeeper</b>, still combined with fencing.</p>` },
  ],
  related: ["redlock", "fencing-tokens", "lease-expiration", "etcd-lease", "zookeeper-lock", "idempotency-key"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("redis-lock", stage, panel, stageEl);
}
