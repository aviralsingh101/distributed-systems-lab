// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const DI_SVG = `<svg viewBox="0 0 520 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dependency injection wiring">
  <defs><marker id="fig-dependency-injection-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="180" y="18" width="160" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="260" y="38" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Container / main</text>
  <text x="260" y="54" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">composition root</text>
  <rect x="180" y="118" width="160" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="260" y="140" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">OrderService</text>
  <text x="260" y="158" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">(gateway, ledger)</text>
  <rect x="20" y="118" width="130" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="85" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">StripeGateway</text>
  <rect x="370" y="118" width="130" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="435" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">SqlLedger</text>
  <line x1="260" y1="62" x2="260" y2="116" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-dependency-injection-arr)"/>
  <line x1="150" y1="140" x2="178" y2="140" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-dependency-injection-arr)"/>
  <line x1="370" y1="140" x2="342" y2="140" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-dependency-injection-arr)"/>
  <text x="260" y="98" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">injects constructed dependencies</text>
</svg>`;

const topic = makeTopic({
  id: "dependency-injection",
  title: "Dependency Injection",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Supply a class's dependencies from outside rather than having it construct or look them up itself, so wiring is centralized and implementations are swappable.`,
  sections: [
    { title: `The problem it solves`, body: `<p><b>Dependency Injection (DI)</b> is a technique for achieving Inversion of Control over object creation. A class that does <code>this.gateway = new StripeGateway()</code> in its constructor is tightly bound to that concrete class: you cannot substitute a fake in tests, cannot swap providers by configuration, and cannot see its true dependencies without reading its body.</p>
<p>DI flips responsibility: the class <em>declares</em> what it needs (as interface-typed parameters) and something external <em>provides</em> the concrete instances. Dependencies become explicit and replaceable.</p>` },
    { title: `Structure and forms`, figureAfter: "di-uml", body: `<p>Three injection styles exist. <b>Constructor injection</b> passes dependencies as constructor arguments — preferred, because it makes dependencies mandatory and the object immutable and fully-formed once built. <b>Setter/property injection</b> supplies them after construction, useful for optional dependencies.</p>
<pre>// WITHOUT DI — hidden, untestable dependency
public class OrderService {
    private final PaymentGateway gateway = new StripeGateway(new StripeClient("sk_live_..."));
    private final LedgerRepository ledger = new SqlLedgerRepository(DataSource.getInstance());
    // dependencies invisible from outside; cannot swap for tests
}

// WITH DI — constructor injection (preferred)
public class OrderService {
    private final PaymentGateway gateway;
    private final LedgerRepository ledger;
    private final EventQueue eventQueue;

    public OrderService(PaymentGateway gateway,
                        LedgerRepository ledger,
                        EventQueue eventQueue) {
        this.gateway = gateway;
        this.ledger = ledger;
        this.eventQueue = eventQueue;
    }

    public Order placeOrder(PlaceOrderCommand cmd) {
        ChargeResult result = gateway.charge(cmd.toChargeRequest());
        ledger.recordDebit(cmd.walletId(), cmd.amountCents(), result.processorRef());
        eventQueue.publish(new OrderPlacedEvent(cmd.orderId(), result));
        return Order.from(cmd, result);
    }
}</pre>
<p>The wiring lives in a <b>composition root</b> — a single place where the object graph is assembled:</p>
<pre>public class Application {
    public static void main(String[] args) {
        // Composition root — the ONLY place that names concrete classes
        PaymentGateway gateway = new StripeGateway(new StripeClient(env("STRIPE_KEY")));
        LedgerRepository ledger = new SqlLedgerRepository(hikariDataSource());
        EventQueue eventQueue = new KafkaEventQueue(kafkaProducer());

        OrderService orderService = new OrderService(gateway, ledger, eventQueue);
        // run the app with orderService
    }
}</pre>` },
    { title: `Flow`, body: `<p>The steps: (1) define abstractions (<code>PaymentGateway</code>, <code>LedgerRepository</code>, <code>EventQueue</code>). (2) write classes that accept those abstractions in their constructors. (3) in the composition root, construct the concrete implementations and inject them to build the graph. (4) request the top-level object and run.</p>
<pre>// Test flow — same OrderService, fake dependencies
@Test
void placeOrder_recordsDebitAndPublishesEvent() {
    FakePaymentGateway gateway = new FakePaymentGateway();
    InMemoryLedger ledger = new InMemoryLedger();
    InMemoryEventQueue events = new InMemoryEventQueue();

    OrderService svc = new OrderService(gateway, ledger, events);
    svc.placeOrder(aValidCommand());

    assertThat(ledger.lastDebit()).isNotNull();
    assertThat(events.published()).hasSize(1);
}

public final class FakePaymentGateway implements PaymentGateway {
    @Override
    public ChargeResult charge(ChargeRequest req) {
        return new ChargeResult(req.paymentId(), ChargeStatus.CAPTURED, "fake-ref");
    }
}</pre>
<p>Tests reuse the same production classes but inject in-memory fakes — exercising real logic without a network or database.</p>` },
    { title: `Trade-offs and relationship to DIP`, body: `<p><b>Benefits:</b> testability, swappable implementations, explicit dependencies, and centralized lifecycle management. <b>Costs:</b> more indirection and up-front wiring; heavyweight containers add "magic" that can obscure the object graph and push errors from compile time to startup. For small programs, manual constructor injection in <code>main</code> is often clearer than a framework.</p>
<p>DI is the usual mechanism that realizes the <b>Dependency Inversion Principle</b>: DIP says depend on abstractions; DI is <em>how</em> the concrete instance behind an abstraction is delivered at runtime. You can have DI without DIP (injecting a concrete class buys testability but not decoupling), and DIP is only fully realized when the abstraction is owned by the client.</p>` },
  ],
  figures: [
    { id: "di-uml", svg: DI_SVG, caption: `The composition root constructs concrete dependencies and injects them into OrderService, which knows only the abstractions.` },
  ],
  related: ["dependency-inversion-principle", "singleton", "factory-method", "abstraction", "interface-segregation-principle"],
});

export const meta = topic.meta;
export const content = topic.content;
