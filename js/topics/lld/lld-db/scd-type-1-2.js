// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

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
    { title: `The dimension-history problem`, body: `<p>In a data warehouse, <b>dimensions</b> describe entities that facts refer to — customer, product, merchant. A <b>slowly changing dimension (SCD)</b> changes occasionally: a customer moves city, a merchant changes category. Should last year's revenue re-attribute to the <em>new</em> city, or stay pinned to the city they lived in <em>then</em>? Type 1 vs Type 2 is the standard answer.</p>
<pre>-- Business key stays constant; Type 1 = one row per merchant
CREATE TABLE dim_merchant_type1 (
  merchant_id   TEXT PRIMARY KEY,
  category      TEXT,
  display_name  TEXT
);</pre>` },
    { title: `Type 1 — overwrite`, figureAfter: "scd-compare", body: `<p><b>Type 1</b> updates the attribute in place — one row per business key, no history:</p>
<pre>UPDATE dim_customer
SET city = 'Berlin', updated_at = now()
WHERE customer_key = 7;</pre>
<p>Simplest and smallest; always shows latest truth. History is destroyed — every past fact now looks as if it always belonged to Berlin, and you <b>cannot answer "revenue by city as it was then."</b> Use Type 1 for corrections (a misspelled display name) and attributes where only the current value ever matters.</p>` },
    { title: `Type 2 — add a new version`, body: `<p><b>Type 2</b> inserts a new row for each change. The <b>business key</b> stays constant; a <b>surrogate key</b> identifies each version:</p>
<ol>
<li>Expire current: <code>UPDATE dim_customer SET valid_to = now(), is_current = false WHERE customer_key = 7 AND is_current;</code></li>
<li>Insert new version with fresh surrogate key, <code>valid_from = now()</code>, <code>is_current = true</code>.</li>
</ol>
<p>Fact tables reference the <b>surrogate key</b>, not the business key — March revenue stays on the Paris version forever; September revenue joins the Berlin version. Standard Type 2 columns: <code>valid_from</code>, <code>valid_to</code> (or effective/expiry dates), <code>is_current</code>, and often a <code>version</code> number.</p>
<p><b>Walkthrough — merchant fee tier change:</b> expire the row where <code>is_current = true</code>, set its <code>expiry_date</code> to today, insert a new row with a fresh surrogate key, the new tier, <code>effective_date = today</code>, <code>is_current = true</code>. Existing fact rows keep their old <code>merchant_sk</code>; new facts get the new key.</p>
<pre>CREATE TABLE dim_merchant_type2 (
  surrogate_key   BIGSERIAL PRIMARY KEY,  -- facts join here
  merchant_id     TEXT NOT NULL,
  fee_tier        TEXT NOT NULL,
  effective_date  DATE NOT NULL,
  expiry_date     DATE,
  is_current      BOOLEAN NOT NULL
);
CREATE UNIQUE INDEX uq_merchant_current
  ON dim_merchant_type2 (merchant_id) WHERE is_current;</pre>` },
    { title: `Choosing (and the other types)`, body: `<p>Pick per attribute, not per table. Ask: <em>if this value changes, should historical facts re-attribute or stay pinned?</em></p>
<ul>
<li><b>Type 1</b> when history is noise or the change is a data fix (typo in merchant name).</li>
<li><b>Type 2</b> when point-in-time accuracy matters — pricing tiers, sales territory, risk band, anything you report on over time.</li>
<li><b>Type 0</b> — attribute never changes (date of birth).</li>
<li><b>Type 3</b> — keep one "previous value" column for simple before/after comparisons without full history.</li>
<li><b>Type 6</b> — combines 1+2+3: current value duplicated on every version row for easy "current vs historical" queries.</li>
</ul>
<p>Many real dimension tables mix types across columns — tier might be Type 2 while display name is Type 1.</p>` },
    { title: `Relationship to temporal tables`, body: `<p>Type 2 is valid-time versioning implemented in the ETL/loading layer for analytics — surrogate keys, <code>is_current</code> flag for fast "latest version" lookups. <b>Temporal tables</b> are the DBMS-managed version for OLTP. The pitfalls rhyme: guard against overlapping periods, keep exactly one current row per business key (partial unique index on <code>WHERE is_current</code>), and archive old versions as the table grows.</p>
<p>When a payment fact is loaded, store <code>merchant_sk</code> (the surrogate at load time), not <code>merchant_id</code> alone — otherwise a later tier change would mis-attribute old revenue.</p>
<pre>CREATE TABLE fact_payment (
  payment_id        TEXT PRIMARY KEY,
  merchant_sk       BIGINT NOT NULL REFERENCES dim_merchant_type2(surrogate_key),
  amount_minor      BIGINT NOT NULL,
  payment_date      DATE NOT NULL
);</pre>` },
  ],
  figures: [
    { id: "scd-compare", svg: SCD_SVG, caption: "Type 1 overwrites and loses the past; Type 2 inserts a new versioned row so facts stay attributed to the value that was current when they occurred." },
  ],
  related: ["temporal-tables", "audit-tables", "denormalization-patterns"],
});

export const meta = topic.meta;
export const content = topic.content;
