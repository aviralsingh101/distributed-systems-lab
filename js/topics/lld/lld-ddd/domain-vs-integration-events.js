// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const EV_SVG = `<svg viewBox="0 0 720 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Domain vs integration events">
  <defs><marker id="fig-domain-vs-integration-events-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="35" width="300" height="140" rx="10" fill="none" stroke="#3ddc97" stroke-width="1.6" stroke-dasharray="5 4"/>
  <text x="180" y="55" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">Payments context</text>
  <rect x="70" y="70" width="100" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="120" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Aggregate</text>
  <rect x="200" y="70" width="100" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/><text x="250" y="90" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">handler</text>
  <line x1="170" y1="85" x2="198" y2="85" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-domain-vs-integration-events-arr)"/>
  <text x="180" y="130" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">domain event: in-process,</text>
  <text x="180" y="146" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">synchronous, rich objects</text>
  <rect x="470" y="70" width="220" height="60" rx="8" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/>
  <text x="580" y="94" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Ledger / Notification</text>
  <text x="580" y="112" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">other contexts</text>
  <line x1="300" y1="85" x2="468" y2="95" stroke="#7c5cff" stroke-width="1.6" marker-end="url(#fig-domain-vs-integration-events-arr)"/>
  <text x="390" y="72" text-anchor="middle" fill="#7c5cff" font-size="9" font-family="system-ui">integration event via broker</text>
  <text x="580" y="160" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">versioned contract, async, flat DTO</text>
</svg>`;

const topic = makeTopic({
  id: "domain-vs-integration-events",
  title: "Domain vs Integration Events",
  category: "lld-ddd",
  track: "lld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `Domain events communicate inside one bounded context; integration events are a versioned contract published to others — conflating them couples your services to your internals.`,
  sections: [
    { title: `Two kinds of "event"`, body: `<p>"Event" is overloaded in event-driven systems. DDD distinguishes two kinds that live at different scopes and have opposite design constraints. A <b>domain event</b> records something meaningful that happened <em>within</em> a bounded context ("FundsDebited"). An <b>integration event</b> announces that fact to <em>other</em> contexts or services ("PaymentCompleted"). They look similar but must not be the same object — and understanding how it works for each keeps your internal model from leaking into your public contract.</p>` },
    { title: `Domain events`, figureAfter: "ev", body: `<p>Domain events are internal. They are raised by an aggregate to signal a state change and consumed by handlers <em>inside the same context</em>, usually in-process.</p>
<pre>// Domain event — rich types, never leaves the Payments context
public record WalletDebited(
    String walletId,
    Money amount,
    String paymentId,
    Instant occurredAt
) implements DomainEvent {}

public class Wallet {  // aggregate root
    private final List&lt;DomainEvent&gt; events = new ArrayList&lt;&gt;();

    public void debit(Money amount, String paymentId) {
        if (balance.compareTo(amount) &lt; 0) {
            throw new InsufficientFundsException(walletId);
        }
        balance = balance.subtract(amount);
        events.add(new WalletDebited(walletId, amount, paymentId, Instant.now()));
    }
}

@Component
public class LedgerProjectionHandler {
    @EventListener
    public void on(WalletDebited evt) {
        ledgerRepo.recordDebit(evt.walletId(), evt.amount(), evt.paymentId());
    }
}</pre>
<ul>
<li><b>Scope:</b> one bounded context; never leave it.</li>
<li><b>Delivery:</b> often synchronous and in the same transaction (or immediately after commit) — an in-memory dispatcher, not a broker.</li>
<li><b>Shape:</b> may carry rich domain types and fine-grained detail, because producer and consumers share the same model.</li>
<li><b>Naming:</b> past tense, in the ubiquitous language — <code>OrderPlaced</code>, <code>WalletDebited</code>.</li>
</ul>
<p>They decouple aggregates within a context: the Order aggregate raises <code>OrderPlaced</code> and a handler updates a read model, without the Order knowing who listens.</p>
<pre>// Domain event: rich, in-process, same transaction boundary
public record PaymentCaptured(
    PaymentId paymentId,
    PayerId payerId,
    Money amount,
    Instant capturedAt
) implements DomainEvent {}

