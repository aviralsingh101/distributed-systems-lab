// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "exactly-once", title: "Exactly Once", category: "idempotency" };

const EO_SVG = `<svg viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="At-least-once delivery plus idempotent consumer equals effectively-once">
  <defs><marker id="fig-exactly-once-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="60" width="150" height="44" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="95" y="80" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Broker</text>
  <text x="95" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">at-least-once</text>
  <rect x="300" y="60" width="170" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.8"/>
  <text x="385" y="80" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Idempotent consumer</text>
  <text x="385" y="95" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">dedup by event_id</text>
  <rect x="560" y="60" width="140" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="630" y="80" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Ledger</text>
  <text x="630" y="95" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">effect once</text>
  <line x1="170" y1="74" x2="298" y2="82" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-exactly-once-arr)"/>
  <line x1="170" y1="90" x2="298" y2="92" stroke="#ff6b6b" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-exactly-once-arr)"/>
  <text x="235" y="52" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">delivered 2x</text>
  <line x1="470" y1="82" x2="558" y2="82" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-exactly-once-arr)"/>
  <text x="360" y="135" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Two deliveries in, one effect out — "effectively once"</text>
</svg>`;

export const content = {
  oneliner: `There is no true exactly-once delivery; what systems actually deliver is at-least-once delivery plus an idempotent consumer, which together give exactly-once effects.`,
  archetype: "concept",
  figures: [
    { id: "eo-flow", svg: EO_SVG, caption: "The broker may deliver an event more than once; the idempotent consumer deduplicates by a stable id so the downstream effect (a ledger credit) happens exactly once." },
  ],
  sections: [
    { title: `Why exactly-once delivery is impossible`, body: `<p>"Exactly-once delivery" is one of the most misunderstood promises in distributed systems, because as a <em>delivery</em> guarantee it cannot exist. Consider a sender and receiver separated by an unreliable network. After sending a message the sender waits for an ack. If the ack does not come, it faces an unanswerable question: was the message lost (resend it — risk a duplicate) or was only the ack lost (do not resend — risk losing it)? No protocol can distinguish these two cases with certainty, so every system must choose to err toward resending (at-least-once, duplicates possible) or not (at-most-once, loss possible). "Exactly once" as a delivery count is not achievable across a failure-prone channel — this is a consequence of the Two Generals problem.</p>` },
    { title: `The three delivery semantics`, body: `<ul>
<li><b>At-most-once.</b> Never resend. Simple and fast, but a lost message is gone. Fine for disposable telemetry, unacceptable for a payment.</li>
<li><b>At-least-once.</b> Resend until acknowledged. Nothing is lost, but the same message can arrive multiple times. This is the practical default for reliable systems.</li>
<li><b>Exactly-once (effects).</b> Not a delivery mode but an <em>outcome</em>: the observable effect happens once even though delivery may repeat. Achieved by combining at-least-once with deduplication.</li>
</ul>
<pre>// Producer stamps a stable event id at creation time — not per delivery
@Service
public class ChargeEventProducer {
    private final KafkaTemplate&lt;String, ChargeEvent&gt; kafka;

    public void publishCharge(ChargeCommand cmd) {
        ChargeEvent evt = new ChargeEvent(
            UUID.randomUUID().toString(),  // eventId — same on every redelivery
            cmd.walletId(),
            cmd.amountCents(),
            cmd.paymentId()
        );
        kafka.send("charges", cmd.paymentId(), evt);
    }
}

public record ChargeEvent(
    String eventId,      // stable dedup key
    String walletId,
    long amountCents,
    String paymentId
) {}</pre>` },
    { title: `How exactly-once effects actually work`, figureAfter: "eo-flow", body: `<p>The real formula is: <b>exactly-once processing = at-least-once delivery + an idempotent consumer</b>. The transport is allowed to deliver duplicates; the consumer makes reprocessing a no-op, so the net effect is single application. Concretely:</p>
<ol>
<li>The producer stamps each event with a <b>stable unique id</b> at creation time (not per delivery).</li>
<li>The broker delivers at-least-once — duplicates and redeliveries are expected.</li>
<li>The consumer checks whether it has already processed that id; if so it skips; if not it applies the effect and records the id — <b>in the same transaction as the effect</b> so a crash cannot separate them.</li>
</ol>
<p>Because the dedup record and the side effect commit together, a redelivery after a crash finds the id already present and does nothing. The customer's card is charged once no matter how many times the event is delivered.</p>
<pre>// Exactly-once consumer: at-least-once delivery + idempotent handler
@Component
public class ExactlyOnceChargeConsumer {
    private final ProcessedEventRepository processed;
    private final LedgerService ledger;

    @KafkaListener(topics = "charges")
    @Transactional
    public void consume(ConsumerRecord&lt;String, ChargeEvent&gt; record,
                        Acknowledgment ack) {
        ChargeEvent evt = record.value();

        // 1. Dedup insert — same transaction as ledger write
        if (!tryMarkProcessed(evt.eventId())) {
            ack.acknowledge(); // duplicate — safe to ack
            return;
        }

        // 2. Apply effect exactly once
        ledger.credit(evt.walletId(), evt.amount(), evt.paymentId());

        // 3. Ack only after commit (manual immediate ack mode)
        ack.acknowledge();
    }

    private boolean tryMarkProcessed(String eventId) {
        try {
            processed.save(new ProcessedEvent(eventId, Instant.now()));
            return true;
        } catch (DataIntegrityViolationException dup) {
            return false;
        }
    }
}

@Entity
@Table(name = "processed_events",
       uniqueConstraints = @UniqueConstraint(columnNames = "event_id"))
public class ProcessedEvent {
    @Id @GeneratedValue private Long id;
    @Column(name = "event_id", nullable = false) private String eventId;
    private Instant processedAt;

    public ProcessedEvent(String eventId, Instant processedAt) {
        this.eventId = eventId;
        this.processedAt = processedAt;
    }
}</pre>` },
    { title: `What Kafka's "exactly-once" really is`, body: `<p>Kafka advertises exactly-once semantics (EOS), and it is real — but note its scope. It combines an <b>idempotent producer</b> (sequence numbers per partition dedupe producer retries at the broker) with <b>transactions</b> that atomically write output records and commit consumer offsets together. This gives exactly-once for the <em>read-process-write within Kafka</em> loop. The moment your consumer touches an external system — charging a gateway, writing another database, sending an email — you are back to needing your own idempotency there, because Kafka cannot make a third-party side effect transactional. EOS narrows the problem; it does not abolish it.</p>` },
    { title: `Practical guidance`, body: `<p>Do not chase mythical exactly-once delivery or disable retries to avoid duplicates — that just trades duplicates for lost data. Instead, assume at-least-once and invest in <b>idempotent consumers</b>: unique event ids, a dedup/idempotency store, effects that are conditional or commutative, and the dedup write bound atomically to the effect. This is the same machinery as an idempotency key on an HTTP write and deduplication on an event stream. Done this way, duplicates become harmless and you get the exactly-once behavior users actually care about — the effect happening once.</p>` },
  ],
  related: ["idempotency-key", "deduplication", "duplicate-events", "missing-events", "consumer-rebalancing", "dead-letter-queue"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("exactly-once", stage, panel, stageEl);
}
