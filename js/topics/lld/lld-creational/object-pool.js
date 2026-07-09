// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const POOL_SVG = `<svg viewBox="0 0 520 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Object pool acquire and release">
  <defs><marker id="fig-object-pool-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="120" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="80" y="98" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <rect x="200" y="30" width="180" height="130" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="290" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-weight="600" font-family="system-ui">ConnectionPool</text>
  <rect x="220" y="66" width="60" height="26" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="250" y="83" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">idle</text>
  <rect x="300" y="66" width="60" height="26" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="330" y="83" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">idle</text>
  <rect x="220" y="102" width="60" height="26" rx="4" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.2"/>
  <text x="250" y="119" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">in use</text>
  <rect x="300" y="102" width="60" height="26" rx="4" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.2"/>
  <text x="330" y="119" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">in use</text>
  <text x="290" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">fixed capacity; blocks when empty</text>
  <line x1="140" y1="86" x2="198" y2="80" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-object-pool-arr)"/>
  <text x="170" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">acquire</text>
  <line x1="198" y1="112" x2="140" y2="106" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-object-pool-arr)"/>
  <text x="170" y="128" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">release</text>
</svg>`;

const topic = makeTopic({
  id: "object-pool",
  title: "Object Pool",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Keep a set of expensive-to-create objects ready for reuse, lending them to clients and reclaiming them instead of constructing and destroying on every use.`,
  sections: [
    { title: `The problem it solves`, body: `<p><b>Object Pool</b> is a creational pattern for objects whose creation or destruction is costly and whose number in use at once is bounded — the canonical case is database connections, but it also covers thread pools, large buffers, and expensive client handles to a payment gateway.</p>
<p>Creating a fresh connection per charge request means a TCP handshake, TLS negotiation, and authentication every time, adding latency and load. A pool amortizes that: connections are opened once, reused across many requests, and returned to the pool rather than closed.</p>` },
    { title: `Structure`, figureAfter: "pool-uml", body: `<p>The roles: a <b>Pool</b> manages a collection of reusable objects and tracks which are idle versus in use. It exposes <code>acquire()</code> and <code>release(obj)</code>. A <b>factory</b> hook tells the pool how to create and validate members.</p>
<pre>public interface PooledConnection extends AutoCloseable {
    void executeQuery(String sql);
    void reset();  // clear session state before return to pool
}

public final class GatewayConnectionPool {
    private final BlockingQueue&lt;PooledConnection&gt; idle;
    private final AtomicInteger inUse = new AtomicInteger(0);
    private final int maxSize;
    private final Supplier&lt;PooledConnection&gt; factory;

    public GatewayConnectionPool(int maxSize, Supplier&lt;PooledConnection&gt; factory) {
        this.maxSize = maxSize;
        this.factory = factory;
        this.idle = new ArrayBlockingQueue&lt;&gt;(maxSize);
        // Pre-warm minimum connections
        for (int i = 0; i &lt; maxSize / 2; i++) {
            idle.offer(factory.get());
        }
    }

    public PooledConnection acquire() throws InterruptedException {
        PooledConnection conn = idle.poll(5, TimeUnit.SECONDS);
        if (conn == null &amp;&amp; inUse.get() &lt; maxSize) {
            conn = factory.get();
        }
        if (conn == null) throw new PoolExhaustedException("no connections available");
        inUse.incrementAndGet();
        return conn;
    }

    public void release(PooledConnection conn) {
        conn.reset();
        idle.offer(conn);
        inUse.decrementAndGet();
    }
}</pre>` },
    { title: `Flow and lifecycle`, body: `<p>Step by step: (1) the pool pre-warms a minimum number of objects. (2) a client calls <code>acquire()</code> and receives an idle object, marked in use. (3) it does its work. (4) it calls <code>release()</code> in a <code>finally</code> block so the object returns even on error.</p>
<pre>public class LedgerRepository {
    private final GatewayConnectionPool pool;

    public LedgerRepository(GatewayConnectionPool pool) {
        this.pool = pool;
    }

    public void recordEntry(LedgerEntry entry) throws InterruptedException {
        PooledConnection conn = pool.acquire();
        try {
            conn.executeQuery(
                "INSERT INTO ledger (id, amount) VALUES ('"
                + entry.id() + "', " + entry.amountCents() + ")"
            );
        } finally {
            pool.release(conn);  // ALWAYS release — leaked conn starves the pool
        }
    }
}

// Even cleaner with try-with-resources wrapper
public PooledConnection acquireAutoCloseable() throws InterruptedException {
    PooledConnection conn = acquire();
    return new PooledConnection() {
        @Override public void executeQuery(String sql) { conn.executeQuery(sql); }
        @Override public void reset() { conn.reset(); }
        @Override public void close() { release(conn); }  // AutoCloseable → release
    };
}</pre>
<p>On release the pool resets the object's state (roll back open transactions, clear session variables) so the next borrower gets a clean instance. Idle objects are periodically health-checked and evicted if stale.</p>` },
    { title: `Trade-offs and pitfalls`, body: `<p><b>Benefits:</b> avoids repeated expensive construction, bounds resource usage, and smooths latency. <b>Costs and pitfalls:</b> a <b>leaked</b> object never returned starves the pool and eventually deadlocks callers; <b>stale state</b> not reset between uses causes cross-request bugs and data leaks; sizing is subtle — too small throttles throughput, too large overwhelms the backend.</p>
<p>Pooling only pays off when construction is genuinely expensive; for cheap objects it adds complexity and contention for no gain (KISS). Most teams use a proven library (HikariCP for JDBC) rather than hand-rolling one — but understanding the pattern explains what HikariCP is doing under the hood.</p>` },
  ],
  figures: [
    { id: "pool-uml", svg: POOL_SVG, caption: `Clients acquire idle objects from a fixed-capacity pool and release them back; the pool tracks in-use versus idle and resets state on return.` },
  ],
  related: ["singleton", "prototype", "factory-method", "dependency-injection"],
});

export const meta = topic.meta;
export const content = topic.content;
