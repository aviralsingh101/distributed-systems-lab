// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "kiss-yagni-principles",
  title: "KISS & YAGNI",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Keep designs as simple as the problem allows (KISS) and build only what current requirements demand (YAGNI) — complexity must be earned.`,
  sections: [
    { title: `Two principles against over-engineering`, body: `<p><b>KISS</b> — Keep It Simple, Stupid — holds that a system works best when it is kept simple rather than made complex; simplicity should be a design goal and needless complexity avoided. <b>YAGNI</b> — You Aren't Gonna Need It, from Extreme Programming — holds that you should not add functionality until it is actually required.</p>
<p>Both push back on the same instinct: building for imagined futures. KISS targets <em>needless structural complexity</em> in the solution; YAGNI targets <em>speculative features and generality</em> that no current requirement asks for.</p>` },
    { title: `How KISS works — over-engineered vs simple`, body: `<p>KISS works by choosing the least complex design that satisfies the requirement and its known constraints. Prefer a plain function to a class hierarchy, a direct call to an event bus, a list to a custom data structure — until measured need justifies more. Complexity is a cost paid on every future read, test, and change, so the burden of proof is on the more elaborate option.</p>
<pre>// OVER-ENGINEERED (violates KISS): one provider, full plugin registry
public interface PaymentGatewayPlugin {
    String providerId();
    PaymentGateway create(Config config);
}

public class PaymentPluginRegistry {
    private final Map&lt;String, PaymentGatewayPlugin&gt; plugins = new HashMap&lt;&gt;();
    public void register(PaymentGatewayPlugin p) { plugins.put(p.providerId(), p); }
    public PaymentGateway resolve(String id, Config c) { return plugins.get(id).create(c); }
}

public class OrderService {
    private final PaymentPluginRegistry registry;
    public Order placeOrder(PlaceOrderCommand cmd) {
        PaymentGateway gw = registry.resolve(cmd.providerId(), cmd.config());
        gw.charge(cmd.toChargeRequest());
    }
}</pre>
<p>The KISS version for a single-provider system:</p>
<pre>// SIMPLE: one provider, direct dependency — honest about current reality
public class OrderService {
    private final StripePaymentGateway gateway;
    private final LedgerRepository ledger;

    public OrderService(StripePaymentGateway gateway, LedgerRepository ledger) {
        this.gateway = gateway;
        this.ledger = ledger;
    }

    public Order placeOrder(PlaceOrderCommand cmd) {
        ChargeResult result = gateway.charge(cmd.toChargeRequest());
        if (result.status() == ChargeStatus.CAPTURED) {
            ledger.recordDebit(cmd.walletId(), cmd.amount(), result.processorRef());
        }
        return Order.from(cmd, result);
    }
}</pre>
<p>When the second provider arrives, <em>then</em> introduce <code>PaymentGateway</code> as an interface — with real knowledge of how Adyen differs from Stripe.</p>` },
    { title: `How YAGNI works`, body: `<p>YAGNI works by deferring decisions until the requirement is real. The classic case is a service that supports one payment provider but is built with a plugin registry, config-driven strategy loading, and abstract factories "in case we add more". If the second provider never arrives — or arrives with different needs than you guessed — that machinery is pure cost.</p>
<pre>// YAGNI violation: speculative multi-region factory before second region exists
public interface RegionFactory {
    PaymentGateway createGateway();
    TaxRules createTaxRules();
    ComplianceFormatter createFormatter();
}

public class UsRegionFactory implements RegionFactory { /* only region that exists */ }
public class RegionFactoryProvider {
    public RegionFactory get(String region) {
        return switch (region) {
            case "US" -> new UsRegionFactory();
            default -> throw new UnsupportedOperationException("not built yet");
        };
    }
}</pre>
<p>YAGNI says: ship with a concrete <code>UsPaymentSetup</code> class. When EU launches, build <code>EuRegionFactory</code> with real requirements — not guessed ones.</p>` },
    { title: `Tension and balance`, body: `<p>These principles create healthy tension with DRY and the Open/Closed Principle, which encourage abstraction. The resolution is timing and evidence: abstract in response to <em>demonstrated</em> duplication or change, not anticipated. Simplicity is also relative to the problem — a payments ledger has irreducible complexity (idempotency, auditability) that KISS does not let you skip. The goal is to be as simple as possible, <em>but no simpler</em>: remove accidental complexity, respect essential complexity.</p>` },
  ],
  related: ["dry-principle", "open-closed-principle", "single-responsibility-principle", "composition-over-inheritance"],
});

export const meta = topic.meta;
export const content = topic.content;
