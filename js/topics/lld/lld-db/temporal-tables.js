// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

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
    { title: `Two kinds of time`, body: `<p>A <b>temporal table</b> stores the history of a row, not just its current value:</p>
<ul>
<li><b>Valid time</b> (business time) — when a fact was true in the real world. You set <code>valid_from</code> / <code>valid_to</code>; they can be backdated or future-dated for corrections and scheduled rate changes.</li>
<li><b>Transaction time</b> (system time) — when a row was stored in the database, set automatically by the DBMS and never editable. Answers "what did we believe on the day we ran that report?"</li>
</ul>
<p>A <b>bitemporal</b> table tracks both — distinguishing "the discount was effective in March" from "we recorded it in May."</p>
<pre>CREATE TABLE fee_schedule (
  id           BIGSERIAL PRIMARY KEY,
  merchant_id  TEXT NOT NULL,
  fee_bps      INT NOT NULL,
  valid_from   TIMESTAMPTZ NOT NULL,
  valid_to     TIMESTAMPTZ NOT NULL   -- far-future sentinel for current row
);</pre>` },
    { title: `How valid-time tables work`, figureAfter: "valid-time", body: `<p>Each version carries a half-open period <code>[valid_from, valid_to)</code>. An update <b>closes</b> the current row and <b>opens</b> a new one — never overwrite in place.</p>
<ol>
<li><code>UPDATE fee_schedule SET valid_to = now() WHERE merchant_id = :id AND valid_to = 'infinity';</code></li>
<li><code>INSERT INTO fee_schedule (...) VALUES (..., now(), 'infinity');</code></li>
</ol>
<p>Current state: <code>WHERE valid_to = 'infinity'</code> (or a far-future sentinel). Point-in-time: <code>WHERE :t &gt;= valid_from AND :t &lt; valid_to</code>. For one merchant, periods must not overlap — Postgres enforces this with an exclusion constraint: <code>EXCLUDE USING gist (merchant_id WITH =, tstzrange(valid_from, valid_to) WITH &amp;&amp;)</code>.</p>
<p><b>Never overwrite in place</b> — an UPDATE that changes <code>fee_bps</code> without closing the old row destroys history. The close-then-insert pattern is the whole point.</p>` },
    { title: `System-versioned tables (SQL:2011)`, body: `<p>Standard SQL lets the database maintain transaction time and mirror old versions to a history table:</p>
<pre>CREATE TABLE wallet (
  id BIGINT PRIMARY KEY,
  balance NUMERIC,
  valid_from TIMESTAMPTZ GENERATED ALWAYS AS ROW START,
  valid_to   TIMESTAMPTZ GENERATED ALWAYS AS ROW END,
  PERIOD FOR SYSTEM_TIME (valid_from, valid_to)
) WITH SYSTEM VERSIONING;

-- Time-travel read
SELECT * FROM wallet FOR SYSTEM_TIME AS OF '2026-01-31' WHERE id = 7;</pre>
<p>SQL Server, MariaDB, and DB2 implement this directly; Postgres emulates with triggers or extensions.</p>` },
    { title: `Where it fits`, body: `<p>Temporal tables shine when the past is a first-class query: pricing and rate cards, contract or entitlement periods, regulatory "state as of report date," wallet status (ACTIVE → FROZEN → CLOSED) tracked as non-overlapping versions. For payments, valid-time fee schedules let you charge each transaction the fee that was effective when it occurred — even if an admin edits the schedule later.</p>
<p><b>Current vs as-of reads:</b> dashboards use a view or <code>WHERE valid_to = infinity</code> for "now." Billing reconciliation uses the as-of predicate with the payment's <code>created_at</code> timestamp.</p>
<pre>-- Fee effective when payment was created
SELECT f.fee_bps
FROM fee_schedule f
WHERE f.merchant_id = :merchantId
  AND :paymentCreatedAt &gt;= f.valid_from
  AND :paymentCreatedAt &lt;  f.valid_to;</pre>` },
    { title: `Trade-offs`, body: `<p>History grows without bound — partition and archive old versions. Every "current" query must include the <code>valid_to</code> predicate (or read through a view like <code>fee_schedule_current</code> that hides it). Unique constraints become period-aware: unique <em>within</em> a time slice, not across all history.</p>
<p>Compared to an <b>audit table</b> (who changed what, when — optimized for forensics), temporal tables answer "what was the value at time T" in plain SQL. Compared to <b>SCD Type 2</b>, temporal tables are the DBMS-managed form of the same versioning idea for OLTP.</p>
<pre>CREATE VIEW fee_schedule_current AS
  SELECT * FROM fee_schedule WHERE valid_to = 'infinity';

-- Partition old versions by year to bound table size
-- CREATE TABLE fee_schedule_2025 PARTITION OF fee_schedule
--   FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');</pre>` },
  ],
  figures: [
    { id: "valid-time", svg: TEMPORAL_SVG, caption: "Non-overlapping valid-time versions of one customer's plan; an AS OF query selects the version whose period contains the target instant." },
  ],
  related: ["scd-type-1-2", "audit-tables", "soft-delete"],
});

export const meta = topic.meta;
export const content = topic.content;
