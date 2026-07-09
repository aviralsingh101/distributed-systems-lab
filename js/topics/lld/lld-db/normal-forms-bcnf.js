// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "normal-forms-bcnf",
  title: "1NF–3NF / BCNF",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `A ladder of guarantees about functional dependencies that removes update, insert, and delete anomalies from a relational schema.`,
  sections: [
    { title: `Why normalize`, body: `<p><b>Normalization</b> is the process of structuring tables so each fact is stored once. When a fact is duplicated, you get <b>anomalies</b>: an <em>update anomaly</em> (change a customer's tier in one row, forget another, now the data disagrees), an <em>insertion anomaly</em> (you cannot record a product's category until an order for it exists), and a <em>deletion anomaly</em> (deleting the last order for a product also erases the product).</p>
<p>The normal forms are defined in terms of <b>functional dependencies</b>. A functional dependency <code>X → Y</code> means: whenever two rows agree on the attributes in X, they must agree on Y. "X determines Y." Normalization works by ensuring every non-trivial dependency is a dependency <em>on a key</em>, not on some other column.</p>
<p><b>Update anomaly example:</b> if <code>payment</code> stores <code>wallet_owner_email</code>, changing the owner's email requires updating every payment row — miss one and reports disagree. The fix is to store email only on <code>wallet</code> and join when needed.</p>` },
    { title: `First normal form (1NF)`, body: `<p><b>1NF</b> requires that every column holds a single atomic value and every row is unique. No repeating groups, no arrays stuffed into one cell, no <code>phone1, phone2, phone3</code> columns. A customer with three phone numbers becomes three rows in a <code>wallet_contact_method</code> child table. 1NF is the precondition — higher normal forms only make sense once repeating groups are gone.</p>
<pre>-- VIOLATION: repeating groups
-- wallet: id | phone1 | phone2 | phone3

-- 1NF: one contact value per row
CREATE TABLE wallet_contact_method (
  id          BIGSERIAL PRIMARY KEY,
  wallet_id   TEXT NOT NULL REFERENCES wallet(id),
  type        TEXT NOT NULL,  -- EMAIL, PHONE
  value       TEXT NOT NULL,
  UNIQUE (wallet_id, type, value)
);</pre>` },
    { title: `Second and third normal form`, body: `<p><b>2NF</b> applies when the primary key is <b>composite</b>. It forbids a <b>partial dependency</b>: a non-key attribute must depend on the <em>whole</em> key, not part of it. In <code>order_item(order_id, product_id, qty, product_name)</code>, <code>product_name</code> depends only on <code>product_id</code> — half the key — so it violates 2NF. Move <code>product_name</code> to the <code>product</code> table.</p>
<p><b>3NF</b> forbids a <b>transitive dependency</b>: a non-key attribute must not depend on another non-key attribute. If <code>order(id, customer_id, customer_tier)</code> stores <code>customer_tier</code>, then <code>id → customer_id → customer_tier</code> — tier depends on the key only through <code>customer_id</code>. Keep <code>customer_tier</code> on <code>customer</code>. Informally: every non-key attribute depends on <em>the key, the whole key, and nothing but the key</em>.</p>
<pre>-- 3NF: tier lives on wallet; payment only references wallet_id
CREATE TABLE wallet (
  id            TEXT PRIMARY KEY,
  owner_email   TEXT,
  tier          TEXT NOT NULL,
  balance_minor BIGINT NOT NULL
);

CREATE TABLE payment (
  id            TEXT PRIMARY KEY,
  wallet_id     TEXT NOT NULL REFERENCES wallet(id),
  amount_minor  BIGINT NOT NULL
  -- join wallet to get tier; no tier column here
);</pre>` },
    { title: `Boyce–Codd normal form (BCNF)`, body: `<p><b>BCNF</b> is stricter than 3NF: for every non-trivial functional dependency <code>X → Y</code>, <code>X</code> must be a <b>superkey</b> (a set of columns that uniquely identifies a row). 3NF allows a narrow exception when <code>Y</code> is part of a candidate key; BCNF removes it.</p>
<p>Classic case: overlapping candidate keys in a scheduling table — dependencies <code>(student, subject) → instructor</code> and <code>instructor → subject</code>. The table can be 3NF but not BCNF because <code>instructor</code> is not a superkey. Decompose into <code>teaches(instructor, subject)</code> and <code>enrolled(student, instructor)</code>.</p>
<pre>-- BCNF: fee determined by merchant_id (the key) — one row per merchant
CREATE TABLE merchant (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  fee_bps      INT NOT NULL
);

-- If fee varies by effective date, fee_bps is not determined by id alone —
-- decompose into merchant + merchant_fee_schedule(merchant_id, fee_bps, effective_date)
CREATE TABLE merchant_fee_schedule (
  id            BIGSERIAL PRIMARY KEY,
  merchant_id   TEXT NOT NULL REFERENCES merchant(id),
  fee_bps       INT NOT NULL,
  effective_date DATE NOT NULL
);</pre>` },
    { title: `How far to normalize in practice`, body: `<p>Normalize to <b>3NF/BCNF by default</b> for transactional (OLTP) schemas like a payment ledger — correctness depends on one authoritative copy of each fact. The cost is that reads may need joins.</p>
<p>BCNF decomposition is not always free: it can be <b>non-dependency-preserving</b>, meaning some dependency must be enforced by a trigger or application check instead of a single-table constraint. When a specific read path is hot and joins hurt, deliberately <b>denormalize</b> — but on top of a correct normalized core, not by accident.</p>
<p>The normalized core below keeps balance on <code>wallet</code>, payment amounts on <code>payment</code>, and ledger lines linked to both — each fact in exactly one authoritative place. Denormalize only measured hot paths (e.g. a cached balance column) after profiling, not upfront.</p>
<pre>-- Normalized core: each fact in one place
CREATE TABLE wallet (id TEXT PRIMARY KEY, balance_minor BIGINT NOT NULL);
CREATE TABLE payment (id TEXT PRIMARY KEY, wallet_id TEXT REFERENCES wallet(id), amount_minor BIGINT);
CREATE TABLE ledger_entry (
  id BIGSERIAL PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallet(id),
  payment_id TEXT REFERENCES payment(id),
  amount_minor BIGINT NOT NULL
);</pre>` },
  ],
  related: ["er-modeling", "denormalization-patterns", "primary-foreign-keys"],
});

export const meta = topic.meta;
export const content = topic.content;
