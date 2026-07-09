// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "api-versioning-strategies",
  title: "API Versioning Strategies",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `How to evolve an API without breaking existing clients: version in the URL, in a header, or via media-type negotiation — each with different visibility and routing costs.`,
  sections: [
    { title: `Why version at all`, body: `<p>Once a client depends on your API you cannot freely change it. Some changes are <b>backward-compatible</b> and need no new version — adding an optional field, a new endpoint, a new enum value a tolerant client ignores. Others are <b>breaking</b>: removing/renaming a field, changing a type, tightening validation, altering semantics. Versioning exists to ship breaking changes while old clients keep working against the old contract.</p>
<p>The prime directive is <b>don't break existing consumers</b>. Prefer additive, non-breaking evolution (Postel's law: be liberal in what you accept); reach for a new version only when a genuinely incompatible change is unavoidable.</p>
<pre>// v1 response — amount in minor units (cents)
public record PaymentResponseV1(
    String id,
    String walletId,
    long amountMinor,
    String currency,
    String status
) {}

// v2 response — breaking change: amount is a structured Money object
public record PaymentResponseV2(
    String id,
    String walletId,
    Money amount,
    String status,
    Instant capturedAt
) {}

public record Money(long minorUnits, String currency) {}</pre>` },
    { title: `URL path versioning`, body: `<p><code>GET /v1/payments/123</code> → <code>/v2/payments/123</code>. The version is a visible path segment.</p>
<p><b>Pros:</b> dead simple, obvious in logs and browsers, trivial to route (gateway sends <code>/v1</code> and <code>/v2</code> to different services), easy to explore and cache. <b>Cons:</b> it is arguably un-RESTful — the same underlying resource now has two URIs, so <code>/v1/payments/123</code> and <code>/v2/payments/123</code> are "different resources"; clients must rewrite URLs to upgrade. Despite the purist objection, this is what most large public APIs (Stripe-style major versions aside) actually use because operability wins.</p>
<pre>// URL path versioning — separate controllers per major version
@RestController
@RequestMapping("/v1/payments")
public class PaymentControllerV1 {

    private final PaymentService paymentService;

    public PaymentControllerV1(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/{id}")
    public PaymentResponseV1 getPayment(@PathVariable String id) {
        Payment payment = paymentService.findById(id)
            .orElseThrow(() -&gt; new PaymentNotFoundException(id));
        return new PaymentResponseV1(
            payment.getId(), payment.getWalletId(),
            payment.getAmountMinor(), payment.getCurrency(),
            payment.getStatus().name()
        );
    }
}

@RestController
@RequestMapping("/v2/payments")
public class PaymentControllerV2 {

    private final PaymentService paymentService;

    public PaymentControllerV2(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/{id}")
    public PaymentResponseV2 getPayment(@PathVariable String id) {
        Payment payment = paymentService.findById(id)
            .orElseThrow(() -&gt; new PaymentNotFoundException(id));
        return new PaymentResponseV2(
            payment.getId(), payment.getWalletId(),
            new Money(payment.getAmountMinor(), payment.getCurrency()),
            payment.getStatus().name(),
            payment.getCapturedAt()
        );
    }
}</pre>` },
    { title: `Header and media-type versioning`, body: `<p><b>Custom header:</b> <code>Api-Version: 2</code> keeps URIs stable and version orthogonal to routing. <b>Media-type (content negotiation):</b> <code>Accept: application/vnd.myco.payment.v2+json</code> — the "most RESTful" option, since the URI identifies the resource and the representation is negotiated.</p>
<p><b>Pros:</b> stable URIs; a resource keeps one address. <b>Cons:</b> the version is invisible in the URL (harder to debug, can't paste in a browser), easy for clients to forget (you need a sensible default), and gateway routing on headers is fiddlier. Media-type versioning is powerful but many client libraries and caches handle custom <code>Accept</code> types poorly.</p>
<pre>// Header versioning — stable URI, version in Api-Version header
@RestController
@RequestMapping("/payments")
public class PaymentVersionedController {

    private final PaymentService paymentService;

    public PaymentVersionedController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping(value = "/{id}", headers = "Api-Version=1")
    public PaymentResponseV1 getPaymentV1(@PathVariable String id) {
        return toV1(paymentService.findById(id).orElseThrow());
    }

    @GetMapping(value = "/{id}", headers = "Api-Version=2")
    public PaymentResponseV2 getPaymentV2(@PathVariable String id) {
        return toV2(paymentService.findById(id).orElseThrow());
    }

    // Default when header absent — don't break old clients
    @GetMapping("/{id}")
    public PaymentResponseV1 getPaymentDefault(@PathVariable String id) {
        return toV1(paymentService.findById(id).orElseThrow());
    }
}</pre>` },
    { title: `Decision guide`, body: `<p>Practical guidance:</p>
<ul>
<li><b>Default to URL path versioning</b> for public APIs and anywhere operability, debuggability, and gateway routing matter most — the cost is theoretical, the benefit is real.</li>
<li><b>Use header/media-type versioning</b> when you value strict REST semantics, stable URIs, and fine-grained representation negotiation, and your clients/tooling handle it well.</li>
<li>Version <b>coarsely</b> (a small number of major versions like <code>v1</code>, <code>v2</code>), not per-endpoint or per-field — many concurrent versions is a maintenance tax.</li>
<li>Whatever you choose: publish a <b>deprecation policy</b> (sunset dates, <code>Deprecation</code>/<code>Sunset</code> headers), keep old versions alive long enough to migrate, and prefer additive changes so you rarely need a new version at all.</li>
</ul>
<pre>// Deprecation headers — communicate sunset to clients
@GetMapping("/{id}")
public ResponseEntity&lt;PaymentResponseV1&gt; getPaymentV1(@PathVariable String id) {
    PaymentResponseV1 body = toV1(paymentService.findById(id).orElseThrow());
    return ResponseEntity.ok()
        .header("Deprecation", "true")
        .header("Sunset", "Sat, 01 Jan 2028 00:00:00 GMT")
        .header("Link", "&lt;https://docs.example.com/migrate-v2&gt;; rel=\"deprecation\"")
        .body(body);
}

// Media-type negotiation
@GetMapping(value = "/{id}",
    produces = "application/vnd.example.payment.v2+json")
public PaymentResponseV2 getPaymentV2MediaType(@PathVariable String id) {
    return toV2(paymentService.findById(id).orElseThrow());
}</pre>` },
  ],
  related: ["rest-resource-modeling", "contract-first-vs-code-first", "error-contract-design", "graphql-schema-design", "grpc-service-design"],
});

export const meta = topic.meta;
export const content = topic.content;
