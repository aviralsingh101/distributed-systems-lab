// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const ABS_SVG = `<svg viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Abstraction: interface with two implementations">
  <defs><marker id="fig-abstraction-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="160" y="16" width="160" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="240" y="36" text-anchor="middle" fill="#cdd6e8" font-size="12" font-weight="600" font-family="system-ui">&lt;&lt;interface&gt;&gt;</text>
  <text x="240" y="53" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="ui-monospace,monospace">PaymentGateway</text>
  <rect x="40" y="130" width="170" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="125" y="152" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">StripeAdapter</text>
  <text x="125" y="170" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">+ charge()</text>
  <rect x="270" y="130" width="170" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="355" y="152" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">AdyenAdapter</text>
  <text x="355" y="170" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">+ charge()</text>
  <line x1="125" y1="130" x2="205" y2="64" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-abstraction-arr)"/>
  <line x1="355" y1="130" x2="275" y2="64" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-abstraction-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "abstraction",
  title: "Abstraction",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Expose a stable, essential model of what a thing does and suppress the incidental detail of how it does it.`,
  sections: [
    { title: `What abstraction is`, body: `<p><b>Abstraction</b> is the act of modelling only the features that matter for a given purpose and deliberately ignoring the rest. A type's <em>abstraction</em> is the contract it presents — the operations, their meaning, their pre- and post-conditions — as opposed to the concrete data structures and algorithms behind it.</p>
<p>Encapsulation and abstraction are related but distinct. Encapsulation is the <em>mechanism</em> (hide the fields, guard mutation). Abstraction is the <em>design decision</em> about which concepts to expose: it answers "what is the right interface?", not "how do I keep it private?". In a payment platform, the Order Service should think in terms of <code>charge(wallet, amount)</code>, not Stripe's REST paths or Adyen's session tokens.</p>` },
    { title: `How it works — the abstraction boundary`, figureAfter: "gateway-iface", body: `<p>Abstraction works by defining an interface in the caller's vocabulary, then letting concrete classes implement it. The caller depends only on the interface; the runtime picks the implementation (via dependency injection, configuration, or a factory).</p>
<p>The value shows up when requirements change. Your company signs a second payment processor for EU merchants. You write a new adapter class; the ordering, retry, and ledger code that consume <code>PaymentGateway</code> never change. Good abstractions are chosen at the right <em>level</em>: too concrete and they leak vendor detail; too vague and they force every caller to branch on types or pass opaque maps.</p>
<pre>// --- The abstraction: what Order Service needs to know ---
public interface PaymentGateway {
    /**
     * Attempt to capture funds. Idempotent on paymentId.
     * @throws InsufficientFundsException if the wallet cannot cover amount
     * @throws GatewayUnavailableException for transient processor outages (retryable)
     */
    ChargeResult charge(ChargeRequest request);
}

// Value types owned by YOUR domain, not the vendor SDK
public record ChargeRequest(
    String paymentId,      // idempotency key
    String walletId,
    Money amount,
    PaymentMethod method
) {}

public record ChargeResult(
    String paymentId,
    ChargeStatus status,   // CAPTURED | PENDING | DECLINED
    String processorRef    // opaque external id for reconciliation
) {}

public enum ChargeStatus { CAPTURED, PENDING, DECLINED }</pre>
<p>Notice what is <em>not</em> in the interface: HTTP status codes, Stripe <code>PaymentIntent</code> objects, webhook secrets, or retry backoff. Those are implementation details of each adapter.</p>` },
    { title: `Multiple implementations behind one abstraction`, body: `<p>Each processor adapter translates between your domain types and the vendor's SDK. The Order Service never imports vendor packages.</p>
<pre>// Stripe: amounts in cents, PaymentIntent API
public final class StripePaymentGateway implements PaymentGateway {
    private final StripeClient stripe;

    public StripePaymentGateway(StripeClient stripe) {
        this.stripe = stripe;
    }

    @Override
    public ChargeResult charge(ChargeRequest req) {
        PaymentIntent intent = stripe.paymentIntents().create(
            PaymentIntentCreateParams.builder()
                .setAmount(req.amount().cents())
                .setCurrency(req.amount().currency().toLowerCase())
                .putMetadata("payment_id", req.paymentId())
                .setIdempotencyKey(req.paymentId())
                .build()
        );
        return new ChargeResult(
            req.paymentId(),
            mapStatus(intent.getStatus()),
            intent.getId()
        );
    }

    private ChargeStatus mapStatus(String stripeStatus) {
        return switch (stripeStatus) {
            case "succeeded" -> ChargeStatus.CAPTURED;
            case "processing" -> ChargeStatus.PENDING;
            default -> ChargeStatus.DECLINED;
        };
    }
}

// Adyen: different API shape, same abstraction
public final class AdyenPaymentGateway implements PaymentGateway {
    private final Client adyen;

    public AdyenPaymentGateway(Client adyen) { this.adyen = adyen; }