@Component
class LedgerEntryHandler {
    @EventListener
    public void on(PaymentCaptured event) {
        ledger.recordCredit(event.paymentId(), event.amount()); // same context
    }
}</pre>` },
    { title: `Integration events`, body: `<p>Integration events cross the boundary and are therefore a <b>published contract</b>.</p>
<pre>// Integration event — flat DTO, versioned, published to Kafka
public record PaymentCompletedV1(
    String schemaVersion,   // "1.0"
    String paymentId,
    String walletId,
    long amountCents,
    String currency,
    String status,
    Instant completedAt
) {}

@Component
public class PaymentIntegrationPublisher {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(WalletDebited domainEvt) {
        PaymentCompletedV1 integration = new PaymentCompletedV1(
            "1.0",
            domainEvt.paymentId(),
            domainEvt.walletId(),
            domainEvt.amount().amountMinor(),
            domainEvt.amount().currency(),
            "CAPTURED",
            domainEvt.occurredAt()
        );
        outbox.enqueue("payments.completed", integration);
    }
}</pre>
<ul>
<li><b>Scope:</b> consumed by other services/contexts you may not control.</li>
<li><b>Delivery:</b> asynchronous over a broker (Kafka, SNS/SQS), reliably — typically via the <b>transactional outbox</b> so publishing is atomic with the state change.</li>
<li><b>Shape:</b> a stable, <b>versioned</b>, flat DTO of primitives and IDs — never your internal entities. Consumers depend on it, so schema evolution must be backward-compatible.</li>
<li><b>Granularity:</b> coarser and more business-meaningful (<code>PaymentCompleted</code>), not a stream of every internal state tick.</li>
</ul>
<pre>// Integration event: flat DTO, versioned, crosses the boundary
public record PaymentCompletedV1(
    String eventType,       // "PaymentCompleted"
    int schemaVersion,      // 1
    String paymentId,
    String payerId,
    long amountMinor,
    String currency,
    String capturedAt       // ISO-8601 string — no Money type
) {
    public static PaymentCompletedV1 from(PaymentCaptured domain) {
        return new PaymentCompletedV1(
            "PaymentCompleted", 1,
            domain.paymentId().value(),
            domain.payerId().value(),
            domain.amount().toMinorUnits(),
            domain.amount().currency().getCurrencyCode(),
            domain.capturedAt().toString()
        );
    }
}</pre>` },
    { title: `Why the distinction matters`, body: `<p>Publishing raw domain events across the boundary is a classic mistake: every consumer becomes coupled to your internal model, so a refactor that renames a field or splits an entity breaks other teams. The correct flow is a translation step — a handler listens to internal domain events and <em>maps</em> them into a deliberately-designed integration event that goes to the outbox and then the broker. This keeps the internal model free to change while the external contract stays stable, exactly the same reasoning as an anti-corruption layer on the inbound side. Rule of thumb: domain events are fine-grained, in-process, and disposable; integration events are coarse, durable, versioned, and treated with the same care as a public API.</p>
<pre>// Translation handler: domain event → integration event → outbox
@Component
class PaymentIntegrationPublisher {
    private final OutboxRepository outbox;

    @EventListener
    @Transactional
    public void on(PaymentCaptured domainEvent) {
        PaymentCompletedV1 integration = PaymentCompletedV1.from(domainEvent);
        outbox.enqueue("payments.completed", integration); // atomic with DB commit
    }
}

// NEVER publish PaymentCaptured directly to Kafka — consumers coupled to your model
// ALWAYS publish PaymentCompletedV1 — stable, versioned contract</pre>` },
  ],
  figures: [
    { id: "ev", svg: EV_SVG, caption: "A domain event stays inside the context; a handler translates it into a versioned integration event published to other contexts via a broker." },
  ],
  related: ["bounded-context", "aggregate-root", "anti-corruption-code-boundary", "transactional-outbox"],
});

export const meta = topic.meta;
export const content = topic.content;
