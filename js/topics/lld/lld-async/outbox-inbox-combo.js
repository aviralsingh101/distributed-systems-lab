// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const OUTBOX_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Outbox on the producer, inbox on the consumer">
  <defs><marker id="fig-outbox-inbox-combo-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="150" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Producer (one DB txn)</text>
  <rect x="40" y="30" width="100" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="90" y="52" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">business row</text>
  <rect x="40" y="80" width="100" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="90" y="102" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">outbox row</text>
  <rect x="30" y="20" width="120" height="106" rx="8" fill="none" stroke="#2a3350" stroke-width="1" stroke-dasharray="4 3"/>
  <rect x="250" y="55" width="90" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="295" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">relay</text>
  <text x="295" y="86" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">poll/CDC</text>
  <rect x="410" y="55" width="90" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="455" y="79" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">broker</text>
  <rect x="570" y="30" width="120" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="630" y="52" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">inbox (dedup)</text>
  <rect x="570" y="80" width="120" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="630" y="102" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">apply once</text>
  <rect x="560" y="20" width="140" height="106" rx="8" fill="none" stroke="#2a3350" stroke-width="1" stroke-dasharray="4 3"/>
  <text x="630" y="140" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Consumer (dedup by event_id)</text>
  <line x1="140" y1="98" x2="248" y2="78" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-outbox-inbox-combo-arr)"/>
  <line x1="340" y1="75" x2="408" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-outbox-inbox-combo-arr)"/>
  <line x1="500" y1="75" x2="568" y2="60" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-outbox-inbox-combo-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "outbox-inbox-combo",
  title: "Outbox + Inbox Combo",
  category: "lld-async",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Pair a transactional outbox on the producer with a dedup inbox on the consumer to get reliable, effectively-exactly-once message handoff between services.`,
  figures: [
    { id: "outbox-inbox", svg: OUTBOX_SVG, caption: "The outbox commits the event atomically with the business row; a relay ships it to the broker; the inbox dedupes on event_id so the consumer applies each event exactly once." },
  ],
  sections: [
    { title: `The dual-write problem`, body: `<p>A service that must both <em>update its database</em> and <em>publish an event</em> faces the <b>dual-write problem</b>: two separate systems (DB and broker) with no shared transaction. If the DB commits but the publish fails, downstream never learns; if the publish succeeds but the DB rolls back, you announced something that never happened. The <b>outbox + inbox combo</b> makes the whole handoff reliable — the producer never loses an event, and the consumer never applies one twice.</p>` },
    { title: `Producer side — the transactional outbox`, figureAfter: "outbox-inbox", body: `<p>Instead of publishing directly, the producer writes the event into an <b>outbox table in the same database transaction</b> as the business change. Because it is one local ACID transaction, the business row and the event commit or roll back together — no dual write.</p>
<ol>
<li>In one transaction: update the <b>Ledger</b> row <em>and</em> insert a <code>PaymentCaptured</code> row into <code>outbox</code>.</li>
<li>A separate <b>relay</b> polls the outbox (or tails the DB log via CDC/Debezium) and publishes unsent rows to the broker.</li>
<li>The relay marks rows as published after the broker acks; on crash it re-publishes, giving <b>at-least-once</b> emission.</li>
</ol>
<p>The outbox guarantees <em>no lost events</em>, but because the relay can re-publish, it produces duplicates — which is where the inbox comes in.</p>` },
    { title: `Consumer side — the inbox / dedup`, body: `<p>The <b>inbox</b> makes the consumer idempotent. Each event carries a unique <code>event_id</code>. Before applying an event the consumer records that id in an <b>inbox table</b> using a uniqueness constraint, inside the same transaction as the state change it performs:</p>
<ol>
<li>Begin transaction.</li>
<li>Insert <code>event_id</code> into <code>inbox</code>; if it already exists, the insert fails → this is a duplicate, skip it.</li>
<li>Apply the business effect and commit atomically with the inbox insert.</li>
</ol>
<p>Because the dedup marker and the effect commit together, a redelivered event is safely ignored, giving <b>effectively-once</b> processing on top of an at-least-once broker.</p>` },
    { title: `Why the combo, and its costs`, body: `<p>Outbox alone guarantees delivery but still duplicates; inbox alone dedupes but a producer can still lose events on a dual-write failure. <b>Together</b> they give end-to-end exactly-once <em>effects</em> without distributed transactions or 2PC — each side does only local, transactional work.</p>
<p>The costs are real: extra tables and a relay to operate, added latency (poll interval or CDC lag), and inbox/outbox tables that need pruning. Reach for the full combo on high-value flows where both loss and duplication are unacceptable — money movement, order state, ledger updates. For lower-stakes events, an outbox or a plain idempotent consumer may be enough.</p>
<pre>// --- PRODUCER: @Transactional outbox (Order Service DB) ---
@Service
public class PaymentCaptureService {
    @Transactional
    public Payment capture(CapturePaymentCommand cmd) {
        Payment payment = paymentRepo.save(Payment.create(cmd));
        ledger.debit(cmd.walletId(), cmd.amount());
        outbox.save(OutboxEntity.paymentCaptured(payment));
        return payment;
    }
}

@Component
public class OutboxRelay {
    @Scheduled(fixedDelay = 200)
    @Transactional
    public void relay() {
        outbox.claimUnpublished(50).forEach(row -&gt; {
            kafka.send("payment.captured", row.getPaymentId().toString(), row.getPayload()).join();
            row.setPublishedAt(Instant.now());
        });
    }
}</pre>
<pre>// --- CONSUMER: @Transactional inbox dedup (Wallet Service DB) ---
@Service
public class WalletCreditHandler {
    @KafkaListener(topics = "payment.captured", groupId = "wallet-loyalty")
    @Transactional
    public void apply(PaymentCapturedEvent event) {
        try {
            inbox.save(new InboxEntity(event.eventId(), "wallet-loyalty"));
        } catch (DataIntegrityViolationException dup) {
            return; // duplicate — safe no-op
        }
        loyalty.credit(event.walletId(), event.amountCents() / 100);
    }
}</pre>` },
  ],
  related: ["transactional-outbox", "inbox-pattern", "exactly-once", "api-idempotency", "cdc"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("outbox-inbox-combo", stage, panel, stageEl);
}
