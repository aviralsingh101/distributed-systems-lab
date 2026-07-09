// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const TEMPORAL_SVG = `<svg viewBox="0 0 640 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A row versioned over valid-time periods on a timeline">
  <line x1="40" y1="120" x2="600" y2="120" stroke="#93a1bd" stroke-width="1.2"/>
  <text x="40" y="140" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">Jan</text>
  <text x="230" y="140" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">Apr</text>
  <text x="420" y="140" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">Aug</text>
  <text x="565" y="140" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">now</text>
  <rect x="40" y="60" width="200" height="34" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="140" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">plan=BASIC [Jan, Apr)</text>
  <rect x="240" y="60" width="190" height="34" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/>
  <text x="335" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">plan=PRO [Apr, Aug)</text>
  <rect x="430" y="60" width="170" height="34" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/>
  <text x="515" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">plan=PRO+ [Aug, ∞)</text>
  <text x="320" y="35" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">One customer, three non-overlapping valid-time versions of "plan".</text>
  <line x1="235" y1="94" x2="235" y2="120" stroke="#ff6b6b" stroke-width="1" stroke-dasharray="3 2"/>
  <text x="150" y="112" fill="#3ddc97" font-size="9" font-family="system-ui">AS OF Feb → BASIC</text>
</svg>`;

const topic = makeTopic({
  id: "temporal-tables",
  title: "Temporal Tables",
  category: "lld-db",
  track: "lld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `Tables that keep every version of a row across time, so you can query "what did this record look like as of date T?" directly in SQL.`,
  sections: [
    { title: `Two kinds of time`, body: `<p>A <b>temporal table</b> stores the history of a row, not just its current value. The key distinction is <em>which</em> time it tracks:</p>
<ul>
<li><b>Valid time</b> (application/business time) — the period during which a fact was true <em>in the real world</em>. A customer's plan was BASIC from January to April. You control these dates; they can be backdated or future-dated.</li>
<li><b>Transaction time</b> (system time) — the period during which a row was <em>stored in the database</em>, set automatically by the DBMS and never editable. This answers "what did we believe on the day we ran that report?"</li>
</ul>
<p>A <b>bitemporal</b> table tracks both at once, so you can distinguish "the discount was effective in March" from "we only recorded that discount in May."</p>
<pre>@Entity
@Table(name = "fee_schedules")
public class FeeScheduleVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "merchant_id", nullable = false)
    private String merchantId;

    @Column(name = "fee_bps", nullable = false)
    private int feeBps;

    // Valid-time period: [valid_from, valid_to)
    @Column(name = "valid_from", nullable = false)
    private Instant validFrom;

    @Column(name = "valid_to", nullable = false)
    private Instant validTo;  // use far-future sentinel for current version
}</pre>` },
    { title: `How valid-time tables work`, figureAfter: "valid-time", body: `<p>Here is how it works. A valid-time row carries a period, typically two columns <code>valid_from</code> and <code>valid_to</code> (half-open: <code>[from, to)</code>). Instead of overwriting, an update <b>closes</b> the current version and <b>opens</b> a new one:</p>
<ol>
<li>Set the current row's <code>valid_to = now()</code>.</li>
<li>Insert a new row with the new values, <code>valid_from = now()</code>, <code>valid_to = 'infinity'</code>.</li>
</ol>
<p>The current state is simply <code>WHERE valid_to = 'infinity'</code>; a point-in-time query is <code>WHERE :t &gt;= valid_from AND :t &lt; valid_to</code>. A key integrity rule: for one entity, the periods must not overlap — Postgres enforces this with an exclusion constraint over a <code>tstzrange</code> and <code>&amp;&amp;</code>.</p>
<pre>@Service
public class FeeScheduleService {

    private static final Instant FOREVER =
        Instant.parse("9999-12-31T23:59:59Z");

    private final FeeScheduleRepository repository;

    @Transactional
    public void updateFeeRate(String merchantId, int newFeeBps) {
        Instant now = Instant.now();

        // Close current version
        repository.findCurrent(merchantId).ifPresent(current -&gt; {
            current.setValidTo(now);
            repository.save(current);
        });

        // Open new version
        FeeScheduleVersion next = new FeeScheduleVersion();
        next.setMerchantId(merchantId);
        next.setFeeBps(newFeeBps);
        next.setValidFrom(now);
        next.setValidTo(FOREVER);
        repository.save(next);
    }
}</pre>` },
    { title: `System-versioned tables (SQL:2011)`, body: `<p>Standard SQL and several engines automate transaction time. You declare period columns and let the database maintain them and mirror old versions into a history table:</p>
