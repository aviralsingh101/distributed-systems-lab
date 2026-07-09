// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const COMP_SVG = `<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Composition: OrderProcessor holds collaborators">
  <defs><marker id="fig-composition-over-inheritance-arr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="80" width="170" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="115" y="102" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">OrderProcessor</text>
  <text x="115" y="120" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">has-a (delegates)</text>
  <rect x="300" y="18" width="180" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="390" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">PaymentGateway</text>
  <rect x="300" y="80" width="180" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="390" y="104" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">FraudCheck</text>
  <rect x="300" y="142" width="180" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="390" y="166" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">Notifier</text>
  <line x1="200" y1="98" x2="298" y2="40" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-composition-over-inheritance-arr)"/>
  <line x1="200" y1="106" x2="298" y2="100" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-composition-over-inheritance-arr)"/>
  <line x1="200" y1="114" x2="298" y2="162" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-composition-over-inheritance-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "composition-over-inheritance",
  title: "Composition over Inheritance",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Assemble behavior by holding and delegating to collaborator objects (has-a) rather than inheriting it from a base class (is-a).`,
  sections: [
    { title: `The guideline`, body: `<p><b>Composition over inheritance</b> is the design guideline that behavior should usually be built by <em>combining</em> objects — a class holds references to collaborators and delegates work to them — rather than by extending a base class to acquire its behavior. Inheritance models an <b>is-a</b> relationship; composition models a <b>has-a</b> relationship, and most reuse is really "has-a" in disguise.</p>
<p>It is not a ban on inheritance. It is a default: reach for composition first, and use inheritance only when there is a genuine, stable subtype relationship that satisfies the Liskov Substitution Principle.</p>` },
    { title: `How it works — inheritance vs composition`, figureAfter: "comp-diagram", body: `<p>Composition works by <b>delegation</b>. Instead of an <code>OrderProcessor</code> inheriting from a base that mixes fraud checks, payment, and notifications, it holds collaborators and calls them. Each collaborator is an interface, so implementations can be swapped or injected for tests.</p>
<pre>// INHERITANCE approach — tight coupling to base class internals
public abstract class BaseOrderProcessor {
    protected void runFraudCheck(Order order) { /* ... */ }
    protected abstract void charge(Order order);
    protected void notifyCustomer(Order order) { /* ... */ }

    public final void process(Order order) {
        runFraudCheck(order);
        charge(order);
        notifyCustomer(order);
    }
}

public class StripeOrderProcessor extends BaseOrderProcessor {
    @Override protected void charge(Order order) { /* Stripe-specific */ }
    // fragile: depends on base's self-call order and protected methods
}</pre>
<p>Composition replaces the hierarchy with explicit collaborators:</p>
<pre>public interface PaymentGateway { ChargeResult charge(ChargeRequest req); }
public interface FraudCheck { FraudResult evaluate(Order order); }
public interface Notifier { void send(OrderNotification n); }

public final class OrderProcessor {
    private final FraudCheck fraudCheck;
    private final PaymentGateway gateway;
    private final Notifier notifier;

    public OrderProcessor(FraudCheck fraudCheck, PaymentGateway gateway, Notifier notifier) {
        this.fraudCheck = fraudCheck;
        this.gateway = gateway;
        this.notifier = notifier;
    }

    public Order process(Order order) {
        FraudResult fraud = fraudCheck.evaluate(order);
        if (fraud.isBlocked()) throw new FraudBlockedException(fraud.reason());

        gateway.charge(order.toChargeRequest());

        notifier.send(new OrderNotification(order.id(), order.customerId(), "Confirmed"));
        return order.markProcessed();
    }
}</pre>
<p>Want a sandbox flow? Compose the same processor with a <code>FakePaymentGateway</code>. No subclass needed. This is exactly how Strategy, Decorator, and Dependency Injection all operate.</p>` },
    { title: `Why prefer it`, body: `<p>Inheritance is the tightest coupling in OOP: a subclass depends on the base's protected members and its internal call order, so a change to the base can silently break subclasses (the <b>fragile base class</b> problem). Deep hierarchies also force a single classification axis — but real objects vary along several axes at once, causing a combinatorial explosion of subclasses. Composition avoids both: collaborators are loosely coupled through interfaces, and orthogonal behaviors combine freely without new subclasses.</p>` },
    { title: `Trade-offs`, body: `<p>Composition adds a little more wiring — you must construct and pass collaborators, often via a constructor or DI container — and introduces one level of indirection. Inheritance still wins when there is a true is-a relationship with a stable contract, or when a framework's template-method design expects you to subclass. The rule of thumb: use inheritance for <em>substitutability</em>, composition for <em>reuse</em>.</p>` },
  ],
  figures: [
    { id: "comp-diagram", svg: COMP_SVG, caption: `OrderProcessor composes and delegates to a PaymentGateway, FraudCheck, and Notifier instead of inheriting their behavior.` },
  ],
  related: ["inheritance-pitfalls", "liskov-substitution-principle", "dependency-injection", "polymorphism"],
});

export const meta = topic.meta;
export const content = topic.content;
