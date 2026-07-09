// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "deduplication", title: "Deduplication", category: "idempotency" };

export const content = {
  oneliner: `Store the ids of requests or events you have already handled, and drop any repeat — the consumer-side mechanism that turns at-least-once delivery into single application.`,
  archetype: "pattern",
  sections: [
    { title: `What deduplication is`, body: `<p><b>Deduplication</b> is the consumer-side technique for making duplicate messages harmless: remember what you have already processed and ignore anything you have seen before. Where an <b>idempotency key</b> is supplied by a client on a request, dedup usually keys off an <b>event id</b> or message id inside a stream. It is the concrete way an "idempotent consumer" is built, and therefore the mechanism behind exactly-once <em>effects</em> on top of at-least-once delivery.</p>` },
    { title: `Structure: the dedup store`, body: `<p>At its core is a set of already-seen ids and a rule for consulting it before applying an effect. The design choices are what make it correct:</p>
<ul>
<li><b>The id must be stable and unique per logical event</b>, assigned at production time. A broker offset or a per-delivery id is useless for dedup because a redelivery gets a new one; you need an id that is identical across all deliveries of the same event.</li>
<li><b>The store</b> is typically a table with a unique constraint on the id, or a fast key-value store (Redis) with per-key TTL. A unique constraint is attractive because it also serializes concurrent duplicates for you.</li>
<li><b>The check and the effect must be atomic.</b> Record the id in the <em>same transaction</em> that applies the effect. Otherwise a crash between "did the work" and "recorded the id" lets a redelivery redo the work.</li>
</ul>
<pre>@Entity
@Table(name = "dedup_inbox",
       uniqueConstraints = @UniqueConstraint(columnNames = "event_id"))
public class DedupInboxEntry {
    @Id @GeneratedValue private Long id;
    @Column(name = "event_id", nullable = false) private String eventId;
    private String walletId;
    private Instant processedAt;
}

@Repository
public interface DedupInboxRepository extends JpaRepository&lt;DedupInboxEntry, Long&gt; {
    @Modifying
    @Query(value = """
        INSERT INTO dedup_inbox (event_id, wallet_id, processed_at)
        VALUES (:eventId, :walletId, :now)
        ON CONFLICT (event_id) DO NOTHING
        """, nativeQuery = true)
    int tryInsert(@Param("eventId") String eventId,
                  @Param("walletId") String walletId,
                  @Param("now") Instant now);
}</pre>` },
    { title: `Processing flow`, body: `<ol>
<li>Receive a message and extract its event id.</li>
<li>Attempt to record the id (e.g. <code>INSERT ... ON CONFLICT DO NOTHING</code>) as part of the transaction that will perform the effect.</li>
<li>If the insert <b>succeeds</b>, this is the first time — apply the effect (credit the ledger) and commit both together.</li>
<li>If the insert <b>conflicts</b>, you have already processed this id — skip the effect and acknowledge the message so the broker stops redelivering it.</li>
</ol>
<p>Folding the dedup insert and the business write into one commit is the whole trick: the id is present if and only if the effect happened.</p>
<pre>// Dedup consumer — Kafka listener with atomic check-and-effect
@Component
public class LedgerDedupConsumer {
    private final DedupInboxRepository inbox;
    private final WalletRepository wallets;
    private final LedgerRepository ledger;

    @KafkaListener(topics = "wallet.debits", groupId = "ledger-service")
    @Transactional
    public void onDebitEvent(ConsumerRecord&lt;String, WalletDebitEvent&gt; record,
                             Acknowledgment ack) {
        WalletDebitEvent evt = record.value();

        if (inbox.tryInsert(evt.eventId(), evt.walletId(), Instant.now()) == 0) {
            ack.acknowledge();  // duplicate delivery — skip effect
            return;
        }

        Wallet wallet = wallets.findById(evt.walletId()).orElseThrow();
        wallet.debit(evt.amountCents());
        wallets.save(wallet);

        ledger.recordDebit(evt.walletId(), evt.amountCents(), evt.eventId());
        ack.acknowledge();
    }
}</pre>
<pre>// Alternative: unique constraint + exception catch
@Service
public class WalletEventDeduplicator {
    private final DedupInboxRepository inbox;
    private final WalletRepository wallets;

    @Transactional
    public void onDebitEvent(WalletDebitEvent evt) {
        try {
            inbox.save(new DedupInboxEntry(
                evt.eventId(), evt.walletId(), Instant.now()));
        } catch (DataIntegrityViolationException e) {
            return; // duplicate delivery — skip
        }

        Wallet wallet = wallets.findById(evt.walletId()).orElseThrow();
        wallet.debit(evt.amountCents());
        wallets.save(wallet);
    }
}</pre>` },
    { title: `The retention trade-off`, body: `<p>You cannot remember every id forever, so dedup state has a <b>window</b> — a TTL or a bounded log. This is a direct trade-off: the window must be at least as long as the maximum time a duplicate could arrive (the broker's retry/retention horizon, plus consumer downtime). Too short and a late redelivery slips past dedup and double-applies; too long and the store grows without bound. Common approaches: a TTL sized to the redelivery window, a rolling set of recent ids, or probabilistic structures (a Bloom filter as a fast pre-check backed by the authoritative store). For streaming, a per-partition high-water offset can dedup everything at or below it cheaply.</p>` },
    { title: `Where it fits and pitfalls`, body: `<p>Use deduplication anywhere you consume an at-least-once stream and the effect must not repeat — ledger postings, notifications, inventory changes. Pair it with <b>idempotency keys</b> at the API edge and it forms the consumer half of exactly-once effects. Common pitfalls: deduping on an unstable id (offset instead of event id) so retries evade it; a race where two duplicates both pass a non-atomic "check then insert" (fix with a unique constraint); a too-small window; and forgetting that an effect touching an external system needs that system to be idempotent too, since your local dedup cannot roll back a third-party call.</p>` },
  ],
  related: ["idempotency-key", "exactly-once", "duplicate-events", "missing-events", "out-of-order", "consumer-rebalancing"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("deduplication", stage, panel, stageEl);
}
