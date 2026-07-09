// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const CQRS_SVG = `<svg viewBox="0 0 720 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CQRS command and query split">
  <defs><marker id="fig-cqrs-handler-separation-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="300" y="20" width="120" height="30" rx="5" fill="#1a2236" stroke="#93a1bd" stroke-width="1.4"/><text x="360" y="40" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">API</text>
  <rect x="60" y="80" width="240" height="34" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/><text x="180" y="101" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Command handler (write)</text>
  <rect x="420" y="80" width="240" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="540" y="101" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Query handler (read)</text>
  <line x1="330" y1="50" x2="200" y2="78" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-cqrs-handler-separation-arr)"/>
  <line x1="390" y1="50" x2="520" y2="78" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-cqrs-handler-separation-arr)"/>
  <text x="180" y="140" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">validate · mutate aggregate · emit event</text>
  <text x="540" y="140" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">project to DTO · no domain rules</text>
  <text x="360" y="175" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">writes change state · reads never do</text>
</svg>`;

const topic = makeTopic({
  id: "cqrs-handler-separation",
  title: "CQRS Handler Separation",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Split the model that changes state (commands) from the model that answers questions (queries), so each is optimized independently.`,
  sections: [
    { title: `The principle`, body: `<p><b>CQRS</b> (Command Query Responsibility Segregation) applies the command-query separation principle at the architectural level: <b>commands</b> change state and return nothing meaningful; <b>queries</b> return data and change nothing. Instead of one model serving both, you build two paths. A single model is pulled in opposite directions — writes want rich aggregates enforcing invariants, reads want flat, denormalized shapes for the screen — and trying to satisfy both produces a model that is mediocre at each. CQRS resolves the tension by separating the two responsibilities.</p>` },
    { title: `Handler separation — the lightweight form`, figureAfter: "cqrs", body: `<p>The most common, least risky form is <b>handler separation</b> within one service, one database:</p>
<pre>// WRITE path — command handler through aggregate
@Component
public class DebitWalletHandler {
    private final WalletRepository wallets;

    @Transactional
    public void handle(DebitWalletCommand cmd) {
        Wallet w = wallets.findById(cmd.walletId()).orElseThrow();
        w.debit(cmd.amount(), cmd.paymentId());
        wallets.save(w);
    }
}

// READ path — query handler bypasses domain, tuned SQL
@Component
public class WalletStatementQuery {
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public WalletStatementDto handle(GetWalletStatementQuery q) {
        List&lt;LedgerLineDto&gt; lines = jdbc.query("""
            SELECT payment_id, amount_cents, created_at
            FROM ledger_entries
            WHERE wallet_id = ?
            ORDER BY created_at DESC LIMIT ?
            """,
            (rs, row) -&gt; new LedgerLineDto(
                rs.getString("payment_id"),
                rs.getLong("amount_cents"),
                rs.getTimestamp("created_at").toInstant()
            ),
            q.walletId(), q.limit()
        );
        return new WalletStatementDto(q.walletId(), lines);
    }
}</pre>
<ul>
<li>A <b>command handler</b> takes a command (<code>DebitWallet</code>), loads the aggregate through a repository, invokes domain behavior that enforces invariants, persists it, and raises events. This path goes through the full domain model.</li>
<li>A <b>query handler</b> takes a query (<code>GetWalletStatement</code>) and returns a <b>read DTO</b> — often via a direct, tuned SQL projection that <em>bypasses the aggregates entirely</em>. There is no domain logic on the read side because reads change nothing to protect.</li>
</ul>
<p>This is the step that matters most: it keeps queries from dragging reporting concerns and join-heavy projections into your carefully-guarded write model.</p>
<pre>// Command side: mutates through aggregate, enforces invariants
@Component
class DebitWalletHandler {
    private final WalletRepository wallets;

    @Transactional
    public void handle(DebitWalletCommand cmd) {
        Wallet wallet = wallets.findById(cmd.walletId()).orElseThrow();
        wallet.debit(cmd.amount());          // domain rule: no negative balance
        wallets.save(wallet);
    }
}

// Query side: flat DTO, tuned SQL, no domain logic
@Component
class GetWalletStatementHandler {
    private final JdbcTemplate jdbc;

    public WalletStatementDto handle(GetWalletStatementQuery query) {
        return jdbc.queryForObject("""
            SELECT w.id, w.balance_minor, c.code AS currency,
                   COUNT(t.id) AS txn_count
            FROM wallets w
            JOIN currencies c ON w.currency_id = c.id
            LEFT JOIN transactions t ON t.wallet_id = w.id
            WHERE w.id = ?
            GROUP BY w.id, w.balance_minor, c.code
            """, WalletStatementMapper.INSTANCE, query.walletId());
    }
}</pre>` },
    { title: `Where it can go further`, body: `<p>Handler separation can escalate along a spectrum, and you should stop at the level your problem justifies:</p>
<ol>
<li><b>Separate models, one DB</b> — command objects and read DTOs differ, but both hit the same tables. Most apps need only this.</li>
<li><b>Separate read store</b> — a denormalized read database (materialized views, Elasticsearch) updated from write-side events. The read model becomes <b>eventually consistent</b> with the write model.</li>
<li><b>Full CQRS + event sourcing</b> — the write side stores events, and read models are projections. Powerful, but the highest complexity.</li>
</ol>` },
    { title: `Trade-offs`, body: `<p>Benefits: reads and writes scale and evolve independently (replicate the read store, add new projections without touching the write model), the write model stays focused purely on invariants, and each side is simpler in isolation. Costs: more moving parts, and once you introduce a separate read store you inherit <b>eventual consistency</b> — a user may not immediately see their own write, so the UI must account for it. The usual mistake is jumping straight to separate stores and event sourcing for a plain CRUD app; start at handler/model separation and only add asynchronous read models when read and write scaling or shapes genuinely diverge.</p>
<pre>record DebitWalletCommand(WalletId walletId, Money amount) {}
record GetWalletStatementQuery(WalletId walletId) {}

public record WalletStatementDto(
    String walletId, long balanceMinor, String currency, int txnCount
) {}

// Start here: one DB, separate handlers — 80% of CQRS benefit
// Escalate only when: read QPS &gt;&gt; write QPS, or screens need denormalized shapes</pre>` },
  ],
  figures: [
    { id: "cqrs", svg: CQRS_SVG, caption: "Commands flow through the domain model to change state; queries return DTOs via read-optimized projections that hold no business rules." },
  ],
  related: ["repository-pattern", "aggregate-root", "domain-vs-integration-events", "layered-architecture"],
});

export const meta = topic.meta;
export const content = topic.content;
