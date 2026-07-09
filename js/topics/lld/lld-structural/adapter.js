// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const CLASS_SVG = `<svg viewBox="0 0 580 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adapter class structure">
  <defs><marker id="fig-adapter-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="12" y="80" width="120" height="48" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="72" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order Service</text>
  <text x="72" y="116" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">(client)</text>
  <rect x="190" y="16" width="170" height="60" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="275" y="34" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">«interface» PaymentGateway</text>
  <line x1="190" y1="44" x2="360" y2="44" stroke="#26324a"/>
  <text x="200" y="63" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">+ charge(amount, token)</text>
  <rect x="190" y="130" width="170" height="60" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="275" y="148" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">StripeGatewayAdapter</text>
  <line x1="190" y1="158" x2="360" y2="158" stroke="#26324a"/>
  <text x="200" y="177" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">+ charge(amount, token)</text>
  <rect x="415" y="130" width="150" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="490" y="148" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Stripe SDK</text>
  <text x="490" y="164" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">(adaptee)</text>
  <text x="490" y="180" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">paymentIntents.create</text>
  <line x1="132" y1="100" x2="188" y2="60" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adapter-arr)"/>
  <text x="150" y="92" fill="#93a1bd" font-size="9" font-family="system-ui">uses</text>
  <line x1="275" y1="130" x2="275" y2="78" stroke="#3ddc97" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#fig-adapter-arr)"/>
  <text x="284" y="108" fill="#93a1bd" font-size="9" font-family="system-ui">implements</text>
  <line x1="360" y1="160" x2="413" y2="160" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-adapter-arr)"/>
  <text x="366" y="152" fill="#93a1bd" font-size="9" font-family="system-ui">delegates</text>
