// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const KEY_SVG = `<svg viewBox="0 0 620 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Primary key and foreign key relationship between wallet and ledger_entry">
  <defs><marker id="fig-primary-foreign-keys-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="55" width="180" height="90" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="120" y="76" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">wallet</text>
  <text x="42" y="98" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="42" y="114" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">balance</text>
  <text x="42" y="130" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">currency</text>
  <rect x="400" y="40" width="190" height="120" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="495" y="61" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">ledger_entry</text>
  <text x="412" y="83" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace">PK id</text>
  <text x="412" y="99" fill="#ff6b6b" font-size="10" font-family="ui-monospace,monospace">FK wallet_id NOT NULL</text>
  <text x="412" y="115" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">amount</text>
  <text x="412" y="131" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">created_at</text>
  <line x1="210" y1="100" x2="398" y2="100" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-primary-foreign-keys-arr)"/>
  <text x="304" y="90" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">1 wallet : N entries</text>
  <text x="304" y="176" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">FK enforces: no entry may reference a non-existent wallet.</text>
</svg>`;

const topic = makeTopic({
  id: "primary-foreign-keys",
  title: "Primary / Foreign Keys",
  category: "lld-db",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Primary keys give each row a stable identity; foreign keys make the database itself enforce that references point at rows that exist.`,
  sections: [
    { title: `Primary keys and identity`, body: `<p>A <b>primary key</b> uniquely identifies each row; the database enforces uniqueness and NOT NULL, and builds an index on it. Every OLTP table should have one.</p>
<p>A <b>natural key</b> is a real-world identifier (email, ISO currency code); a <b>surrogate key</b> is system-generated (UUID, <code>BIGSERIAL</code>). Prefer surrogates for entity identity — natural values change and a changing PK ripples into every referencing FK.</p>
<pre>CREATE TABLE wallet (
  id            TEXT PRIMARY KEY,              -- surrogate UUID
  balance_minor BIGINT NOT NULL,
  currency      CHAR(3) NOT NULL,
  owner_email   TEXT UNIQUE                    -- natural key via UNIQUE, not PK
);</pre>` },
    { title: `Foreign keys and referential integrity`, figureAfter: "wallet-ledger-fk", body: `<p>A <b>foreign key</b> must match a primary (or unique) key in another table. Here is how enforcement works on every write:</p>
<ul>
<li><b>INSERT / UPDATE</b> on the child — engine checks that <code>wallet_id</code> exists in <code>wallet</code> before allowing the row.</li>
<li><b>DELETE</b> on the parent — engine applies the declared action (RESTRICT, CASCADE, SET NULL) on dependent rows.</li>
</ul>
<p>Without the constraint, a bug or bad backfill can leave dangling <code>wallet_id</code> values that break every join and every balance calculation, often discovered only during an incident.</p>
<pre>CREATE TABLE ledger_entry (
  id           BIGSERIAL PRIMARY KEY,
  wallet_id    TEXT NOT NULL REFERENCES wallet(id),
  amount_minor BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);</pre>
<p>That guarantee is what makes balance = SUM(ledger_entry.amount) trustworthy — every line provably belongs to a real wallet.</p>` },
    { title: `Referential actions on delete and update`, body: `<p>What happens when the referenced row is deleted or its key changes:</p>
<ul>
<li><b>RESTRICT / NO ACTION</b> — refuse delete while children exist. Safe default for financial data.</li>
<li><b>CASCADE</b> — delete children too. Convenient for truly owned data (<code>order</code> + <code>order_item</code> — deleting an order removes its lines), dangerous for auditable financial history.</li>
<li><b>SET NULL</b> — only when nullable FK and orphan children are meaningful.</li>
</ul>
<pre>CREATE TABLE payment (
  id           TEXT PRIMARY KEY,
  wallet_id    TEXT NOT NULL REFERENCES wallet(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL
);</pre>` },
    { title: `Composite and natural keys`, body: `<p>A <b>composite key</b> spans multiple columns — correct for junction tables: <code>PRIMARY KEY (order_id, product_id)</code>. Composite FKs reference composite PKs column-for-column.</p>
<p>Even with a surrogate PK, enforce natural uniqueness separately: <code>UNIQUE (wallet_id, idempotency_key)</code> prevents duplicate charge attempts for the same client retry key while keeping a narrow surrogate for foreign keys elsewhere.</p>
<pre>CREATE TABLE idempotency_key (
  wallet_id        TEXT NOT NULL REFERENCES wallet(id),
  idempotency_key  TEXT NOT NULL,
  payment_id       TEXT NOT NULL,
  PRIMARY KEY (wallet_id, idempotency_key)
);</pre>` },
    { title: `Practical notes`, body: `<p>Postgres indexes the PK but <em>not</em> FK columns automatically — add <code>CREATE INDEX ON ledger_entry(wallet_id)</code> for join performance. FKs add a small write-time check and lock the parent row; some high-throughput systems disable them and enforce in application code, but for a ledger keep them on.</p>
<pre>CREATE TABLE payment (
  id              TEXT PRIMARY KEY,
  wallet_id       TEXT NOT NULL REFERENCES wallet(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_minor    BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_wallet_id ON payment(wallet_id);
CREATE INDEX idx_payment_created_at ON payment(created_at);</pre>` },
  ],
  figures: [
    { id: "wallet-ledger-fk", svg: KEY_SVG, caption: "wallet.id is a primary key; ledger_entry.wallet_id is a NOT NULL foreign key referencing it, so every entry provably belongs to a real wallet." },
  ],
  related: ["er-modeling", "normal-forms-bcnf", "indexing-strategies"],
});

export const meta = topic.meta;
export const content = topic.content;
