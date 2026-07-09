// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const ER_SVG = `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Customer, Order, OrderItem entity-relationship diagram">
  <defs><marker id="fig-er-modeling-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="150" height="76" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="95" y="90" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Customer</text>
  <text x="30" y="110" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="30" y="126" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">email UNIQUE</text>
  <rect x="245" y="70" width="150" height="76" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="320" y="90" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">Order</text>
  <text x="255" y="110" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="255" y="126" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">FK customer_id</text>
  <rect x="470" y="70" width="150" height="76" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="545" y="90" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">OrderItem</text>
  <text x="480" y="110" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="480" y="126" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">FK order_id</text>
  <line x1="170" y1="108" x2="243" y2="108" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-er-modeling-arr)"/>
  <line x1="395" y1="108" x2="468" y2="108" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-er-modeling-arr)"/>
  <text x="206" y="100" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">1 : N</text>
  <text x="431" y="100" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">1 : N</text>
  <text x="320" y="185" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">One customer places many orders; each order has many line items.</text>
</svg>`;

const topic = makeTopic({
  id: "er-modeling",
  title: "ER Modeling",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `The design language for a relational schema — entities, attributes, and the cardinality of the relationships between them.`,
  sections: [
    { title: `What ER modeling is`, body: `<p><b>Entity-Relationship (ER) modeling</b> is the technique for turning a domain into a relational schema before writing DDL. You identify <b>entities</b> (nouns the business cares about — Customer, Order, Wallet, Ledger), the <b>attributes</b> that describe each one, and the <b>relationships</b> that connect them. The output maps almost mechanically onto tables, columns, primary keys, and foreign keys.</p>
<p>The goal is a schema where every fact lives in exactly one place and every relationship is enforceable by the database. Get entities and cardinalities right early — reshaping a relationship after millions of rows exist is a migration, not an edit.</p>
<p>Start with domain nouns on a whiteboard (Wallet, Payment, LedgerEntry) and their attributes <em>before</em> ORM mapping or API design — ER modeling is about the data model, not the programming language.</p>` },
    { title: `Entities, attributes, and keys`, body: `<p>An <b>entity</b> becomes a table; an <b>entity instance</b> becomes a row. Each entity needs a <b>key</b> — an attribute (or set) that uniquely identifies a row. A <b>candidate key</b> is any minimal unique identifier; the one you reference is the <b>primary key</b>.</p>
<p>Prefer a stable surrogate key (UUID or <code>BIGSERIAL</code>) as the primary key, and enforce real-world uniqueness with a separate <code>UNIQUE</code> constraint (e.g. <code>owner_email</code> on Wallet). This keeps foreign keys narrow and lets natural values change without cascading rewrites.</p>
<pre>CREATE TABLE wallet (
  id            TEXT PRIMARY KEY,           -- surrogate
  balance_minor BIGINT NOT NULL,
  currency      CHAR(3) NOT NULL,
  owner_email   TEXT UNIQUE                 -- natural uniqueness, not the PK
);</pre>` },
    { title: `Relationships and cardinality`, figureAfter: "er-diagram", body: `<p>A relationship connects two entities; its <b>cardinality</b> says how many instances participate on each side:</p>
<ul>
<li><b>One-to-many (1:N)</b> — one Customer has many Orders. Put <code>customer_id</code> on the <em>many</em> side (Order).</li>
<li><b>One-to-one (1:1)</b> — e.g. one Wallet has one current balance snapshot. Implement as shared primary key, or columns on one table, or a unique FK on the dependent side.</li>
<li><b>Many-to-many (M:N)</b> — e.g. Orders and Products. Introduce a <b>junction table</b> (<code>order_item</code>) whose primary key is the pair of foreign keys, often with extra columns like <code>qty</code>.</li>
</ul>
<p><b>Optionality:</b> <code>customer_id BIGINT NOT NULL REFERENCES customer(id)</code> means every order must belong to a customer; nullable FK means optional participation.</p>
<pre>-- 1:N — one wallet, many payments (FK on the many side)
CREATE TABLE payment (
  id           TEXT PRIMARY KEY,
  wallet_id    TEXT NOT NULL REFERENCES wallet(id),
  amount_minor BIGINT NOT NULL,
  status       TEXT NOT NULL
);

-- 1:N — one payment, many ledger entries
CREATE TABLE ledger_entry (
  id           BIGSERIAL PRIMARY KEY,
  payment_id   TEXT NOT NULL REFERENCES payment(id),
  wallet_id    TEXT NOT NULL REFERENCES wallet(id),
  amount_minor BIGINT NOT NULL
);</pre>` },
    { title: `How an ER model becomes tables`, body: `<p>Translation is largely mechanical:</p>
<ol>
<li>Each strong entity → one table with its primary key.</li>
<li>Each 1:N relationship → a foreign key on the many side.</li>
<li>Each M:N relationship → a junction table with two FKs and a composite primary key.</li>
<li>Each multi-valued attribute → its own child table (not <code>address1/2/3</code> columns).</li>
</ol>
<pre>-- M:N junction — payments and tags
CREATE TABLE tag (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE payment_tag (
  payment_id TEXT NOT NULL REFERENCES payment(id),
  tag_id     BIGINT NOT NULL REFERENCES tag(id),
  PRIMARY KEY (payment_id, tag_id)
);</pre>` },
    { title: `Common modeling mistakes`, body: `<p><b>Repeating groups</b> (comma-separated tag lists, <code>address1/2/3</code> columns) signal a missing child table — each value gets its own row. <b>Overloaded entities</b> — one <code>account</code> table that is sometimes customer and sometimes merchant — usually want separate tables or a clear type discriminator with disjoint attributes. <b>Missing junction tables</b> force application code to fake M:N with duplicated rows or JSON blobs the database cannot join efficiently.</p>
<p>Model <em>ownership direction</em> deliberately: a ledger entry belongs to exactly one wallet, so the FK, retention policy, and <code>ON DELETE RESTRICT</code> live on the ledger side — you should not be able to delete a wallet that still has ledger history.</p>
<pre>CREATE TABLE ledger_entry (
  id           BIGSERIAL PRIMARY KEY,
  wallet_id    TEXT NOT NULL REFERENCES wallet(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);</pre>` },
  ],
  figures: [
    { id: "er-diagram", svg: ER_SVG, caption: "A 1:N chain: Customer → Order → OrderItem. Foreign keys live on the many side; the crow's-foot 1:N label captures cardinality." },
  ],
  related: ["normal-forms-bcnf", "primary-foreign-keys", "denormalization-patterns"],
});

export const meta = topic.meta;
export const content = topic.content;
