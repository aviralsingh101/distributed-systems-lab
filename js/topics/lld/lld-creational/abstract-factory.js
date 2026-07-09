// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const AF_SVG = `<svg viewBox="0 0 540 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Abstract Factory UML">
  <defs><marker id="fig-abstract-factory-arr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="30" y="20" width="180" height="66" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="120" y="40" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">&lt;&lt;RegionFactory&gt;&gt;</text>
  <text x="120" y="60" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">createGateway()</text>
  <text x="120" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">createTaxRules()</text>
  <rect x="20" y="140" width="150" height="60" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="95" y="164" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">EuFactory</text>
  <text x="95" y="184" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Adyen + EU VAT</text>
  <rect x="190" y="140" width="150" height="60" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="265" y="164" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">UsFactory</text>
  <text x="265" y="184" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Stripe + US tax</text>
  <rect x="380" y="30" width="140" height="44" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="450" y="56" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">&lt;&lt;Gateway&gt;&gt;</text>
  <rect x="380" y="100" width="140" height="44" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="450" y="126" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">&lt;&lt;TaxRules&gt;&gt;</text>
  <line x1="95" y1="140" x2="115" y2="88" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-abstract-factory-arr)"/>
  <line x1="265" y1="140" x2="140" y2="88" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-abstract-factory-arr)"/>
  <line x1="210" y1="52" x2="378" y2="52" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-abstract-factory-arr)"/>
  <line x1="210" y1="66" x2="378" y2="118" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-abstract-factory-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "abstract-factory",
  title: "Abstract Factory",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Provide an interface for creating whole families of related objects so a client uses one consistent family without naming the concrete classes.`,
  sections: [
    { title: `The problem it solves`, body: `<p><b>Abstract Factory</b> is a GoF creational pattern for when objects come in <b>families that must be used together</b>. In a global payment platform, each region needs a matching set: a payment <code>Gateway</code>, a set of <code>TaxRules</code>, and a compliance formatter. Mixing an EU gateway with US tax rules would be a correctness bug.</p>
<p>The pattern guarantees consistency by making one factory responsible for producing an entire coherent family. The client selects a factory once and receives products that are guaranteed to fit together.</p>` },
    { title: `Structure`, figureAfter: "af-uml", body: `<p>The roles: an <b>Abstract Factory</b> interface declares one creation method per product kind. <b>Concrete Factories</b> implement all of them to produce one region's variants. <b>Abstract Products</b> are the interfaces the client codes against.</p>
<pre>// Abstract products
public interface PaymentGateway {
    ChargeResult charge(ChargeRequest request);
}

public interface TaxRules {
    int computeVat(int amountCents, String countryCode);
    String taxRegistrationId();
}

// Abstract factory — one creator per product kind
public interface RegionFactory {
    PaymentGateway createGateway();
    TaxRules createTaxRules();
}</pre>
<p>Concrete factories produce matching families:</p>
<pre>public final class EuRegionFactory implements RegionFactory {
    @Override
    public PaymentGateway createGateway() {
        return new AdyenGateway(new Client("EU"));
    }
    @Override
    public TaxRules createTaxRules() {
        return new EuVatRules("DE-VAT-12345");
    }
}

public final class UsRegionFactory implements RegionFactory {
    @Override
    public PaymentGateway createGateway() {
        return new StripeGateway(new StripeClient("US"));
    }
    @Override
    public TaxRules createTaxRules() {
        return new UsSalesTaxRules("US-EIN-67890");
    }
}</pre>` },
    { title: `Flow`, body: `<p>Step by step: (1) at startup, configuration picks a Concrete Factory based on the merchant's region and injects it. (2) The client calls <code>factory.createGateway()</code> and <code>factory.createTaxRules()</code>. (3) It uses both through their abstract interfaces to run the charge. Because both came from the same factory, they belong to the same family.</p>
<pre>public class OrderService {
    private final RegionFactory regionFactory;

    public OrderService(RegionFactory regionFactory) {
        this.regionFactory = regionFactory;
    }

    public Order placeOrder(PlaceOrderCommand cmd) {
        PaymentGateway gateway = regionFactory.createGateway();
        TaxRules taxRules = regionFactory.createTaxRules();

        int vatCents = taxRules.computeVat(cmd.amountCents(), cmd.countryCode());
        ChargeRequest chargeReq = cmd.toChargeRequest(vatCents);

        ChargeResult result = gateway.charge(chargeReq);
        return Order.from(cmd, result, taxRules.taxRegistrationId());
    }
}

// Composition root — pick factory once at startup
RegionFactory factory = merchant.isEu()
    ? new EuRegionFactory()
    : new UsRegionFactory();
OrderService svc = new OrderService(factory);</pre>
<p>Supporting a new region means writing one new Concrete Factory plus its products — the client workflow is untouched, satisfying the Open/Closed Principle.</p>` },
    { title: `Trade-offs and relationships`, body: `<p><b>Benefits:</b> enforces that related products are used as a consistent set, isolates concrete classes from clients, and makes swapping an entire family trivial. <b>Costs:</b> adding a new <em>kind</em> of product means changing the factory interface and every concrete factory — the pattern is rigid along that axis. It also multiplies classes quickly.</p>
<p>Abstract Factory is often built <em>from</em> Factory Methods (each create method is one). Use <b>Factory Method</b> when you vary a single product; reach for Abstract Factory when several products must vary together as a family.</p>` },
  ],
  figures: [
    { id: "af-uml", svg: AF_SVG, caption: `RegionFactory declares one creator per product; EuFactory and UsFactory each produce a matching family of Gateway and TaxRules.` },
  ],
  related: ["factory-method", "builder", "prototype", "singleton", "dependency-injection"],
});

export const meta = topic.meta;
export const content = topic.content;
