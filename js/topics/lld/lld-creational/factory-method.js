// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const FM_SVG = `<svg viewBox="0 0 520 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Factory Method UML">
  <defs><marker id="fig-factory-method-arr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="20" y="20" width="190" height="70" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="115" y="40" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">PaymentCreator</text>
  <line x1="20" y1="50" x2="210" y2="50" stroke="#26324a"/>
  <text x="30" y="68" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">+ process()</text>
  <text x="30" y="84" fill="#5b9dff" font-size="10" font-family="ui-monospace,monospace"># createGateway()*</text>
  <rect x="20" y="130" width="190" height="66" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="115" y="150" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">StripeCreator</text>
  <line x1="20" y1="160" x2="210" y2="160" stroke="#26324a"/>
  <text x="30" y="182" fill="#3ddc97" font-size="10" font-family="ui-monospace,monospace"># createGateway()</text>
  <rect x="310" y="20" width="190" height="60" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="405" y="45" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">&lt;&lt;Gateway&gt;&gt;</text>
  <text x="405" y="66" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">+ charge()</text>
  <rect x="310" y="136" width="190" height="54" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="405" y="167" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">StripeGateway</text>
  <line x1="115" y1="130" x2="115" y2="92" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-factory-method-arr)"/>
  <line x1="405" y1="136" x2="405" y2="82" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-factory-method-arr)"/>
  <line x1="210" y1="163" x2="308" y2="163" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-factory-method-arr)"/>
  <text x="260" y="155" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">creates</text>
</svg>`;

const topic = makeTopic({
  id: "factory-method",
  title: "Factory Method",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Define a method for creating an object but let subclasses decide which concrete class to instantiate, so the creating code depends only on the product interface.`,
  sections: [
    { title: `The problem it solves`, body: `<p><b>Factory Method</b> is a GoF creational pattern. It addresses a common friction: a class needs to create objects, but it should not be hard-wired to their concrete types. If <code>OrderProcessor</code> does <code>new StripeGateway()</code> directly, it is coupled to Stripe — adding Adyen means editing the processor, violating the Open/Closed Principle.</p>
<p>The pattern moves object creation into an overridable method. The high-level workflow is written once against a product interface; <em>which</em> concrete product it uses is decided by a subclass that overrides the factory method.</p>` },
    { title: `Structure`, figureAfter: "fm-uml", body: `<p>There are four roles. The <b>Product</b> is an interface (<code>PaymentGateway</code> with <code>charge()</code>). The <b>Concrete Product</b> implements it (<code>StripeGateway</code>). The <b>Creator</b> is an abstract class that declares the factory method <code>createGateway()</code> and contains the business logic that uses its result. The <b>Concrete Creator</b> (<code>StripeCreator</code>) overrides the factory method to return a specific product.</p>
<pre>// Product interface
public interface PaymentGateway {
    ChargeResult charge(ChargeRequest request);
}

// Concrete products
public final class StripeGateway implements PaymentGateway {
    private final StripeClient client;
    public StripeGateway(StripeClient client) { this.client = client; }
    @Override public ChargeResult charge(ChargeRequest req) { /* Stripe SDK */ }
}

public final class AdyenGateway implements PaymentGateway {
    private final Client adyen;
    public AdyenGateway(Client adyen) { this.adyen = adyen; }
    @Override public ChargeResult charge(ChargeRequest req) { /* Adyen SDK */ }
}</pre>
<p>The Creator declares the factory method and uses it in its template workflow:</p>
<pre>// Creator — business logic written once against PaymentGateway
public abstract class PaymentCreator {
    // Factory method — subclass decides which gateway
    protected abstract PaymentGateway createGateway();

    // Template operation — never names a concrete gateway
    public final Order processOrder(PlaceOrderCommand cmd) {
        PaymentGateway gateway = createGateway();
        Order order = Order.create(cmd);
        ChargeResult result = gateway.charge(order.toChargeRequest());
        order.applyChargeResult(result);
        return order;
    }
}

// Concrete creators — one per provider
public class StripePaymentCreator extends PaymentCreator {
    private final StripeClient stripe;
    public StripePaymentCreator(StripeClient stripe) { this.stripe = stripe; }
    @Override protected PaymentGateway createGateway() {
        return new StripeGateway(stripe);
    }
}

public class AdyenPaymentCreator extends PaymentCreator {
    private final Client adyen;
    public AdyenPaymentCreator(Client adyen) { this.adyen = adyen; }
    @Override protected PaymentGateway createGateway() {
        return new AdyenGateway(adyen);
    }
}</pre>` },
    { title: `Flow`, body: `<p>The steps at runtime: (1) client code holds a Creator, chosen at configuration time. (2) It calls the template operation <code>processOrder()</code> on the Creator. (3) Inside, the Creator calls its own <code>createGateway()</code>; because of dynamic dispatch the Concrete Creator's override runs and returns the right product. (4) The Creator uses the returned gateway through the interface. Adding a new provider means implementing a new Product and a new Concrete Creator — no existing code changes.</p>
<pre>// Client — picks creator at config time, never names Stripe or Adyen
public class PaymentApplication {
    public static void main(String[] args) {
        PaymentCreator creator = buildCreatorFromConfig(args);
        Order order = creator.processOrder(new PlaceOrderCommand(/* ... */));
    }
}</pre>` },
    { title: `Trade-offs and related patterns`, body: `<p><b>Benefits:</b> the creator is decoupled from concrete products; new products slot in without editing existing code; creation logic is centralized and testable with fake products. <b>Costs:</b> it introduces a parallel hierarchy of creators, which is heavy if you only have one product type — a plain parameterized "simple factory" or Dependency Injection is often enough.</p>
<p>Contrast with <b>Abstract Factory</b>, which produces <em>families</em> of related products, and with <b>Builder</b>, which assembles one complex product step by step. Factory Method varies a single product via subclassing.</p>` },
  ],
  figures: [
    { id: "fm-uml", svg: FM_SVG, caption: `The Creator declares an abstract factory method; a Concrete Creator overrides it to return a Concrete Product, while the Creator's logic uses only the Product interface.` },
  ],
  related: ["abstract-factory", "builder", "prototype", "dependency-injection", "open-closed-principle"],
});

export const meta = topic.meta;
export const content = topic.content;
