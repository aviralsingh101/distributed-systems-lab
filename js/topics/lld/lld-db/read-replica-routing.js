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
  oneliner: `Scale reads across asynchronous replicas — while knowing where routing happens (usually the database tier, not your service) and defending against stale reads.`,
  sections: [
    { title: `Replication is a database concern`, body: `<p><b>Read replicas</b> are created and kept in sync by the <b>database cluster</b>, not by application code. One <b>primary</b> accepts writes; the engine streams the write-ahead log to one or more <b>replicas</b> that apply changes asynchronously. Your service does not "manage" replication — it only decides <em>which endpoint</em> to send a query to.</p>
<p>In most production setups you <b>do not open separate connections to individual replica hostnames</b> from business logic. You connect to an <b>abstraction</b> the platform provides:</p>
<ul>
<li><b>Cluster / writer endpoint</b> — one DNS name (e.g. Aurora cluster endpoint, Cloud SQL instance) that always reaches the current primary for writes.</li>
<li><b>Reader endpoint</b> — a separate DNS name that load-balances across healthy read replicas (still an abstraction — you are not picking replica-3 by hand).</li>
<li><b>Connection proxy</b> — RDS Proxy, ProxySQL, PgBouncer, or Pgpool sits in front and routes by statement type or connection role.</li>
</ul>
<p>Replication lag (usually milliseconds, seconds under load) is the gap between primary commit and replica apply — that is what makes read routing a design problem.</p>
<p><b>Why bother at all?</b> Replicas let you scale read throughput horizontally, keep heavy reporting or analytics off the transactional primary, and maintain a warm standby the cluster can promote on failover — but only if you route reads to them deliberately.</p>` },
    { title: `Where routing actually happens`, body: `<p>Routing can live at three layers; only the last one is "your Java/Python service picks primary vs replica":</p>
<ol>
<li><b>Managed database</b> — you configure writer vs reader endpoints in the connection pool; the cloud provider handles failover and replica health. This is the default mental model for RDS Aurora, Cloud SQL read replicas, Azure Flexible Server, etc.</li>
<li><b>Proxy / middleware</b> — ProxySQL, MariaDB MaxScale, PgBouncer, or Pgpool sits in front and routes by statement type (<code>SELECT</code> → replica pool, writes → primary) or by connection role. The app still uses one or two stable URLs, not N replica IPs. Reader traffic is often load-balanced round-robin or least-connections across healthy replicas.</li>
<li><b>Application-level</b> — optional, when you need fine-grained rules (force primary after a write, lag-aware skipping, LSN wait). Frameworks expose this as a routing data source or explicit "reader" vs "writer" pools — use when infrastructure routing is not enough.</li>
</ol>
<p><b>Typical payment service:</b> JDBC pool → <code>writer.example.com</code> for transactions that mutate state; optional second pool → <code>reader.example.com</code> for dashboards and history listings. Both are stable endpoints — not direct TCP to <code>replica-2.internal</code>.</p>
<p>When you <em>do</em> use application-level routing, the usual rule is: mark read-only transactions or queries so they use the reader pool, and keep anything that writes (or reads-then-writes in one flow) on the writer pool. Some teams add a "force primary" flag for money-critical reads even inside a read-only transaction — e.g. available balance after a debit.</p>` },
    { title: `What gets routed where`, body: `<p>Regardless of layer, the rules are the same:</p>
<ul>
<li><b>Writes</b> — every <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>, and any transaction that will write → <b>primary only</b>.</li>
<li><b>Read-your-writes / money-critical reads</b> — balance after a debit, idempotency check, "did my payment succeed?" → <b>primary</b> (or wait until replica catches up).</li>
<li><b>Lag-tolerant reads</b> — payment history pages, search, analytics, internal dashboards → <b>reader endpoint</b> or replica pool.</li>
</ul>
<p>Never send a read that a subsequent write depends on (the <code>SELECT</code> before a balance check) to a lagging replica. Proxies that auto-route all <code>SELECT</code>s to replicas are dangerous unless you mark transactional or critical reads to stay on the writer.</p>
<p><b>Concrete split:</b> a paginated payment history for a wallet can use the reader endpoint — a few seconds of staleness is acceptable. The available balance shown immediately after a debit, or an idempotency lookup before retrying a charge, must use the writer endpoint (or wait for replication to catch up).</p>` },
    { title: `The read-your-writes hazard`, body: `<p>The signature bug: a user updates their profile (write → primary), the app immediately reloads it (read → replica), and the replica has not caught up — so the user sees old data and assumes the save failed.</p>
<p><b>Step-by-step wallet example:</b></p>
<ol>
<li>Request A runs a debit on the <b>writer</b> — primary commits, balance is now $70.</li>
<li>Request B (or the same API's follow-up read) hits the <b>reader</b> — replica still shows $100 because replication lag is 200ms.</li>
<li>The client displays the old balance; user retries the payment or opens a support ticket.</li>
</ol>
<p>Any "write then read the same entity" flow is exposed when reads default to replicas. This happens even with a reader <em>endpoint</em> — the endpoint is correct, but replication is still asynchronous. The fix is consistency policy (route that read to the writer), not a different connection string per replica.</p>` },
    { title: `Consistency techniques`, body: `<p>Defend read-after-write with one or more of:</p>
<ol>
<li><b>Route critical reads to the primary</b> — simplest fix. After a write, read the same entity from the writer endpoint for a short window (or always, for available balance).</li>
<li><b>Sticky session after write</b> — pin the user's requests to the primary for N seconds after they mutate state.</li>
<li><b>Lag-aware routing</b> — proxy or driver skips replicas beyond a lag threshold (Postgres <code>pg_last_wal_replay_lsn</code>, MySQL <code>Seconds_Behind_Master</code>).</li>
<li><b>LSN / GTID wait</b> — capture the write's log position and only read from a replica that has replayed at least that far (Aurora <code>aurora_replica_status</code>, etc.).</li>
</ol>
<p>Money-critical reads (available balance, hold amount) should default to the writer endpoint. History listings and reports can use the reader endpoint.</p>
<p><b>Application-level equivalent (when you need it):</b> after forcing critical reads to the writer for N seconds post-write, or tagging specific endpoints/methods as "primary only," you avoid building custom routing logic for every query — but the underlying rule is the same as picking writer vs reader DNS names in config.</p>` },
    { title: `Rules of thumb`, body: `<p>Default writes and read-your-own-writes to the <b>primary / writer endpoint</b>. Send genuinely lag-tolerant reads to the <b>reader endpoint</b>. Treat replicas as eventually consistent — route by <em>how much staleness the query can tolerate</em>, not by convenience.</p>
<p>Monitor replication lag as a first-class metric; treat a replica over threshold as unhealthy and remove it from the reader pool. Failover (promoting a replica) is also database-managed — your writer endpoint should follow the new primary without hard-coded hostnames in the service.</p>
<p>Application-level routing data sources are a power tool when proxies and reader endpoints cannot express your policy — not the default architecture.</p>` },
  ],
  related: ["connection-pooling", "denormalization-patterns", "transactional-boundaries", "multi-tenant-schema"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("read-replica-routing", stage, panel, stageEl);
}
