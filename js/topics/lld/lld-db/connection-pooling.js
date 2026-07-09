// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "connection-pooling",
  title: "Connection Pooling",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Reuse a bounded set of established database connections instead of opening one per request — the difference between a stable database and an exhausted one.`,
  sections: [
    { title: `Why connections are expensive`, body: `<p>A database connection is not cheap. Opening one costs a TCP handshake, often a TLS negotiation, and authentication; then the server allocates memory and, in Postgres, a dedicated <b>backend process</b> per connection. Doing that per request adds latency to every call and can crush the database under load. Databases also cap total connections (Postgres <code>max_connections</code> is often ~100–500) because each one consumes real memory and CPU for scheduling.</p>
<p>A <b>connection pool</b> is a fixed-size cache of already-open connections. A request <b>borrows</b> one, runs its queries, and <b>returns</b> it to the pool instead of closing it. This is how it works: amortize the setup cost across thousands of requests and bound how many connections ever hit the database at once.</p>
<pre>// Without a pool: new TCP+TLS+auth per request — expensive
// With HikariCP: borrow from pool, use, return

@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    public DataSource primaryDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://db-primary:5432/payments");
        config.setUsername("payment_app");
        config.setPassword(System.getenv("DB_PASSWORD"));
        config.setPoolName("payments-primary");
        return new HikariDataSource(config);
    }
}</pre>` },
    { title: `How the pool behaves`, body: `<p>A pool (HikariCP, pgxpool, node-postgres <code>Pool</code>) is defined mostly by its limits:</p>
<ul>
<li><b>Max pool size</b> — the ceiling on concurrent connections handed out.</li>
<li><b>Connection acquire timeout</b> — how long a caller waits for a free connection before failing fast.</li>
<li><b>Idle timeout / max lifetime</b> — reap connections that are idle or too old (to survive database restarts and load-balancer resets).</li>
</ul>
<p>When all connections are checked out, new callers <b>queue</b> until one is returned or the acquire timeout fires. That queue is the pool doing its job — absorbing bursts — but a persistently full queue is the warning sign of the next section.</p>
<pre>// HikariCP tuning — application.yml equivalent in Java config
@Bean
public DataSource primaryDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl("jdbc:postgresql://db-primary:5432/payments");
    config.setMaximumPoolSize(20);           // max concurrent connections
    config.setMinimumIdle(5);                // warm connections kept ready
    config.setConnectionTimeout(5_000);      // 5s acquire timeout — fail fast
    config.setIdleTimeout(600_000);          // 10 min idle reap
    config.setMaxLifetime(1_800_000);        // 30 min max connection age
    config.setLeakDetectionThreshold(30_000);  // warn if held &gt; 30s
    config.setPoolName("payments-primary");
    return new HikariDataSource(config);
}</pre>` },
    { title: `Pool exhaustion`, body: `<p><b>Exhaustion</b> is the dominant production failure: every connection is checked out, the wait queue grows, acquire timeouts start firing, and latency spikes across the whole service even though the database itself may be idle. Typical causes: a slow query or a slow downstream call holding a connection while blocked; a leak (a borrowed connection never returned because of a missing <code>finally</code>/close); a traffic surge; or a thundering herd after a dependency recovers. The tell is high "connection wait time" with low database CPU — the bottleneck is the pool, not the engine.</p>
<pre>// ANTI-PATTERN: holding a connection across Gateway HTTP call
@Transactional  // borrows connection for entire method duration
public PaymentResponse chargeWithGateway(CreatePaymentRequest req) {
    Wallet wallet = walletRepository.findById(req.walletId()).orElseThrow();
    // Connection held here while waiting for external HTTP — drains pool!
    ChargeResult result = paymentGateway.charge(req);  // 2-5 second round trip
    wallet.debit(req.amountMinor());
    walletRepository.save(wallet);
    return toResponse(result);
}

// CORRECT: external call outside the transaction/connection window
public PaymentResponse chargeCorrectly(CreatePaymentRequest req) {
    ChargeResult result = paymentGateway.charge(req);  // no connection held
    return recordCharge(result);  // short @Transactional — connection held briefly
}</pre>` },
    { title: `Sizing the pool`, body: `<p>Bigger is not better. Total connections across <em>all</em> application instances must stay under the database's <code>max_connections</code> (leaving headroom for admin and replicas). A widely used starting point for CPU-bound workloads is roughly <code>connections = ((core_count * 2) + effective_spindle_count)</code> — often a small pool of 10–20 per instance beats a huge one, because a right-sized pool keeps the database out of context-switch thrash and actually <em>lowers</em> latency. Size the pool to the database's capacity, then scale application instances behind it; do not let 50 pods × 50 connections open 2,500 backends.</p>
<p>Critical rule: keep expensive external calls (a Gateway HTTP request) <em>outside</em> the window where you hold a database connection, or one slow dependency drains the entire pool.</p>
<pre>// Multi-instance sizing: 4 pods × 20 connections = 80 total
// Postgres max_connections = 100 → leave 20 for admin/replicas

@Bean
@ConfigurationProperties(prefix = "spring.datasource.hikari")
public HikariConfig hikariDefaults() {
    HikariConfig config = new HikariConfig();
    config.setMaximumPoolSize(
        Integer.parseInt(System.getenv().getOrDefault("DB_POOL_SIZE", "20")));
    config.setConnectionTestQuery("SELECT 1");
    config.addDataSourceProperty("cachePrepStmts", "true");
    config.addDataSourceProperty("prepStmtCacheSize", "250");
    return config;
}</pre>` },
    { title: `Server-side pooling and transaction mode`, body: `<p>When you have many application instances (or serverless functions that each want their own pool), add a <b>server-side pooler</b> like PgBouncer in front of the database. Its <b>transaction pooling</b> mode assigns a real backend to a client only for the duration of a transaction, so thousands of clients multiplex onto a few dozen backends. The catch: transaction mode breaks features that assume a stable session — session-level prepared statements, <code>SET</code> variables, advisory locks, and <code>LISTEN/NOTIFY</code> — so code must not rely on state living beyond a single transaction. Pair that with an acquire timeout so exhaustion fails fast and observably instead of hanging.</p>
<pre>// Read replica pool — separate HikariCP instance for read routing
@Bean
public DataSource readReplicaDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl("jdbc:postgresql://db-replica:5432/payments");
    config.setMaximumPoolSize(30);   // reads can have a larger pool
    config.setReadOnly(true);
    config.setPoolName("payments-replica");
    return new HikariDataSource(config);
}

// RoutingDataSource picks primary vs replica per @Transactional(readOnly)
@Bean
public DataSource routingDataSource(
        DataSource primaryDataSource,
        DataSource readReplicaDataSource) {
    Map&lt;Object, Object&gt; targets = Map.of(
        "primary", primaryDataSource,
        "replica", readReplicaDataSource
    );
    RoutingDataSource routing = new RoutingDataSource();
    routing.setTargetDataSources(targets);
    routing.setDefaultTargetDataSource(primaryDataSource);
    return routing;
}</pre>` },
  ],
  related: ["read-replica-routing", "transactional-boundaries", "multi-tenant-schema"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("connection-pooling", stage, panel, stageEl);
}
