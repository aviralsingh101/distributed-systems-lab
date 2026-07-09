// @article-v2
// @sim-lab
// @figure-handcrafted
import { makeTopic, paymentFlow, actors } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "transactional-outbox",
  title: "Transactional Outbox",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Atomically persist business data and an integration event in one DB transaction — then relay to the queue.",
  sections: [
    {
      title: "Motivation — the dual-write problem",
      body: `<p>Your service must update its database <i>and</i> notify other systems (Kafka, SQS), but those are two separate systems with no shared transaction. Commit DB and crash before publish → downstream never hears about the payment. Publish first and DB rolls back → consumers process phantom <code>payment.completed</code>.</p>
<p>The outbox does not pretend both writes are one global atomic operation. It makes a smaller promise: the business row and a durable <b>"please send this event"</b> record commit together in the same local ACID transaction.</p>`,
    },
    {
      title: "Structure",
      body: `<pre>CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ NULL
);
CREATE INDEX outbox_unpublished ON outbox (created_at)
  WHERE published_at IS NULL;</pre>
<p>Distinct from <b>2PC/XA</b> (fragile), <b>CDC</b> (Debezium — great for replication, less intentful for domain events), and <b>inbox pattern</b> on the consumer (dedup incoming). Outbox is producer-side reliability.</p>`,
    },
    {
      title: "Step-by-step flow",
      figureAfter: "outbox-flow",
      body: `<ol>
<li>Inside one <code>@Transactional</code>: <code>UPDATE ledger SET balance = ...</code></li>
<li>Same transaction: <code>INSERT INTO outbox (...)</code></li>
<li><code>COMMIT</code> — both or neither</li>
<li>Relay (separate process): <code>SELECT ... WHERE published_at IS NULL FOR UPDATE SKIP LOCKED</code></li>
<li>Publish to broker, then <code>UPDATE published_at</code> after ack</li>
</ol>
<div class="callout"><p><b>Key insight:</b> Outbox guarantees <em>at-least-once</em> to the broker, not exactly-once end-to-end. Consumers <b>must</b> be idempotent.</p></div>
<pre>// --- JPA entity mapped to the outbox table ---
@Entity
@Table(name = "outbox")
public class OutboxEntity {
    @Id
    private UUID id;
    @Column(name = "aggregate_id", nullable = false)
    private UUID paymentId;
    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;
    @Column(columnDefinition = "jsonb", nullable = false)
    private String payload;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "published_at")
    private Instant publishedAt;

    public static OutboxEntity paymentCaptured(Payment payment) {
        OutboxEntity row = new OutboxEntity();
        row.id = UUID.randomUUID();
        row.paymentId = payment.getId();
        row.eventType = "PaymentCaptured";
        row.payload = Json.write(Map.of(
            "event_id", row.id.toString(),
            "payment_id", payment.getId().toString(),
            "wallet_id", payment.getWalletId(),
            "amount_cents", payment.getAmountCents()
        ));
        row.createdAt = Instant.now();
        return row;
    }
}

public interface OutboxRepository extends JpaRepository&lt;OutboxEntity, UUID&gt; {
    @Query(value = """
        SELECT * FROM outbox
        WHERE published_at IS NULL
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT :batchSize
        """, nativeQuery = true)
    List&lt;OutboxEntity&gt; claimUnpublished(@Param("batchSize") int batchSize);
}</pre>
<pre>// --- Order Service: business write + outbox INSERT in one @Transactional ---
@Service
public class PaymentCaptureService {
    private final LedgerRepository ledger;
    private final OutboxRepository outbox;

    @Transactional
    public Payment capture(CapturePaymentCommand cmd) {
        Payment payment = Payment.create(cmd);
        ledger.debit(cmd.walletId(), cmd.amount(), payment.getId());
        outbox.save(OutboxEntity.paymentCaptured(payment));
        // COMMIT rolls back BOTH ledger debit and outbox row on any failure
        return payment;
    }
}</pre>
<pre>// --- OutboxRelay: separate Spring Boot process (not in the request path) ---
@Component
@EnableScheduling
public class OutboxRelay {
    private final OutboxRepository outbox;
    private final KafkaTemplate&lt;String, String&gt; kafka;

    @Scheduled(fixedDelay = 200)
    @Transactional
    public void publishBatch() {
        List&lt;OutboxEntity&gt; batch = outbox.claimUnpublished(50);
        for (OutboxEntity row : batch) {
            kafka.send("payment.events", row.getPaymentId().toString(), row.getPayload())
                 .get(); // block until broker ack
            row.setPublishedAt(Instant.now());
        }
    }
}</pre>`,
    },
    {
      title: "Relay options and operations",
      body: `<ul>
<li><b>Polling relay</b> — simple; adds 100ms–1s latency. Scale workers with <code>SKIP LOCKED</code>.</li>
<li><b>CDC relay</b> — Debezium on WAL; near-real-time; heavier ops.</li>
</ul>
<p>Alert on outbox oldest-unpublished age. Pause relay during broker maintenance without stopping writes. Store event type + ids in payload, not full snapshots.</p>`,
    },
    {
      title: "Payment platform example",
      body: `<p>On <code>POST /v1/pay</code>, Order Service opens a transaction: debits Wallet in Ledger, inserts <code>outbox { event_type: PaymentCaptured, payment_id }</code>, commits. Within 200ms the relay publishes to Event Queue; Wallet consumer checks inbox for <code>payment_id</code>, applies loyalty credit once.</p>
<p>Integration test: commit payment + outbox, kill relay before publish, restart relay, assert Event Queue receives exactly one processable message. Chaos: duplicate relay delivery, assert Wallet inbox dedups.</p>
<p>Partition Kafka by <code>wallet_id</code> when Wallet must see ordered payment events. Archive published outbox rows older than 7 days to cold storage for audit.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> atomic local guarantee — if payment row exists, publish intent exists. No distributed 2PC; works with any broker and vanilla RDBMS. Curated domain events (<code>PaymentCaptured</code>) unlike raw CDC row images. Backpressure visible via outbox depth metric.</p>
<p><b>Cons:</b> at-least-once to broker — mandatory idempotent consumers. Extra table, relay service, and monitoring. Poll-based relay adds latency vs synchronous publish. Per-aggregate ordering requires explicit <code>sequence</code> column design.</p>
<p><b>Use when:</b> microservice must not lose integration events after DB commit; you own the producer DB; downstream can deduplicate via inbox pattern or idempotency keys.</p>
<p><b>Avoid when:</b> no message broker; only need analytics replication (CDC to warehouse may suffice); hard exactly-once requirement without idempotent consumers.</p>`,
    },
  ],
  figures: [
    { id: "outbox-flow", svg: `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Transactional Outbox outbox"> <defs><marker id="fig-transactional-outbox-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <rect x="20" y="50" width="80" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="60" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order Svc</text><text x="60" y="80" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">txn</text> <rect x="130" y="35" width="70" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="165" y="47" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text><text x="165" y="63" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">UPDATE</text> <rect x="130" y="85" width="70" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="165" y="97" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Outbox</text><text x="165" y="113" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">INSERT</text> <rect x="240" y="60" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="285" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">COMMIT</text><text x="285" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">both</text> <rect x="360" y="60" width="80" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="400" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Relay</text><text x="400" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">poll</text> <rect x="470" y="60" width="70" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/> <text x="505" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text><text x="505" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Kafka</text> <line x1="100" y1="53" x2="128" y2="53" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-transactional-outbox-arr)"/> <line x1="100" y1="103" x2="128" y2="103" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-transactional-outbox-arr)"/> <line x1="200" y1="80" x2="238" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-transactional-outbox-arr)"/> <line x1="330" y1="80" x2="358" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-transactional-outbox-arr)"/> <line x1="440" y1="80" x2="468" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-transactional-outbox-arr)"/> <text x="165" y="28" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">single DB transaction</text> </svg>`, caption: `Transactional Outbox: business row and outbox row commit atomically; relay publishes asynchronously.` },
  ],
  related: ["exactly-once", "deduplication", "idempotency-key"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("transactional-outbox", stage, panel, stageEl);
}