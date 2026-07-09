// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "rest-resource-modeling",
  title: "REST Resource Modeling",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Model your API as nouns (resources) addressed by URIs and manipulated with a small set of HTTP verbs and status codes — not as RPC verbs in the path.`,
  sections: [
    { title: `Resources, not actions`, body: `<p><b>REST resource modeling</b> means designing your API around <b>nouns</b> — the things in your domain — and letting HTTP methods supply the verbs. A resource is anything worth a URI: a payment, an order, a wallet. You expose <code>/payments/123</code>, not <code>/getPayment?id=123</code> or <code>/createPaymentAndCharge</code>. The URI names the thing; the method says what to do to it.</p>
<p>Model both <b>collections</b> (<code>/payments</code>) and <b>instances</b> (<code>/payments/123</code>), and nest to show relationships (<code>/orders/45/payments</code>). Keep paths as plural nouns, lowercase, hierarchical, and free of verbs — the resistance to naming an endpoint <code>/doCharge</code> is the whole discipline.</p>
<pre>// Resource DTOs — nouns, not verbs
public record PaymentResponse(
    String id,
    String walletId,
    long amountMinor,
    String currency,
    PaymentStatus status,
    Instant createdAt
) {}

public record CreatePaymentRequest(
    String walletId,
    long amountMinor,
    String currency
) {}

public enum PaymentStatus { PENDING, CAPTURED, DECLINED, REFUNDED }</pre>` },
    { title: `Methods and their semantics`, body: `<p>The verbs carry contractual guarantees clients and proxies rely on:</p>
<ul>
<li><b>GET</b> — read; <b>safe</b> (no side effects) and <b>idempotent</b>. Cacheable.</li>
<li><b>PUT</b> — replace/create at a known URI; <b>idempotent</b> (repeating it yields the same state).</li>
<li><b>PATCH</b> — partial update; not guaranteed idempotent.</li>
<li><b>DELETE</b> — remove; idempotent (deleting twice leaves it deleted).</li>
<li><b>POST</b> — create a subordinate resource or trigger processing; <b>neither safe nor idempotent</b> — this is why <code>POST /payments</code> needs an idempotency key.</li>
</ul>
<p>Because POST is not idempotent, creating a charge (<code>POST /orders/45/payments</code>) can double-charge on retry unless you add an <code>Idempotency-Key</code>. GET/PUT/DELETE can be retried safely by design.</p>
<pre>@RestController
@RequestMapping("/v1")
public class PaymentResourceController {

    private final PaymentService paymentService;

    public PaymentResourceController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    // GET /v1/payments/{id} — safe, idempotent, cacheable
    @GetMapping("/payments/{id}")
    public ResponseEntity&lt;PaymentResponse&gt; getPayment(@PathVariable String id) {
        return paymentService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // POST /v1/orders/{orderId}/payments — NOT idempotent; needs Idempotency-Key
    @PostMapping("/orders/{orderId}/payments")
    public ResponseEntity&lt;PaymentResponse&gt; createPayment(
            @PathVariable String orderId,
            @RequestBody CreatePaymentRequest body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        PaymentResponse created = paymentService.charge(orderId, body, idempotencyKey);
        URI location = URI.create("/v1/payments/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    // DELETE /v1/payments/{id} — idempotent; second call is still 204
    @DeleteMapping("/payments/{id}")
    public ResponseEntity&lt;Void&gt; voidPayment(@PathVariable String id) {
        paymentService.voidPayment(id);
        return ResponseEntity.noContent().build();
    }
}</pre>` },
    { title: `Status codes that mean something`, body: `<p>Return codes that let a client act without parsing prose:</p>
<ul>
<li><b>200 OK</b> — success with a body; <b>201 Created</b> — resource made, with a <code>Location</code> header; <b>202 Accepted</b> — async work queued; <b>204 No Content</b> — success, empty body.</li>
<li><b>400</b> malformed request; <b>401</b> unauthenticated; <b>403</b> authenticated but forbidden; <b>404</b> not found; <b>409 Conflict</b> — state clash (e.g. already captured); <b>422</b> valid syntax but failing business rules.</li>
<li><b>429</b> rate-limited; <b>5xx</b> server-side — only these (plus timeouts) should be blindly retried.</li>
</ul>
<p>The 4xx-vs-5xx split matters operationally: 4xx means "don't retry, fix the request", 5xx means "our fault, retry with backoff".</p>
<pre>// Wallet collection — GET returns 200; POST returns 201 + Location
@RestController
@RequestMapping("/v1/wallets")
public class WalletResourceController {

    private final WalletService walletService;

    public WalletResourceController(WalletService walletService) {
        this.walletService = walletService;
    }

    @GetMapping("/{walletId}")
    public WalletResponse getWallet(@PathVariable String walletId) {
        return walletService.findById(walletId)
            .orElseThrow(() -&gt; new WalletNotFoundException(walletId));
    }

    @PostMapping
    public ResponseEntity&lt;WalletResponse&gt; createWallet(@RequestBody CreateWalletRequest req) {
        WalletResponse created = walletService.create(req);
        URI location = URI.create("/v1/wallets/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    // GET /v1/wallets/{walletId}/ledger-entries — nested sub-resource
    @GetMapping("/{walletId}/ledger-entries")
    public List&lt;LedgerEntryResponse&gt; listLedgerEntries(
            @PathVariable String walletId,
            @RequestParam(defaultValue = "20") int limit) {
        return walletService.listLedgerEntries(walletId, limit);
    }
}</pre>` },
    { title: `Applying it to a payment API`, body: `<p>A clean model, step by step, following the request flow: <code>POST /orders</code> creates an order (201 + Location); <code>POST /orders/{id}/payments</code> with an <code>Idempotency-Key</code> initiates a charge (201 or 202 if the Gateway is async); <code>GET /payments/{id}</code> reads status (cacheable); a refund is its own sub-resource <code>POST /payments/{id}/refunds</code> rather than a <code>PUT ?action=refund</code>.</p>
<p>Keep representations consistent (same field names, same money format), version the media type or path, and don't leak database internals into resource shapes. The payoff is an API whose behavior — caching, retry-safety, error handling — is predictable from HTTP semantics alone.</p>
<pre>// Refund as its own sub-resource — not PUT /payments/{id}?action=refund
@RestController
@RequestMapping("/v1/payments")
public class RefundResourceController {

    private final RefundService refundService;

    public RefundResourceController(RefundService refundService) {
        this.refundService = refundService;
    }

    @PostMapping("/{paymentId}/refunds")
    public ResponseEntity&lt;RefundResponse&gt; createRefund(
            @PathVariable String paymentId,
            @RequestBody RefundRequest body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        RefundResponse refund = refundService.refund(paymentId, body, idempotencyKey);
        URI location = URI.create("/v1/refunds/" + refund.id());
        return ResponseEntity.created(location).body(refund);
    }

    // Async capture: 202 Accepted when Gateway processes out-of-band
    @PostMapping("/{paymentId}/capture")
    public ResponseEntity&lt;PaymentResponse&gt; capturePayment(@PathVariable String paymentId) {
        CaptureResult result = refundService.capture(paymentId);
        if (result.isAsync()) {
            return ResponseEntity.accepted().body(result.payment());
        }
        return ResponseEntity.ok(result.payment());
    }
}</pre>` },
  ],
  related: ["api-versioning-strategies", "error-contract-design", "api-idempotency", "pagination-offset-cursor", "hateoas"],
});

export const meta = topic.meta;
export const content = topic.content;
