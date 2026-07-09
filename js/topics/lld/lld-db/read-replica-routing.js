// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "read-replica-routing",
  title: "Read Replica Routing",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Send writes to the primary and scale reads across asynchronous replicas — while defending against the stale reads that replication lag causes.`,
  sections: [
    { title: `Why route reads to replicas`, body: `<p>A single primary database is a write bottleneck and a read bottleneck at once. <b>Read replica routing</b> keeps one <b>primary</b> that accepts all writes and streams its changes to one or more <b>read replicas</b>; the application then directs read-only queries to the replicas. This scales read throughput horizontally, isolates heavy analytical or reporting queries from the transactional path, and gives you a warm standby for failover.</p>
<p>Most replication is <b>asynchronous</b>: the primary commits and acknowledges the client <em>before</em> the replica has applied the change. That gap — <b>replication lag</b>, usually milliseconds but seconds under load — is the entire source of difficulty in this pattern.</p>
<pre>@Configuration
@EnableTransactionManagement
public class ReadReplicaConfig {

    @Bean
    @Primary
    public DataSource routingDataSource(
            DataSource primaryDataSource,
            DataSource replicaDataSource) {
        ReplicationRoutingDataSource routing = new ReplicationRoutingDataSource();
        Map&lt;Object, Object&gt; targets = new HashMap&lt;&gt;();
        targets.put("primary", primaryDataSource);
        targets.put("replica", replicaDataSource);
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(primaryDataSource);
        return routing;
    }
}</pre>` },
    { title: `Structure and routing`, body: `<p>The routing layer decides, per query, where it goes. Common implementations:</p>
<ul>
<li><b>Application-level</b> — a data source that exposes "reader" and "writer" endpoints; the code (or an annotation like Spring <code>@Transactional(readOnly = true)</code>) picks the reader.</li>
<li><b>Proxy / middleware</b> — ProxySQL, PgBouncer/Pgpool, or a cloud reader endpoint that parses statements and sends <code>SELECT</code> to replicas and writes to the primary.</li>
<li><b>Cluster endpoint</b> — a managed reader DNS/endpoint (e.g. Aurora) that load-balances across healthy replicas.</li>
</ul>
<p>Reads then spread across replicas (round-robin or least-connections), while every <code>INSERT/UPDATE/DELETE</code> and every transaction that will write goes to the primary.</p>
<pre>// RoutingDataSource — picks target based on @Transactional(readOnly)
public class ReplicationRoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            ? "replica"
            : "primary";
    }
}

// Writes always go to primary (readOnly = false is default)
@Transactional
public Payment capturePayment(String paymentId) {
    Payment payment = paymentRepository.findById(paymentId).orElseThrow();
    payment.markCaptured();
    return paymentRepository.save(payment);
}</pre>` },
    { title: `The read-your-writes hazard`, body: `<p>The signature bug: a user updates their profile (write → primary), the app immediately reloads it (read → replica), and the replica has not caught up — so the user sees their <em>old</em> data and assumes the save failed. Any "write then read the same entity" flow is exposed. Concretely, right after a wallet debit a balance read from a lagging replica can show the pre-debit amount.</p>
<pre>// HAZARD: debit on primary, then read balance from lagging replica
@Transactional
public void debitWallet(String walletId, long amount) {
    walletRepository.debit(walletId, amount);  // write → primary
}

@Transactional(readOnly = true)  // read → replica — may be stale!
public long getBalance(String walletId) {
    return walletRepository.findById(walletId)
        .map(Wallet::getBalanceMinor)
        .orElseThrow();
}

// After debitWallet() then getBalance() — replica may show old balance</pre>` },
    { title: `Consistency techniques`, body: `<p>You defend read-after-write with one or more of:</p>
<ol>
<li><b>Route critical reads to the primary</b> — the simplest fix. After a write, read the same entity from the primary for a short window (or always, for money-critical reads like available balance).</li>
<li><b>Sticky/monotonic routing</b> — pin a session to the primary for N seconds after it writes, so that user's own reads stay consistent.</li>
<li><b>Lag-aware routing</b> — track each replica's lag (Postgres <code>pg_last_wal_replay_lsn</code>, MySQL <code>Seconds_Behind_Master</code>) and skip replicas beyond a threshold.</li>
<li><b>LSN/GTID wait</b> — capture the write's log position and only read from a replica that has replayed at least that position (Aurora and others expose this).</li>
</ol>
<pre>// Money-critical reads: always route to primary, never replica
@Transactional(readOnly = true)
@UsePrimaryDataSource  // custom annotation overrides replica routing
public WalletBalance getWalletBalance(String walletId) {
    return walletRepository.findById(walletId)
        .map(w -&gt; new WalletBalance(w.getId(), w.getBalanceMinor()))
        .orElseThrow(() -&gt; new WalletNotFoundException(walletId));
}

// Lag-tolerant: payment history listing can use replica
@Transactional(readOnly = true)
public List&lt;Payment&gt; listPayments(String walletId, int limit) {
    return paymentRepository.findByWalletIdOrderByCreatedAtDesc(walletId, limit);
}</pre>` },
    { title: `Rules of thumb`, body: `<p>Default writes and read-your-own-writes to the primary; send genuinely lag-tolerant reads — search, listings, dashboards, analytics — to replicas. Never send a read that a write depends on (the <code>SELECT</code> before a balance check) to a replica. Monitor lag as a first-class metric and treat a replica over threshold as unhealthy. And remember replicas are eventually consistent by design: route by <em>how much staleness the query can tolerate</em>, not by convenience.</p>
<pre>@Aspect
@Component
public class PrimaryDataSourceAspect {

    private static final ThreadLocal&lt;Boolean&gt; FORCE_PRIMARY = new ThreadLocal&lt;&gt;();

    @Around("@annotation(UsePrimaryDataSource)")
    public Object forcePrimary(ProceedingJoinPoint pjp) throws Throwable {
        FORCE_PRIMARY.set(true);
        try {
            return pjp.proceed();
        } finally {
            FORCE_PRIMARY.remove();
        }
    }
}

// Updated routing respects the force-primary flag
public class ReplicationRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        if (Boolean.TRUE.equals(PrimaryDataSourceAspect.FORCE_PRIMARY.get())) {
            return "primary";
        }
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            ? "replica" : "primary";
    }
}</pre>` },
  ],
  related: ["connection-pooling", "denormalization-patterns", "transactional-boundaries", "multi-tenant-schema"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("read-replica-routing", stage, panel, stageEl);
}