    @Override
    public ChargeResult charge(ChargeRequest req) {
        PaymentRequest payment = new PaymentRequest()
            .reference(req.paymentId())
            .amount(new Amount()
                .currency(req.amount().currency())
                .value(req.amount().minorUnits()));
        PaymentResponse response = adyen.payments(payment);
        return new ChargeResult(
            req.paymentId(),
            response.isSuccess() ? ChargeStatus.CAPTURED : ChargeStatus.DECLINED,
            response.getPspReference()
        );
    }
}</pre>
<p>Both adapters normalize vendor-specific status strings and amount representations into your <code>ChargeResult</code>. Reconciliation jobs query <code>processorRef</code> against each processor's settlement file — the Order Service never learns which processor handled a given payment.</p>` },
    { title: `The caller depends only on the abstraction`, body: `<p><code>OrderService</code> takes a <code>PaymentGateway</code> in its constructor. At runtime Spring (or your factory) wires Stripe in US-East and Adyen in EU-West based on merchant region. In tests you inject a fake that never hits the network.</p>
<pre>public class OrderService {
    private final PaymentGateway gateway;
    private final LedgerRepository ledger;

    public OrderService(PaymentGateway gateway, LedgerRepository ledger) {
        this.gateway = gateway;
        this.ledger = ledger;
    }

    @Transactional
    public Order placeOrder(PlaceOrderCommand cmd) {
        // 1. Reserve inventory, create order row (local ACID)
        Order order = Order.create(cmd);

        // 2. Charge through the abstraction — no Stripe/Adyen imports here
        ChargeResult result = gateway.charge(new ChargeRequest(
            order.paymentId(),
            cmd.walletId(),
            order.total(),
            cmd.paymentMethod()
        ));

        if (result.status() == ChargeStatus.CAPTURED) {
            ledger.recordDebit(cmd.walletId(), order.total(), result.processorRef());
            order.markPaid();
        } else {
            order.markPaymentFailed(result.status());
        }
        return order;
    }
}

// Test double: deterministic, no network, proves abstraction boundary
public final class FakePaymentGateway implements PaymentGateway {
    private final Map&lt;String, ChargeStatus&gt; outcomes = new HashMap&lt;&gt;();

    public void willReturn(String paymentId, ChargeStatus status) {
        outcomes.put(paymentId, status);
    }

    @Override
    public ChargeResult charge(ChargeRequest req) {
        ChargeStatus status = outcomes.getOrDefault(req.paymentId(), ChargeStatus.CAPTURED);
        return new ChargeResult(req.paymentId(), status, "fake-ref-" + req.paymentId());
    }
}</pre>
<p>The test injects <code>FakePaymentGateway</code>, calls <code>placeOrder</code>, and asserts ledger state — without mocking Stripe's HTTP client or spinning up WireMock. That is the practical payoff of a clean abstraction: testability and swap-ability.</p>` },
    { title: `Leaky abstractions — when the boundary fails`, body: `<p>An abstraction <em>leaks</em> when callers must understand the hidden implementation to use it correctly. Three common leaks in payment systems:</p>
<ul>
<li><b>Vendor types in the interface</b> — returning <code>com.stripe.model.PaymentIntent</code> from <code>charge()</code> forces every caller to import Stripe and handle Stripe-specific states.</li>
<li><b>Hidden ordering requirements</b> — "call <code>createSession()</code> before <code>charge()</code>" is not in the interface contract; Adyen needs it, Stripe does not, and callers break when you swap.</li>
<li><b>Amount unit ambiguity</b> — one adapter treats amounts as dollars, another as cents. Callers must know which processor is wired — the abstraction promised to hide that.</li>
</ul>
<pre>// LEAKY: callers must understand Stripe
public interface LeakyGateway {
    PaymentIntent chargeInStripeFormat(ChargeRequest req);  // Stripe type in API
}

// CLEAN: normalized domain result, vendor detail stays in adapter
public interface PaymentGateway {
    ChargeResult charge(ChargeRequest request);
}</pre>
<p>Fix leaks by pushing normalization into the adapter layer and keeping the interface vocabulary entirely in your domain.</p>` },
    { title: `When not to abstract`, body: `<p>Abstraction has a cost: more types, indirection, and navigation overhead. Introducing <code>PaymentGateway</code> with exactly one Stripe implementation and no plan for a second processor is usually premature — a concrete <code>StripePaymentService</code> class is simpler and honest.</p>
<p>Abstract when you have (or firmly expect) more than one implementation, need to substitute a fake in tests without mocking HTTP, or must protect a stable core module from a volatile vendor SDK. The payment platform cast is a natural place: Gateway, Ledger, and Queue integrations all benefit from interfaces because you will swap vendors, run fakes in CI, and shard by region.</p>
<p>Do <em>not</em> abstract stable, single-purpose utilities (a JSON serializer, a clock) — a concrete class or JDK type is fine. The rule of thumb: abstract at boundaries that change for business reasons, not at every class boundary.</p>` },
  ],
  figures: [
    { id: "gateway-iface", svg: ABS_SVG, caption: `Callers depend on the PaymentGateway abstraction; concrete adapters implement it. Swapping Stripe for Adyen leaves OrderService untouched.` },
  ],
  related: ["encapsulation", "dependency-inversion-principle", "interface-segregation-principle", "polymorphism"],
});

export const meta = topic.meta;
export const content = topic.content;
