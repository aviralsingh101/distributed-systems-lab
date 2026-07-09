// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const SCD_SVG = `<svg viewBox="0 0 660 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SCD type 1 overwrite versus type 2 new versioned row">
  <text x="165" y="24" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Type 1 — overwrite</text>
  <rect x="30" y="40" width="270" height="34" rx="5" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.4"/>
  <text x="165" y="62" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">key 7 | city = Berlin  (was Paris)</text>
  <text x="165" y="92" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">history lost — one row per key</text>
  <text x="495" y="24" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Type 2 — new version</text>
  <rect x="360" y="40" width="270" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/>
  <text x="495" y="60" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">sk1 | key7 | Paris  | [Jan,Aug) | cur=N</text>
  <rect x="360" y="74" width="270" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/>
  <text x="495" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">sk2 | key7 | Berlin | [Aug,∞)  | cur=Y</text>
  <text x="495" y="126" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">history preserved — many rows per key</text>
  <text x="330" y="170" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Facts joined to sk1 stay attributed to Paris; new facts join to sk2.</text>
</svg>`;

const topic = makeTopic({
  id: "scd-type-1-2",
  title: "SCD Type 1 / 2",
  category: "lld-db",
  track: "lld",
  tier: "hidden-gem",
  archetype: "tradeoff",
  oneliner: `When a dimension attribute changes, do you overwrite it (Type 1, no history) or insert a new versioned row (Type 2, full history)?`,
  sections: [
    { title: `The dimension-history problem`, body: `<p>In a data warehouse, <b>dimensions</b> describe the entities that facts refer to — customer, product, merchant. A <b>slowly changing dimension (SCD)</b> is one whose descriptive attributes change occasionally: a customer moves city, a merchant changes category. The design question is what happens to historical facts when an attribute changes. Should last year's revenue re-attribute to the customer's <em>new</em> city, or stay pinned to the city they lived in <em>then</em>? SCD types are the standard answers, and Type 1 versus Type 2 is the core decision.</p>
<pre>// Merchant dimension — the business key stays constant across versions
public record MerchantBusinessKey(String merchantId) {}

// Type 1: single row, no history
@Entity
@Table(name = "dim_merchant_type1")
public class MerchantType1 {
    @Id
    private String merchantId;
    private String category;
    private String displayName;
}</pre>` },
    { title: `Type 1 — overwrite`, figureAfter: "scd-compare", body: `<p><b>Type 1</b> simply updates the attribute in place — one row per business key, no history:</p>
<p><code>UPDATE dim_customer SET city = 'Berlin', updated_at = now() WHERE customer_key = 7;</code></p>
<p>It is the simplest and smallest option and always shows the latest truth. The cost is that history is destroyed: every past fact now looks as if it always belonged to Berlin, and you cannot answer "revenue by city as it was then." Use Type 1 for corrections (a misspelled name) and for attributes where only the current value ever matters.</p>
<pre>@Service
public class MerchantType1Service {

    private final MerchantType1Repository repository;

    // Type 1: overwrite in place — history lost
    @Transactional
    public void correctDisplayName(String merchantId, String correctedName) {
        MerchantType1 merchant = repository.findById(merchantId).orElseThrow();
        merchant.setDisplayName(correctedName);  // typo fix — history doesn't matter
        repository.save(merchant);
    }
}</pre>` },
    { title: `Type 2 — add a new version`, body: `<p><b>Type 2</b> preserves history by inserting a <em>new</em> row for each change and marking which is current. The <b>business (natural) key</b> stays constant while a <b>surrogate key</b> identifies each version:</p>
<ol>
<li>Expire the current version: <code>UPDATE dim_customer SET valid_to = now(), is_current = false WHERE customer_key = 7 AND is_current = true;</code></li>
<li>Insert the new version with a fresh surrogate key, <code>valid_from = now()</code>, <code>valid_to = 'infinity'</code>, <code>is_current = true</code>.</li>
</ol>
<p>Fact tables reference the <b>surrogate key</b>, not the business key. So a fact recorded in March joins to the Paris version forever, while a fact in September joins to the Berlin version — history is correct without rewriting any fact. Standard columns: <code>valid_from</code>, <code>valid_to</code>, <code>is_current</code>, and often a <code>version</code> number.</p>
<pre>@Entity
@Table(name = "dim_merchant_type2",
       indexes = @Index(name = "idx_merchant_current",
                        columnList = "merchant_id, is_current"))
public class MerchantType2 {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long surrogateKey;  // facts join on THIS, not merchantId

    @Column(name = "merchant_id", nullable = false)
    private String merchantId;  // business key — constant across versions

    @Column(name = "fee_tier", nullable = false)
    private String feeTier;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;  // valid_from equivalent

    @Column(name = "expiry_date")
    private LocalDate expiryDate;     // valid_to equivalent (null = current)

    @Column(name = "is_current", nullable = false)
    private boolean isCurrent;
}</pre>` },
    { title: `Choosing (and the other types)`, body: `<p>Pick per attribute, not per table. Use <b>Type 1</b> when history is noise or the change is a fix; use <b>Type 2</b> when point-in-time accuracy matters — pricing tiers, sales territory, risk band, anything you report on over time. Other variants fill gaps: <b>Type 0</b> never changes (date of birth); <b>Type 3</b> keeps a single "previous value" column for one-step comparisons; <b>Type 6</b> combines 1+2+3 (current value duplicated onto every version for easy "current vs historical" queries). Many real tables mix types across columns.</p>
<pre>@Service
public class MerchantType2Service {

    private final MerchantType2Repository repository;

    @Transactional
    public MerchantType2 changeFeeTier(String merchantId, String newTier) {
        LocalDate today = LocalDate.now();

        // Expire current version
        repository.findByMerchantIdAndIsCurrentTrue(merchantId)
            .ifPresent(current -&gt; {
                current.setExpiryDate(today);
                current.setCurrent(false);
                repository.save(current);
            });

        // Insert new version with fresh surrogate key
        MerchantType2 next = new MerchantType2();
        next.setMerchantId(merchantId);
        next.setFeeTier(newTier);
        next.setEffectiveDate(today);
        next.setExpiryDate(null);
        next.setCurrent(true);
        return repository.save(next);
    }
}</pre>` },
    { title: `Relationship to temporal tables`, body: `<p>Type 2 is essentially valid-time versioning implemented by hand in the ETL/loading layer, tuned for analytics (surrogate keys, an <code>is_current</code> flag for fast latest-version lookups). <b>Temporal tables</b> are the general, DBMS-managed version of the same idea for OLTP. The pitfalls rhyme: guard against overlapping periods, keep exactly one current row per business key (a partial unique index on <code>WHERE is_current</code>), and size for unbounded growth by archiving old versions.</p>
<pre>// Payment fact table joins on surrogate key — attribution stays correct
@Entity
@Table(name = "fact_payments")
public class PaymentFact {

    @Id
    private String paymentId;

    // FK to the merchant version active when payment occurred
    @Column(name = "merchant_sk", nullable = false)
    private Long merchantSurrogateKey;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;
}

// Partial unique: exactly one current row per merchant
// CREATE UNIQUE INDEX uq_merchant_current
//   ON dim_merchant_type2 (merchant_id) WHERE is_current = true;</pre>` },
  ],
  figures: [
    { id: "scd-compare", svg: SCD_SVG, caption: "Type 1 overwrites and loses the past; Type 2 inserts a new versioned row so facts stay attributed to the value that was current when they occurred." },
  ],
  related: ["temporal-tables", "audit-tables", "denormalization-patterns"],
});

export const meta = topic.meta;
export const content = topic.content;
