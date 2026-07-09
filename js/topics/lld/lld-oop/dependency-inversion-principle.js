// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const DIP_SVG = `<svg viewBox="0 0 520 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dependency inversion with an owned abstraction">
  <defs><marker id="fig-dependency-inversion-principle-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="30" y="86" width="150" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="105" y="106" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">OrderService</text>
  <text x="105" y="123" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">high-level policy</text>
  <rect x="230" y="86" width="150" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="305" y="106" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">&lt;&lt;PaymentPort&gt;&gt;</text>
  <text x="305" y="123" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">abstraction (owned by policy)</text>
  <rect x="380" y="150" width="130" height="42" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="445" y="176" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">StripeAdapter</text>
  <line x1="180" y1="109" x2="228" y2="109" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-dependency-inversion-principle-arr)"/>
  <line x1="445" y1="150" x2="330" y2="134" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-dependency-inversion-principle-arr)"/>
  <text x="200" y="60" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Both policy and detail depend on the abstraction; the arrow into it is "inverted".</text>
</svg>`;

const topic = makeTopic({
  id: "dependency-inversion-principle",
  title: "Dependency Inversion",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `High-level policy and low-level detail should both depend on abstractions; the abstraction should not depend on the detail.`,
  sections: [
    { title: `The formal statement`, body: `<p>The <b>Dependency Inversion Principle (DIP)</b>, the "D" in SOLID, has two parts. First, <em>high-level modules should not depend on low-level modules; both should depend on abstractions</em>. Second, <em>abstractions should not depend on details; details should depend on abstractions</em>.</p>
<p>"Inversion" refers to reversing the conventional dependency direction. Normally business logic calls concrete infrastructure, so policy depends on detail. DIP flips this: the policy defines an abstraction it needs, and the infrastructure conforms to it.</p>` },
    { title: `How it works — violation vs fix`, figureAfter: "dip-diagram", body: `<p>DIP works by placing an interface <b>between</b> policy and detail, and having the high-level module <em>own</em> that interface.</p>
<pre>// VIOLATION: OrderService depends directly on Stripe SDK detail
public class OrderService {
    private final StripeClient stripe;  // low-level detail

    public OrderService() {
        this.stripe = new StripeClient(System.getenv("STRIPE_KEY"));
    }

    public Order placeOrder(PlaceOrderCommand cmd) {
        PaymentIntent intent = stripe.paymentIntents().create(/* Stripe types */);
        // domain logic tangled with vendor API
    }
}</pre>
<p>The fix: policy owns the port; detail implements it. Both depend on the abstraction:</p>
<pre>// Port owned by the domain — vocabulary is YOURS, not Stripe's
public interface PaymentPort {
    ChargeResult charge(ChargeRequest request);
}

// High-level policy depends on abstraction, not detail
public class OrderService {
    private final PaymentPort paymentPort;
    private final LedgerRepository ledger;

    public OrderService(PaymentPort paymentPort, LedgerRepository ledger) {
        this.paymentPort = paymentPort;
        this.ledger = ledger;
    }

    public Order placeOrder(PlaceOrderCommand cmd) {
        Order order = Order.create(cmd);
        ChargeResult result = paymentPort.charge(order.toChargeRequest());
        if (result.status() == ChargeStatus.CAPTURED) {
            ledger.recordDebit(cmd.walletId(), order.total(), result.processorRef());
            order.markPaid();
        }
        return order;
    }
}

// Low-level detail depends on abstraction (implements the port)
public final class StripePaymentAdapter implements PaymentPort {
    private final StripeClient stripe;
    public StripePaymentAdapter(StripeClient stripe) { this.stripe = stripe; }

    @Override
    public ChargeResult charge(ChargeRequest req) {
        // translate domain types to Stripe SDK here — detail stays here
        PaymentIntent intent = stripe.paymentIntents().create(/* ... */);
        return new ChargeResult(req.paymentId(), ChargeStatus.CAPTURED, intent.getId());
    }
}</pre>
<p>The arrow from Stripe now points <em>up</em> toward <code>PaymentPort</code>, not from business logic <em>down</em> to Stripe. This is the backbone of hexagonal / ports-and-adapters architecture.</p>` },
    { title: `Why invert`, body: `<p>Without inversion, the most valuable code (domain policy) is chained to volatile, replaceable code (a specific database, SDK, or vendor). Swapping Stripe for Adyen, or Postgres for DynamoDB, would ripple into the domain. With DIP, the domain depends only on a stable abstraction it defined; infrastructure is a plug-in. It also makes testing trivial — inject an in-memory fake that implements the port, with no network.</p>
<pre>public final class FakePaymentPort implements PaymentPort {
    @Override
    public ChargeResult charge(ChargeRequest req) {
        return new ChargeResult(req.paymentId(), ChargeStatus.CAPTURED, "fake-ref");
    }
}

// Test: no Stripe, no WireMock
@Test void placeOrder_recordsLedgerOnSuccess() {
    OrderService svc = new OrderService(new FakePaymentPort(), new InMemoryLedger());
    Order order = svc.placeOrder(aValidCommand());
    assertThat(order.status()).isEqualTo(OrderStatus.PAID);
}</pre>` },
    { title: `DIP versus DI`, body: `<p>DIP is a <em>design principle</em> about which direction dependencies point; <b>Dependency Injection</b> is a <em>technique</em> for supplying those dependencies. You can have DI without DIP (injecting a concrete class buys testability but not decoupling from detail), and DIP is only fully realized when the abstraction is owned by the client, not by the provider. The pitfall is trivial pass-through interfaces that merely mirror one implementation — an abstraction earns its place only when it hides real, substitutable detail.</p>` },
  ],
  figures: [
    { id: "dip-diagram", svg: DIP_SVG, caption: `OrderService depends on PaymentPort, which it owns; StripeAdapter also depends on PaymentPort. The dependency on detail is inverted.` },
  ],
  related: ["dependency-injection", "abstraction", "interface-segregation-principle", "factory-method"],
});

export const meta = topic.meta;
export const content = topic.content;
