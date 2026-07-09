// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const ES_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Event storming stickies mapped to code">
  <defs><marker id="fig-event-storming-to-code-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="40" width="120" height="30" rx="4" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="90" y="60" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">blue: command</text>
  <rect x="30" y="80" width="120" height="30" rx="4" fill="#1a2236" stroke="#ffb454" stroke-width="1.4"/><text x="90" y="100" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">orange: event</text>
  <rect x="30" y="120" width="120" height="30" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="90" y="140" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">yellow: aggregate</text>
  <rect x="30" y="160" width="120" height="30" rx="4" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/><text x="90" y="180" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">purple: policy</text>
  <line x1="150" y1="55" x2="360" y2="60" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-event-storming-to-code-arr)"/>
  <line x1="150" y1="95" x2="360" y2="95" stroke="#ffb454" stroke-width="1.3" marker-end="url(#fig-event-storming-to-code-arr)"/>
  <line x1="150" y1="135" x2="360" y2="130" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-event-storming-to-code-arr)"/>
  <line x1="150" y1="175" x2="360" y2="165" stroke="#7c5cff" stroke-width="1.3" marker-end="url(#fig-event-storming-to-code-arr)"/>
  <rect x="370" y="45" width="320" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.3"/><text x="530" y="65" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">command handler / method on aggregate</text>
  <rect x="370" y="80" width="320" height="30" rx="5" fill="#1a2236" stroke="#ffb454" stroke-width="1.3"/><text x="530" y="100" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">domain event class (past tense)</text>
  <rect x="370" y="115" width="320" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.3"/><text x="530" y="135" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">aggregate root + consistency boundary</text>
  <rect x="370" y="150" width="320" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.3"/><text x="530" y="170" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">event handler / process manager</text>
</svg>`;

const topic = makeTopic({
  id: "event-storming-to-code",
  title: "Event Storming to Code",
  category: "lld-ddd",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `A workshop that maps a business process as colored sticky notes, then translates those stickies almost one-to-one into aggregates, commands, and events.`,
  sections: [
    { title: `What event storming is`, body: `<p><b>Event storming</b> (Alberto Brandolini) is a collaborative modeling workshop where domain experts and developers map a business process on a wall using color-coded sticky notes. Its power is speed and shared understanding: in hours a room converges on how the domain actually behaves, in the domain's own language, before anyone writes code. The output is not decoration — it maps almost directly onto DDD building blocks, which is why it is the front door to a tactical design.</p>` },
    { title: `The sticky-note vocabulary`, body: `<p>The notation is deliberately small, and the colors are a convention worth knowing:</p>
<ul>
<li><b>Domain events (orange)</b> — facts that happened, in past tense: <code>PaymentAuthorized</code>. These are placed first, along a timeline.</li>
<li><b>Commands (blue)</b> — actions/intent that cause events: <code>AuthorizePayment</code>.</li>
<li><b>Actors (small yellow)</b> — who issues a command.</li>
<li><b>Aggregates (large yellow)</b> — the entity that receives a command and emits an event.</li>
<li><b>Policies (purple)</b> — reactive rules: "whenever <em>X</em> happened, do <em>Y</em>" (a command triggered by an event).</li>
<li><b>Read models (green)</b> — the data an actor looks at to decide, and <b>hotspots (red)</b> for conflicts/questions.</li>
</ul>` },
    { title: `Mapping the wall to code`, figureAfter: "es", body: `<p>Each color has a code counterpart, so the flow from wall to implementation is mechanical:</p>
<pre>// Blue sticky: AuthorizePayment → command + handler
public record AuthorizePaymentCommand(
    String paymentId, String walletId, Money amount
) {}

@Component
public class AuthorizePaymentHandler {
    private final WalletRepository wallets;

    @Transactional
    public void handle(AuthorizePaymentCommand cmd) {
        Wallet wallet = wallets.findById(cmd.walletId()).orElseThrow();
        wallet.authorize(cmd.amount(), cmd.paymentId());
        wallets.save(wallet);
    }
}

// Orange sticky: PaymentAuthorized → domain event class
public record PaymentAuthorized(
    String paymentId, String walletId, Money amount, Instant at
) implements DomainEvent {}

// Purple sticky: when PaymentAuthorized → notify customer (policy)
@Component
public class SendReceiptPolicy {
    @EventListener
    public void on(PaymentAuthorized evt) {
        notificationService.sendReceipt(evt.paymentId());
    }
}</pre>
<p>Clusters of tightly-related stickies that change together suggest <b>aggregate boundaries</b>; seams where the language shifts suggest <b>bounded contexts</b>.</p>
<pre>// Wall sticky: blue "Authorize Payment" → command + handler
public record AuthorizePaymentCommand(PaymentId id, Money amount, PayerId payerId) {}

@Component
class AuthorizePaymentHandler {
    public void handle(AuthorizePaymentCommand cmd) {
        Payment payment = Payment.authorize(cmd.id(), cmd.amount(), cmd.payerId());
        payments.save(payment);
    }
}

// Wall sticky: orange "Payment Authorized" → domain event class
public record PaymentAuthorized(PaymentId id, Money amount, Instant at) implements DomainEvent {}

// Wall sticky: yellow "Payment" → aggregate root (consistency boundary)
// Wall sticky: purple "when PaymentCaptured → notify ledger" → policy handler
@EventListener
public void on(PaymentCaptured event) {
    ledgerService.record(event);
}</pre>` },
    { title: `Practical guidance`, body: `<p>Run "big picture" storming first to find contexts, then "design-level" storming to detail one context's aggregates and flows. Watch for the honest signals the wall gives you: a red hotspot is a real domain ambiguity to resolve with the expert, not a note to skip; an aggregate receiving commands from many unrelated flows may be doing too much; a policy that spans two aggregates is where eventual consistency and integration events belong. The common failure is treating the workshop output as final architecture — it is a shared model and a starting point, refined as you encode it and learn where the invariants really sit.</p>
<pre>// Full flow from one wall sequence:
// Actor: Merchant → Command: AuthorizePayment → Aggregate: Payment
//   → Event: PaymentAuthorized → Policy: ReserveFunds → Command: DebitWallet
//   → Aggregate: Wallet → Event: FundsReserved → Event: PaymentCaptured

// Policy spanning two aggregates → eventual consistency + integration event
@EventListener
public void on(PaymentAuthorized event) {
    // NOT a single transaction across Payment + Wallet aggregates
    commandBus.send(new DebitWalletCommand(event.payerId(), event.amount()));
}

// Red hotspot on wall: "Can partial capture happen?" → resolve with domain expert
// before coding Payment.capturePartial()</pre>` },
  ],
  figures: [
    { id: "es", svg: ES_SVG, caption: "Each sticky-note color maps to a concrete building block: commands to handlers, events to event classes, aggregates to roots, policies to reactive handlers." },
  ],
  related: ["bounded-context", "aggregate-root", "domain-vs-integration-events", "cqrs-handler-separation"],
});

export const meta = topic.meta;
export const content = topic.content;
