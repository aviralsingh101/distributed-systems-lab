// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const AGG_SVG = `<svg viewBox="0 0 720 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aggregate consistency boundary">
  <defs><marker id="fig-aggregate-root-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="40" y="35" width="330" height="150" rx="12" fill="none" stroke="#3ddc97" stroke-width="1.8" stroke-dasharray="6 4"/>
  <text x="205" y="55" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">Order aggregate — consistency boundary</text>
  <rect x="120" y="65" width="170" height="34" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/><text x="205" y="86" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order (root)</text>
  <rect x="70" y="125" width="130" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.3"/><text x="135" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">LineItem</text>
  <rect x="215" y="125" width="130" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.3"/><text x="280" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Money (VO)</text>
  <line x1="180" y1="99" x2="135" y2="123" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-aggregate-root-arr)"/>
  <line x1="230" y1="99" x2="280" y2="123" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-aggregate-root-arr)"/>
  <rect x="520" y="90" width="150" height="40" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/><text x="595" y="108" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Customer</text><text x="595" y="123" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">other aggregate</text>
  <line x1="290" y1="82" x2="518" y2="105" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-aggregate-root-arr)"/>
  <text x="410" y="78" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">reference by ID only</text>
  <text x="205" y="203" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">outside world touches only the root</text>
</svg>`;

const topic = makeTopic({
  id: "aggregate-root",
  title: "Aggregate Root",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A cluster of objects treated as one consistency unit, accessed only through a single root entity that enforces the cluster's invariants.`,
  sections: [
    { title: `What an aggregate is`, body: `<p>An <b>aggregate</b> is a cluster of related entities and value objects that are changed together and must stay mutually consistent. One entity in the cluster is the <b>aggregate root</b> — the only member the outside world is allowed to hold a reference to or modify. An Order aggregate, for example, contains the Order (root) plus its LineItems and a Money value object. You never reach in and mutate a LineItem directly; you call a method on the Order, which enforces the rules. This structure — a guarded cluster with one entry point — is what the rest of the pattern builds on.</p>` },
    { title: `The consistency boundary`, figureAfter: "agg", body: `<p>The aggregate is fundamentally a <b>consistency boundary</b>: its invariants are guaranteed to hold at the end of every operation, and the whole aggregate is saved or rejected atomically in <b>one transaction</b>. That is why an "order total must equal the sum of its line items" or "a wallet balance must never go negative" invariant belongs inside the aggregate — the root is the single place that can check it before allowing a change.</p>
<p>Two structural rules follow: the root guards all access (external code calls <code>order.addItem(...)</code>, not <code>order.items.add(...)</code>), and internal entities have no independent lifecycle — delete the root and its parts go with it.</p>
<pre>// Payment aggregate: root enforces invariants, raises domain events
public final class Payment extends AggregateRoot {
    private final PaymentId id;
    private PaymentStatus status;
    private final Money amount;
    private final List&lt;PaymentLine&gt; lines = new ArrayList&lt;&gt;();

    public static Payment authorize(PaymentId id, Money amount, List&lt;PaymentLine&gt; lines) {
        if (amount.isNegativeOrZero()) throw new IllegalArgumentException("amount must be positive");
        if (lines.isEmpty()) throw new IllegalArgumentException("payment needs lines");
        Payment payment = new Payment(id, PaymentStatus.PENDING, amount, List.copyOf(lines));
        payment.raise(new PaymentAuthorized(id, amount, Instant.now()));
        return payment;
    }

    public void capture() {
        if (status != PaymentStatus.PENDING) throw new IllegalStateException("not pending");
        status = PaymentStatus.CAPTURED;
        raise(new PaymentCaptured(id, amount, Instant.now()));
    }

    public List&lt;PaymentLine&gt; lines() { return List.copyOf(lines); } // no direct mutation
}

public abstract class AggregateRoot {
    private final List&lt;DomainEvent&gt; events = new ArrayList&lt;&gt;();
    protected void raise(DomainEvent event) { events.add(event); }
    public List&lt;DomainEvent&gt; pullEvents() {
        List&lt;DomainEvent&gt; pulled = List.copyOf(events);
        events.clear();
        return pulled;
    }
}</pre>` },
    { title: `Reference other aggregates by ID`, body: `<p>Aggregates reference <em>each other</em> by <b>identity, not by object reference</b>. An Order holds a <code>customerId</code>, not a whole <code>Customer</code> object. This keeps each aggregate small, prevents loading half the database to satisfy one operation, and — critically — enforces that you only modify <b>one aggregate per transaction</b>. Changes that must span aggregates are made <b>eventually consistent</b>: the root emits a domain event and another aggregate reacts in a separate transaction. If you find yourself needing two aggregates to change atomically, that is a signal your boundaries are drawn wrong.</p>` },
    { title: `Sizing and pitfalls`, body: `<p>Aggregate design is a balancing act. <b>Large</b> aggregates guarantee more invariants transactionally but create contention — if every operation on a busy Customer loads and locks a huge object graph, concurrent updates collide and throughput drops. <b>Small</b> aggregates scale better but push more consistency to eventual/async paths. The guidance (Vernon's rules): prefer small aggregates, protect true invariants inside a boundary, reference other aggregates by ID, and accept eventual consistency across boundaries. Common mistakes: making the aggregate a giant object graph "because it is convenient," and exposing internal collections so callers bypass the root's invariant checks.</p>
<pre>// Application service: one aggregate per transaction
@Transactional
public class CapturePaymentHandler {
    private final PaymentRepository payments;
    private final DomainEventPublisher events;

    public void handle(CapturePaymentCommand cmd) {
        Payment payment = payments.findById(cmd.paymentId())
            .orElseThrow(() -&gt; new PaymentNotFoundException(cmd.paymentId()));
        payment.capture();
        payments.save(payment);
        payment.pullEvents().forEach(events::publish); // PaymentCaptured → handlers
    }
}

record PaymentCaptured(PaymentId id, Money amount, Instant at) implements DomainEvent {}
record CapturePaymentCommand(PaymentId paymentId) {}</pre>` },
  ],
  figures: [
    { id: "agg", svg: AGG_SVG, caption: "Only the root is referenced from outside; internal parts are reached through it, and other aggregates are referenced by ID." },
  ],
  related: ["value-objects", "repository-pattern", "bounded-context", "domain-vs-integration-events"],
});

export const meta = topic.meta;
export const content = topic.content;
