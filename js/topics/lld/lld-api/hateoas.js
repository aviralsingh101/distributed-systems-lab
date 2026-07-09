// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "hateoas",
  title: "HATEOAS",
  category: "lld-api",
  track: "lld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `Responses embed hypermedia links to the actions available next, so a client discovers what it can do from the server rather than hard-coding URLs and rules.`,
  sections: [
    { title: `What HATEOAS is`, body: `<p><b>HATEOAS</b> — Hypermedia As The Engine Of Application State — is the constraint that puts the "REST" in a truly RESTful API. It is the top level (level 3) of the <b>Richardson Maturity Model</b>. The idea: a response doesn't just return data, it returns <b>links</b> describing the state transitions available from here, exactly as a web page returns anchors and forms a human follows without knowing the site's URL structure in advance.</p>
<p>The application's state is driven by the hypermedia the server sends — the client navigates by following links the server provides, not by constructing URLs from out-of-band documentation.</p>
<pre>// HAL-style link model — the server decides what is legal next
public record Link(String rel, String href, String method) {}

public record PaymentHalResponse(
    String id,
    String walletId,
    long amountMinor,
    String currency,
    PaymentStatus status,
    Map&lt;String, Link&gt; links
) {}

public enum PaymentStatus { AUTHORIZED, CAPTURED, VOIDED, REFUNDED }</pre>` },
    { title: `How it works`, body: `<p>Consider a payment resource. A non-HATEOAS API returns <code>{ "id": 123, "status": "authorized" }</code> and the client must <em>know</em> that authorized payments can be captured at <code>POST /payments/123/capture</code>. A HATEOAS response instead includes the valid next actions as links:</p>
<p><code>{ "id": 123, "status": "authorized", "_links": { "self": {"href": "/payments/123"}, "capture": {"href": "/payments/123/capture", "method": "POST"}, "void": {"href": "/payments/123/void", "method": "POST"} } }</code></p>
<p>When the payment is already captured, the server simply omits the <code>capture</code> and <code>void</code> links and offers a <code>refund</code> link. The set of links <em>is</em> the state machine: the client enables buttons based on which links are present, and the server — the authority on state — decides what's allowed.</p>
<pre>@RestController
@RequestMapping("/v1/payments")
public class PaymentHalController {

    private final PaymentService paymentService;

    public PaymentHalController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/{id}")
    public PaymentHalResponse getPayment(@PathVariable String id) {
        Payment payment = paymentService.findById(id)
            .orElseThrow(() -&gt; new PaymentNotFoundException(id));
        return toHalResponse(payment);
    }

    // Links are the state machine — only legal transitions appear
    private PaymentHalResponse toHalResponse(Payment payment) {
        Map&lt;String, Link&gt; links = new LinkedHashMap&lt;&gt;();
        String base = "/v1/payments/" + payment.getId();
        links.put("self", new Link("self", base, "GET"));

        switch (payment.getStatus()) {
            case AUTHORIZED -&gt; {
                links.put("capture", new Link("capture", base + "/capture", "POST"));
                links.put("void", new Link("void", base + "/void", "POST"));
            }
            case CAPTURED -&gt; {
                links.put("refund", new Link("refund", base + "/refunds", "POST"));
            }
            case VOIDED, REFUNDED -&gt; { /* terminal — no action links */ }
        }

        return new PaymentHalResponse(
            payment.getId(),
            payment.getWalletId(),
            payment.getAmountMinor(),
            payment.getCurrency(),
            payment.getStatus(),
            links
        );
    }
}</pre>` },
    { title: `Why it matters (and the theory)`, body: `<p>The promised benefits are <b>discoverability</b> and <b>decoupling</b>. Clients stop hard-coding URL templates and business rules ("can I capture?"); they follow links and check for their presence, so the server can move endpoints or change transition rules without breaking clients. Standard media types like <b>HAL</b>, <b>JSON:API</b>, and <b>Siren</b> formalize how links and actions are represented.</p>
<p>It also centralizes workflow logic on the server: the rule "you can only refund a captured payment" lives in one place and is communicated by the links, not duplicated in every client.</p>
<pre>// Spring HATEOAS — EntityModel wraps data + links
@GetMapping("/{id}")
public EntityModel&lt;PaymentDto&gt; getPaymentWithSpringHateoas(@PathVariable String id) {
    Payment payment = paymentService.findById(id)
        .orElseThrow(() -&gt; new PaymentNotFoundException(id));

    EntityModel&lt;PaymentDto&gt; model = EntityModel.of(toDto(payment));
    model.add(linkTo(methodOn(PaymentHalController.class)
        .getPaymentWithSpringHateoas(id)).withSelfRel());

    if (payment.getStatus() == PaymentStatus.AUTHORIZED) {
        model.add(linkTo(methodOn(PaymentHalController.class)
            .capturePayment(id)).withRel("capture"));
        model.add(linkTo(methodOn(PaymentHalController.class)
            .voidPayment(id)).withRel("void"));
    }
    if (payment.getStatus() == PaymentStatus.CAPTURED) {
        model.add(linkTo(methodOn(RefundResourceController.class)
            .createRefund(id, null, null)).withRel("refund"));
    }
    return model;
}</pre>` },
    { title: `Reality: why adoption is thin`, body: `<p>Despite being "true REST", full HATEOAS is uncommon. Most clients are written against fixed, documented API versions and simply ignore the link section, so the decoupling benefit goes unrealized while payloads grow. Generic hypermedia-driven clients are hard to build; developers usually want typed SDKs generated from a schema, not runtime link-following. Tooling and caching around hypermedia are weaker than around plain resource APIs.</p>
<p>Where it does earn its keep: long-lived APIs with diverse clients, and especially <b>workflow/state-machine resources</b> (payments, orders, approvals) where advertising the currently-legal transitions genuinely simplifies clients. For most internal CRUD APIs, a good OpenAPI contract delivers more value than link-following, and partial HATEOAS (a few navigational links like <code>next</code>/<code>self</code>) is the pragmatic middle ground.</p>
<pre>// Partial HATEOAS — pagination links without full state machine
public record PaymentPageResponse(
    List&lt;PaymentDto&gt; payments,
    Map&lt;String, Link&gt; links
) {}

@GetMapping
public PaymentPageResponse listPayments(
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(required = false) String after) {
    PaymentPage page = paymentService.findPage(limit, after);
    Map&lt;String, Link&gt; links = new LinkedHashMap&lt;&gt;();
    links.put("self", new Link("self",
        "/v1/payments?limit=" + limit + (after != null ? "&amp;after=" + after : ""),
        "GET"));
    if (page.hasNext()) {
        links.put("next", new Link("next",
            "/v1/payments?limit=" + limit + "&amp;after=" + page.endCursor(),
            "GET"));
    }
    return new PaymentPageResponse(page.payments(), links);
}</pre>` },
  ],
  related: ["rest-resource-modeling", "api-versioning-strategies", "error-contract-design", "contract-first-vs-code-first", "graphql-schema-design"],
});

export const meta = topic.meta;
export const content = topic.content;
