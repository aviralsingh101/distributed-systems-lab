// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const INBOX_SVG = `<svg viewBox="0 0 560 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Idempotent consumer inbox flow"><defs><marker id="fig-inbox-pattern-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="59" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Event Queue</text><text x="59" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">delivers &#8805;1x</text><rect x="140" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="185" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Consumer</text><text x="185" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">check event_id</text><rect x="266" y="24" width="96" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="314" y="45" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">INSERT inbox</text><rect x="266" y="72" width="96" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="314" y="93" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">apply effect</text><rect x="398" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="443" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">COMMIT</text><text x="443" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">one txn</text><line x1="104" y1="65" x2="138" y2="65" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-inbox-pattern-arr)"/><line x1="230" y1="60" x2="264" y2="43" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-inbox-pattern-arr)"/><line x1="230" y1="70" x2="264" y2="87" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-inbox-pattern-arr)"/><line x1="362" y1="65" x2="396" y2="65" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-inbox-pattern-arr)"/><text x="314" y="16" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">UNIQUE(event_id) — duplicate insert fails, effect skipped</text></svg>`;

const topic = makeTopic({
  id: "inbox-pattern",
  title: "Inbox / Idempotent Consumer",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Make a consumer safe under at-least-once delivery by recording every processed message id and applying the effect only once.",
  sections: [
    {
      title: "Why duplicates are guaranteed, not rare",
      body: `<p>Every practical broker (Kafka, SQS, RabbitMQ) delivers <b>at-least-once</b>. A consumer that reads a message, applies its effect, then crashes before committing its offset will receive the same message again on restart. Network timeouts, consumer-group rebalances, and producer retries (including a <b>transactional outbox</b> relay) all redeliver. So a payment event like <code>PaymentCaptured</code> can arrive two, three, or ten times.</p>
<p>If the handler naively credits a Wallet on each delivery, the customer is credited multiple times for one payment. The <b>inbox pattern</b> (also called the idempotent consumer) makes redelivery harmless by remembering which message ids it has already applied.</p>`,
    },
    {
      title: "Structure — the inbox table",
      body: `<p>The consumer owns a dedup table in its own database, keyed by the message's stable identity:</p>
<p><code>CREATE TABLE inbox (message_id UUID PRIMARY KEY, consumer VARCHAR(64), processed_at TIMESTAMPTZ DEFAULT now());</code></p>
<p>The key is the producer-assigned <code>event_id</code> (or an idempotency key carried in the message header), <em>not</em> the broker offset — offsets change across topics and replays. The <code>PRIMARY KEY</code> / <code>UNIQUE</code> constraint is the actual dedup mechanism: a second insert of the same id fails at the database, which is atomic and race-free even with many parallel workers.</p>`,
    },
    {
      title: "Step-by-step flow",
      figureAfter: "inbox-flow",
      body: `<p>The core trick is to insert the inbox row and apply the business effect in the <b>same local transaction</b>:</p>
<ol>
<li>Consumer receives the message and reads its <code>event_id</code>.</li>
<li>Open a DB transaction. <code>INSERT INTO inbox (message_id, consumer) VALUES (...)</code>.</li>
<li>If the insert violates the unique constraint, this is a duplicate — roll back, acknowledge the message, and stop. The effect already ran on the first delivery.</li>
<li>If the insert succeeds, apply the business effect (credit the Wallet, update the Ledger) in the same transaction.</li>
<li><code>COMMIT</code>. Now the "seen" marker and the effect are durable together, then acknowledge the broker.</li>
</ol>
<p>Because step 4 shares the transaction with step 2, you can never end up having applied the effect without recording the id, or vice versa.</p>
<pre>// --- Inbox dedup table: PRIMARY KEY on message_id ---
@Entity
@Table(name = "inbox")
public class InboxEntity {
    @Id
    @Column(name = "message_id")
    private UUID messageId;
    @Column(nullable = false, length = 64)
    private String consumer;
    @Column(name = "processed_at")
    private Instant processedAt;
}

public interface InboxRepository extends JpaRepository&lt;InboxEntity, UUID&gt; {}</pre>
<pre>// --- Wallet consumer: inbox INSERT + loyalty credit in one transaction ---
@Service
public class PaymentCapturedHandler {
    private final InboxRepository inbox;
    private final LoyaltyRepository loyalty;

    @KafkaListener(topics = "payment.events", groupId = "wallet-loyalty")
    @Transactional
    public void onPaymentCaptured(PaymentCapturedEvent event) {
        try {
            inbox.save(new InboxEntity(event.eventId(), "wallet-loyalty", Instant.now()));
        } catch (DataIntegrityViolationException dup) {
            return; // duplicate delivery — effect already applied, ack and exit
        }
        loyalty.creditPoints(event.walletId(), event.amountCents() / 100);
    }
}</pre>`,
    },
    {
      title: "Failure windows to reason about",
      body: `<p>Crash <em>after</em> commit but <em>before</em> broker ack → redelivery finds the inbox row and safely skips. Crash <em>during</em> the transaction → nothing committed, redelivery reprocesses cleanly. The one thing you must not do is ack the broker before the commit, or a crash loses the effect entirely.</p>
<p>The inbox is the mirror image of the <b>transactional outbox</b>: outbox gives at-least-once publish on the producer, inbox gives effectively-once processing on the consumer. Together they turn a fragile chain into a reliable one.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> tolerates any at-least-once broker with a vanilla RDBMS; the unique constraint handles concurrency without distributed locks; simple to test by replaying the same message.</p>
<p><b>Cons:</b> the inbox table grows and needs periodic pruning (delete rows older than the broker's max redelivery window); the effect and the inbox must live in the <em>same</em> database for the shared transaction — a handler that writes to an external system instead needs an idempotency key on that system. Message ids must be stable end-to-end; a producer that regenerates ids on retry defeats dedup.</p>
<p><b>Use when:</b> handlers are not naturally idempotent (credits, sends, state increments). <b>Skip when:</b> the effect is already idempotent by nature (an upsert to a known key with no accumulation).</p>`,
    },
  ],
  figures: [
    { id: "inbox-flow", svg: INBOX_SVG, caption: "Idempotent consumer: the inbox insert and the business effect commit in one transaction; a duplicate event_id fails the unique constraint and the effect is skipped." },
  ],
  related: ["transactional-outbox", "outbox-inbox-combo", "idempotency-key", "exactly-once", "deduplication"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("inbox-pattern", stage, panel, stageEl);
}
