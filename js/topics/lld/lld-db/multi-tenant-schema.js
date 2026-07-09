// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const MT_SVG = `<svg viewBox="0 0 660 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three multi-tenant isolation models: shared table, schema per tenant, database per tenant">
  <rect x="20" y="30" width="190" height="120" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="115" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-weight="600" font-family="system-ui">Shared table</text>
  <text x="32" y="72" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">one table</text>
  <text x="32" y="88" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">tenant_id column</text>
  <text x="32" y="112" fill="#93a1bd" font-size="9" font-family="system-ui">cheapest · weakest isolation</text>
  <text x="32" y="128" fill="#93a1bd" font-size="9" font-family="system-ui">noisy neighbour risk</text>
  <rect x="235" y="30" width="190" height="120" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="330" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-weight="600" font-family="system-ui">Schema per tenant</text>
  <text x="247" y="72" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">one DB, N schemas</text>
  <text x="247" y="88" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">search_path = tenant</text>
  <text x="247" y="112" fill="#93a1bd" font-size="9" font-family="system-ui">medium isolation</text>
  <text x="247" y="128" fill="#93a1bd" font-size="9" font-family="system-ui">N× migrations</text>
  <rect x="450" y="30" width="190" height="120" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="545" y="50" text-anchor="middle" fill="#cdd6e8" font-size="11" font-weight="600" font-family="system-ui">Database per tenant</text>
  <text x="462" y="72" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">one DB each</text>
  <text x="462" y="88" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">separate connection</text>
  <text x="462" y="112" fill="#3ddc97" font-size="9" font-family="system-ui">strongest isolation</text>
  <text x="462" y="128" fill="#ff6b6b" font-size="9" font-family="system-ui">most operational cost</text>
</svg>`;

const topic = makeTopic({
  id: "multi-tenant-schema",
  title: "Multi-Tenant Schema",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `How much to isolate one customer's data from another's — a shared table with a tenant_id, a schema per tenant, or a whole database per tenant.`,
  sections: [
    { title: `The spectrum of isolation`, body: `<p>A <b>multi-tenant</b> application serves many customers (tenants) from shared infrastructure. The central design choice is <em>where</em> you draw the isolation boundary between tenants, and it is a spectrum from cheap-and-shared to expensive-and-isolated. Three points dominate: a <b>shared table</b> discriminated by a <code>tenant_id</code>, a <b>schema per tenant</b> inside one database, and a <b>database (or cluster) per tenant</b>. The right answer depends on tenant count, isolation and compliance requirements, and how much per-tenant customization you allow.</p>
<pre>// Tenant context — threaded through every layer
public final class TenantContext {
    private static final ThreadLocal&lt;String&gt; TENANT_ID = new ThreadLocal&lt;&gt;();

    public static void set(String tenantId) { TENANT_ID.set(tenantId); }
    public static String get() { return TENANT_ID.get(); }
    public static void clear() { TENANT_ID.remove(); }
}</pre>` },
    { title: `Option A — shared table with tenant_id`, figureAfter: "mt-models", body: `<p>Every tenant's rows live in the same tables; a <code>tenant_id</code> column tags ownership and appears in every index and every query:</p>
<p><code>CREATE TABLE "order" (id BIGSERIAL PRIMARY KEY, tenant_id BIGINT NOT NULL, ... );</code> with a leading composite index <code>(tenant_id, created_at)</code>.</p>
<p>It is the cheapest and most scalable to thousands of small tenants, and a single migration updates everyone. The danger is that isolation now depends on <em>never forgetting the filter</em> — one query missing <code>WHERE tenant_id = ?</code> is a cross-tenant data leak. Enforce it structurally with <b>row-level security</b> (Postgres <code>RLS</code> policies bound to a session variable) so the database rejects cross-tenant access even if the application forgets. Watch for the <b>noisy neighbour</b>: one heavy tenant degrades shared indexes and cache for all.</p>
<pre>@Entity
@Table(name = "payments",
       indexes = @Index(name = "idx_payment_tenant_created",
                        columnList = "tenant_id, created_at"))