<p><code>CREATE TABLE wallet (id BIGINT PRIMARY KEY, balance NUMERIC, valid_from TIMESTAMPTZ GENERATED ALWAYS AS ROW START, valid_to TIMESTAMPTZ GENERATED ALWAYS AS ROW END, PERIOD FOR SYSTEM_TIME (valid_from, valid_to)) WITH SYSTEM VERSIONING;</code></p>
<p>Then time-travel reads use <code>FOR SYSTEM_TIME AS OF</code>: <code>SELECT * FROM wallet FOR SYSTEM_TIME AS OF '2026-01-31' WHERE id = 7;</code>. SQL Server, MariaDB, and DB2 implement this directly; Postgres emulates it with triggers or extensions.</p>
<pre>// Point-in-time query — what was the fee on the day of this payment?
@Repository
public interface FeeScheduleRepository extends JpaRepository&lt;FeeScheduleVersion, Long&gt; {

    @Query("""
        SELECT f FROM FeeScheduleVersion f
        WHERE f.merchantId = :merchantId
          AND f.validFrom &lt;= :asOf
          AND f.validTo &gt; :asOf
        """)
    Optional&lt;FeeScheduleVersion&gt; findAsOf(
        @Param("merchantId") String merchantId,
        @Param("asOf") Instant asOf);

    @Query("""
        SELECT f FROM FeeScheduleVersion f
        WHERE f.merchantId = :merchantId
          AND f.validTo = :forever
        """)
    Optional&lt;FeeScheduleVersion&gt; findCurrent(
        @Param("merchantId") String merchantId,
        @Param("forever") Instant forever);
}

// Charge using the fee effective at transaction time
public int feeForPayment(Payment payment) {
    return feeScheduleRepository
        .findAsOf(payment.getMerchantId(), payment.getCreatedAt())
        .map(FeeScheduleVersion::getFeeBps)
        .orElseThrow();
}</pre>` },
    { title: `Where it fits`, body: `<p>Temporal tables shine for anything where the past is a first-class query, not just a log: pricing and rate cards that change over time, contract or entitlement periods, regulatory "state as of report date" reconstruction, and slowly changing attributes in analytics. For a payment platform, valid-time fee schedules let you charge each transaction the fee that was effective when it occurred — even if you edit the schedule later.</p>
<pre>@Entity
@Table(name = "wallet_status_history")
public class WalletStatusVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet_id", nullable = false)
    private String walletId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WalletStatus status;  // ACTIVE, FROZEN, CLOSED

    @Column(name = "valid_from", nullable = false)
    private Instant validFrom;

    @Column(name = "valid_to", nullable = false)
    private Instant validTo;
}

// View hiding the valid_to predicate for "current" reads
// CREATE VIEW wallet_status_current AS
//   SELECT * FROM wallet_status_history WHERE valid_to = '9999-12-31';</pre>` },
    { title: `Trade-offs`, body: `<p>History grows without bound, so partition and archive old versions. Every query that wants "now" must remember the current-version predicate (or read a view that hides it), and unique constraints must become period-aware (unique <em>within</em> a time slice, not across all history). Compared to an <b>audit table</b>, which is a forensic change log optimized for "who changed this," a temporal table is optimized for "what was the value at time T" and keeps that query in plain SQL. Compared to <b>SCD Type 2</b>, temporal tables are the general, DBMS-supported form of the same versioning idea.</p>
<pre>// Current-version lookup helper — never forget the valid_to filter
public interface TemporalRepository&lt;T&gt; {
    default Optional&lt;T&gt; findCurrent(String entityId) {
        return findAsOf(entityId, Instant.now());
    }
    Optional&lt;T&gt; findAsOf(String entityId, Instant asOf);
}

// Partition old versions by year to bound table size
// CREATE TABLE fee_schedules_2025 PARTITION OF fee_schedules
//   FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');</pre>` },
  ],
  figures: [
    { id: "valid-time", svg: TEMPORAL_SVG, caption: "Non-overlapping valid-time versions of one customer's plan; an AS OF query selects the version whose period contains the target instant." },
  ],
  related: ["scd-type-1-2", "audit-tables", "soft-delete"],
});

export const meta = topic.meta;
export const content = topic.content;
