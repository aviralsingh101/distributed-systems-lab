// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const ACL_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Anti-corruption layer translation">
  <defs><marker id="fig-anti-corruption-code-boundary-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="60" width="150" height="55" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="105" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Legacy / vendor</text>
  <text x="105" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">foreign model</text>
  <rect x="285" y="50" width="150" height="75" rx="8" fill="#1a2236" stroke="#7c5cff" stroke-width="1.8"/>
  <text x="360" y="80" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">ACL</text>
  <text x="360" y="98" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">adapter + translator</text>
  <rect x="540" y="60" width="150" height="55" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="615" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Our domain</text>
  <text x="615" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">clean model</text>
  <line x1="180" y1="87" x2="283" y2="87" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-anti-corruption-code-boundary-arr)"/>
  <line x1="435" y1="87" x2="538" y2="87" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-anti-corruption-code-boundary-arr)"/>
  <text x="360" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">foreign concepts stop at the boundary — never leak inward</text>
</svg>`;

const topic = makeTopic({
  id: "anti-corruption-code-boundary",
  title: "Anti-Corruption at Code",
  category: "lld-ddd",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `A translation layer that maps a foreign or legacy model into your own domain terms, so their concepts never contaminate your model.`,
  sections: [
    { title: `The problem it prevents`, body: `<p>Whenever your context integrates with a legacy system, a third-party API, or another team's service, its model leaks in. If you call a payment provider whose API talks about "transaction states 0–9" and cram those into your domain, your clean concept of a Payment slowly rots into a mirror of their quirks. An <b>anti-corruption layer</b> (ACL) is the defensive boundary that stops this: it translates between the external model and your domain model so foreign concepts, naming, and data shapes stay <em>outside</em>.</p>` },
    { title: `Structure`, figureAfter: "acl", body: `<p>An ACL is not one class but a small cluster with three collaborating roles (Evans' vocabulary):</p>
<pre>// Outbound port — domain vocabulary only
public interface PaymentGateway {
    ChargeResult charge(ChargeRequest request);
}

// Adapter + translator — foreign Stripe concepts stay here
public final class StripePaymentGatewayAdapter implements PaymentGateway {
    private final StripeClient stripe;

    @Override
    public ChargeResult charge(ChargeRequest req) {
        PaymentIntent intent = stripe.paymentIntents().create(
            PaymentIntentCreateParams.builder()
                .setAmount(req.amount().amountMinor())
                .setCurrency(req.amount().currency().toLowerCase())
                .setIdempotencyKey(req.paymentId())
                .build()
        );
        return translate(intent);  // Stripe status → domain ChargeResult
    }

    private ChargeResult translate(PaymentIntent intent) {
        ChargeStatus status = switch (intent.getStatus()) {
            case "succeeded" -&gt; ChargeStatus.CAPTURED;
            case "processing" -&gt; ChargeStatus.PENDING;
            default -&gt; ChargeStatus.DECLINED;
        };
        return new ChargeResult(intent.getMetadata().get("payment_id"), status, intent.getId());
    }
}

// OrderService depends only on PaymentGateway — never imports Stripe
@Service
public class OrderService {
    private final PaymentGateway gateway;
}</pre>
<p>Everything foreign is confined here; the rest of the code depends only on your domain interface.</p>
<pre>// Legacy mainframe DTO — foreign model we do not import into domain
public record LegacyTxnDto(
    String txn_ref,      // opaque reference
    int status_code,     // 0-9 numeric states
    long amt_cents,
    String ccy
) {}

// ACL: adapter + translator at the boundary
public final class LegacyPaymentAcl implements PaymentGatewayPort {
    private final LegacyMainframeClient legacy;

    public LegacyPaymentAcl(LegacyMainframeClient legacy) {
        this.legacy = legacy;
    }

    @Override
    public ChargeResult charge(ChargeRequest req) {
        LegacyTxnDto raw = legacy.submitTxn(
            req.paymentId(), req.amount().toMinorUnits(), req.amount().currency().getCurrencyCode());
        return LegacyPaymentTranslator.toChargeResult(req.paymentId(), raw);
    }
}

final class LegacyPaymentTranslator {
    static ChargeResult toChargeResult(String paymentId, LegacyTxnDto dto) {
        ChargeStatus status = switch (dto.status_code()) {
            case 3, 4 -&gt; ChargeStatus.CAPTURED;
            case 1, 2 -&gt; ChargeStatus.PENDING;
            default    -&gt; ChargeStatus.DECLINED;
        };
        return new ChargeResult(paymentId, status, dto.txn_ref());
    }
}</pre>` },
    { title: `How it fits with bounded contexts`, body: `<p>The ACL is one relationship type on a <b>context map</b> — the way a downstream context protects itself from an upstream one it does not control. It is the implementation-level counterpart of the strategic pattern: where "bounded context" says <em>each model is consistent only within its boundary</em>, the ACL is the code that enforces that boundary at an integration point. The same idea appears on the way <em>out</em> too: rather than publishing your internal domain events, you translate them into a deliberately-shaped integration event — an anti-corruption step protecting consumers from your internals.</p>` },
    { title: `Costs and when to use it`, body: `<p>An ACL is real code to write, test, and maintain, and it adds an indirection and a mapping cost on every call — so it is not free. Use it when the external model is genuinely different from or messier than yours, when you are strangling a legacy system incrementally, or when an upstream dependency changes often and you want a single place to absorb the churn. Skip it when the external contract is already clean and closely matches your model — a thin adapter is enough, and a full ACL would be ceremony. The payoff is that when the vendor changes their API or you swap providers entirely, only the translator changes; your domain never notices.</p>
<pre>// When legacy changes status_code 4 → "SETTLED", only the translator updates
static ChargeResult toChargeResult(String paymentId, LegacyTxnDto dto) {
    ChargeStatus status = switch (dto.status_code()) {
        case 3, 4, 7 -&gt; ChargeStatus.CAPTURED;  // added 7 in new mainframe release
        case 1, 2     -&gt; ChargeStatus.PENDING;
        default       -&gt; ChargeStatus.DECLINED;
    };
    return new ChargeResult(paymentId, status, dto.txn_ref());
}

// Domain service unchanged — still calls PaymentGatewayPort.charge()
ChargeResult result = paymentGateway.charge(request);
// OrderService, LedgerService, tests: zero changes</pre>` },
  ],
  figures: [
    { id: "acl", svg: ACL_SVG, caption: "The ACL adapter and translator convert the foreign model into domain terms at the boundary, keeping foreign concepts out of the core." },
  ],
  related: ["bounded-context", "hexagonal-ports-adapters", "domain-vs-integration-events", "repository-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