</svg>`;

const topic = makeTopic({
  id: "adapter",
  title: "Adapter",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Wrap an existing, incompatible class so it satisfies the interface your code already expects.`,
  sections: [
    { title: `Intent and the problem it solves`, body: `<p><b>Adapter</b> converts the interface of an existing class into another interface that clients expect. It lets two classes collaborate that otherwise could not, because their method names, argument shapes, or error conventions do not line up.</p>
<p>The classic trigger is integrating third-party or legacy code you cannot change. Your Order Service is written against a clean <code>PaymentGateway</code> port with <code>charge(amount, token)</code>. Then you adopt Stripe, whose SDK exposes <code>paymentIntents.create({ amount_cents, payment_method })</code> and throws its own error types. Rather than leaking Stripe's shape through your domain, you write an adapter that presents your port on the outside and calls Stripe on the inside.</p>
<pre>// --- Target: the interface your domain already expects ---
public interface PaymentGateway {
    ChargeResult charge(Money amount, String paymentMethodToken);
}

public record ChargeResult(String paymentId, ChargeStatus status, String processorRef) {}
public enum ChargeStatus { CAPTURED, PENDING, DECLINED }</pre>
<p>The target vocabulary is entirely yours — no vendor types, no cents-vs-dollars ambiguity in the caller.</p>` },
    { title: `Participants and structure`, figureAfter: "adapter-class", body: `<p>The structure has four roles:</p>
<ul>
<li><b>Target</b> — the interface the client depends on (<code>PaymentGateway</code>).</li>
<li><b>Client</b> — code that calls the Target (the Order Service).</li>
<li><b>Adaptee</b> — the existing class with the incompatible interface (the Stripe SDK).</li>
<li><b>Adapter</b> — implements Target and holds a reference to the Adaptee, translating each call.</li>
</ul>
<p>The common form is the <b>object adapter</b>, which wraps the adaptee by composition — that is what the diagram shows. A <b>class adapter</b> instead inherits from both Target and Adaptee; it needs multiple inheritance and is rare outside C++.</p>
<pre>// --- Adaptee: legacy Stripe SDK you cannot modify ---
public class StripeSdk {
    public PaymentIntentResponse createPaymentIntent(
            long amountCents, String currency, String paymentMethodId) {
        // vendor HTTP call — incompatible with PaymentGateway.charge()
        return new PaymentIntentResponse(/* … */);
    }
}</pre>` },
    { title: `Implementation`, body: `<p>The adapter is where all translation lives: unit conversion (dollars to cents), field renaming, and mapping the adaptee's exceptions onto your domain errors so callers never see a <code>StripeError</code>.</p>
<ol>
<li>Order Service calls <code>gateway.charge(amount, token)</code> against the Target interface.</li>
<li><code>StripeGatewayAdapter</code> converts the amount, builds Stripe's request object, and calls <code>paymentIntents.create</code>.</li>
<li>It maps the SDK response back to your <code>ChargeResult</code> and translates <code>card_declined</code> into your <code>PaymentDeclined</code> error.</li>
</ol>
<pre>// --- Adapter: reshapes the legacy SDK to fit PaymentGateway ---
// NOT a Decorator (does not add behaviour to the same interface)
// NOT a Proxy (does not control access — it changes the interface shape)
public final class StripeGatewayAdapter implements PaymentGateway {
    private final StripeSdk stripe;

    public StripeGatewayAdapter(StripeSdk stripe) {
        this.stripe = stripe;
    }

    @Override
    public ChargeResult charge(Money amount, String paymentMethodToken) {
        try {
            PaymentIntentResponse intent = stripe.createPaymentIntent(
                amount.minorUnits(),           // dollars → cents
                amount.currency(),
                paymentMethodToken
            );
            return new ChargeResult(
                intent.reference(),
                mapStatus(intent.status()),
                intent.id()
            );
        } catch (StripeCardDeclinedException e) {
            throw new PaymentDeclinedException(e.getDeclineCode());
        }
    }

    private ChargeStatus mapStatus(String stripeStatus) {
        return switch (stripeStatus) {
            case "succeeded" -> ChargeStatus.CAPTURED;
            case "processing" -> ChargeStatus.PENDING;
            default -> ChargeStatus.DECLINED;
        };
    }
}</pre>
<p>Because the client is coded only against the Target, you can add an <code>AdyenGatewayAdapter</code> later with no change to the Order Service.</p>` },
    { title: `Trade-offs and confusable patterns`, body: `<p>Adapter adds one class per adaptee and the translation can be lossy if the two models genuinely diverge. Its real value is isolation: vendor churn and quirks stay quarantined behind the port, which keeps the domain testable with fakes.</p>
<pre>// --- Client depends only on the Target, never the adaptee ---
public class OrderService {
    private final PaymentGateway gateway;

    public OrderService(PaymentGateway gateway) { this.gateway = gateway; }

    public void placeOrder(Order order) {
        ChargeResult result = gateway.charge(order.total(), order.paymentToken());
        order.applyChargeResult(result);
    }
}</pre>
<p>Distinguish it from its neighbours:</p>
<ul>
<li><b>Adapter</b> makes an <em>existing, incompatible</em> interface fit a <em>different, expected</em> one — retrofitted after the fact.</li>
<li><b>Decorator</b> keeps the <em>same</em> interface and <em>adds</em> cross-cutting behaviour (retry, metrics) around an already-compatible object.</li>
<li><b>Proxy</b> keeps the same interface but <em>controls access</em> (lazy init, authz, caching) — it does not reshape vendor APIs.</li>
<li><b>Bridge</b> is designed up front so abstraction and implementation vary independently.</li>
</ul>` },
  ],
  figures: [
    { id: "adapter-class", svg: CLASS_SVG, caption: "Object adapter: the client depends only on the PaymentGateway target; the adapter implements it and delegates to the incompatible Stripe SDK." },
  ],
  related: ["bridge", "proxy", "decorator", "facade", "hexagonal-ports-adapters", "anti-corruption-code-boundary"],
});

export const meta = topic.meta;
export const content = topic.content;