@FilterDef(name = "tenantFilter",
           parameters = @ParamDef(name = "tenantId", type = String.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
public class Payment {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private String tenantId;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;
}</pre>` },
    { title: `Option B — schema per tenant`, body: `<p>One database, but each tenant gets its own <b>schema</b> (namespace) containing an identical set of tables. A connection selects the tenant by setting <code>search_path</code>. Isolation is stronger — a query cannot accidentally read another schema — and you can restore or export a single tenant easily. The cost is <b>fan-out on schema changes</b>: a migration must run across N schemas, and thousands of schemas strain the catalog and connection pooling. It fits the low-hundreds of medium tenants.</p>
<pre>@Component
public class SchemaPerTenantConnectionProvider implements MultiTenantConnectionProvider {

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        Connection connection = dataSource.getConnection();
        connection.createStatement().execute(
            "SET search_path TO tenant_" + tenantIdentifier);
        return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection)
            throws SQLException {
        connection.createStatement().execute("SET search_path TO public");
        connection.close();
    }
}</pre>` },
    { title: `Option C — database per tenant`, body: `<p>Each tenant gets a dedicated database (or even cluster). This gives the strongest isolation — separate storage, separate credentials, independent backup/restore, per-tenant tuning, and a natural home for data-residency requirements (EU tenant in an EU database). It is the most expensive to operate: connection routing, per-tenant migrations, monitoring, and cost scale with tenant count. It suits a small number of large, high-value, or heavily regulated tenants — exactly the profile of enterprise payment customers.</p>
<pre>@Service
public class DatabasePerTenantRouter {

    private final Map&lt;String, DataSource&gt; tenantDataSources;

    public DataSource resolveDataSource(String tenantId) {
        return tenantDataSources.computeIfAbsent(tenantId, this::createTenantDataSource);
    }

    private DataSource createTenantDataSource(String tenantId) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://db-" + tenantId + ":5432/payments");
        config.setUsername("tenant_" + tenantId);
        config.setMaximumPoolSize(10);
        config.setPoolName("tenant-" + tenantId);
        return new HikariDataSource(config);
    }
}</pre>` },
    { title: `Choosing and combining`, body: `<p>Match the boundary to the blast radius you can tolerate. Many small self-serve tenants → shared table with RLS. A few large enterprise tenants → database per tenant. In practice mature platforms run a <b>hybrid</b>: pooled shared tables for the long tail, promoted to dedicated databases for premium or regulated tenants. Whatever you pick, thread <code>tenant_id</code> through <em>every</em> layer — keys, indexes, caches, logs, and metrics — and make cross-tenant access impossible by construction, not by discipline. Migrating a tenant across models later is real work, so size the choice for where you will be, not just where you start.</p>
<pre>// Hibernate filter — enforce tenant_id on every query automatically
@Component
public class TenantFilterEnabler implements WebRequestInterceptor {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public void preHandle(WebRequest request) {
        String tenantId = TenantContext.get();
        if (tenantId != null) {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter("tenantFilter")
                   .setParameter("tenantId", tenantId);
        }
    }
}

@Repository
public interface PaymentRepository extends JpaRepository&lt;Payment, String&gt; {
    // Filter applied automatically — cannot forget tenant_id
    List&lt;Payment&gt; findByWalletIdOrderByCreatedAtDesc(String walletId);
}</pre>` },
  ],
  figures: [
    { id: "mt-models", svg: MT_SVG, caption: "Isolation increases left to right — shared table (cheapest, weakest) to database per tenant (strongest, costliest)." },
  ],
  related: ["primary-foreign-keys", "read-replica-routing", "connection-pooling"],
});

export const meta = topic.meta;
export const content = topic.content;
