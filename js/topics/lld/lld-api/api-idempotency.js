// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const IDEM_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Idempotency-Key flow">
  <defs><marker id="fig-api-idempotency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="65" width="110" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="75" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text>
  <text x="75" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">retries POST</text>
  <rect x="200" y="65" width="150" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="275" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order Service</text>
  <text x="275" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">check key store</text>
  <rect x="420" y="20" width="150" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="495" y="37" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">new key → charge</text>
  <text x="495" y="52" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">store result</text>
  <rect x="420" y="110" width="150" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="495" y="127" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">seen key → replay</text>
  <text x="495" y="142" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">no double charge</text>
  <line x1="130" y1="85" x2="198" y2="85" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-api-idempotency-arr)"/>
  <text x="164" y="78" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">Idempotency-Key</text>
  <line x1="350" y1="78" x2="418" y2="48" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-api-idempotency-arr)"/>
  <line x1="350" y1="92" x2="418" y2="122" stroke="#ffb454" stroke-width="1.5" marker-end="url(#fig-api-idempotency-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "api-idempotency",
  title: "API Idempotency",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Let clients safely retry unsafe operations (like charging a card) by attaching an Idempotency-Key so the server executes the effect at most once.`,
  figures: [
    { id: "idem-flow", svg: IDEM_SVG, caption: "The client sends the same Idempotency-Key on retries; the server executes and stores the result on first sight, then replays the stored response for any repeat — so a charge happens once." },
  ],
  sections: [
    { title: `The problem: retries over an unreliable network`, body: `<p>When a client sends <code>POST /payments</code> and the connection drops before the response arrives, the client cannot tell whether the charge happened. If it retries, it risks <b>double-charging</b>; if it doesn't, it risks a lost payment. <b>GET/PUT/DELETE are idempotent by definition</b> (repeating them changes nothing extra), but <b>POST is not</b> — and money movement is exactly the operation you most need to retry safely. API idempotency closes this gap.</p>
<pre>// Client generates one UUID per logical charge attempt
String idempotencyKey = UUID.randomUUID().toString();

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("/v1/payments"))
    .header("Idempotency-Key", idempotencyKey)
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
    .build();

// Retry the SAME request (same key, same body) until a response arrives
PaymentResponse response = retryUntilResponse(request);</pre>` },
    { title: `The Idempotency-Key mechanism`, figureAfter: "idem-flow", body: `<p>The client generates a unique key per logical operation (a UUID) and sends it in an <b>Idempotency-Key</b> header. The server uses it to guarantee <b>at-most-once</b> execution of the effect:</p>
<ol>
<li>On arrival, the server looks up the key in an idempotency store.</li>
<li><b>New key</b> — record it (typically with a lock/"in-progress" marker), perform the charge, persist the response against the key, and return it.</li>
<li><b>Seen key, completed</b> — do <em>not</em> re-execute; return the stored response verbatim. The retry is a no-op that yields the original result.</li>
<li><b>Seen key, still in progress</b> — return <code>409</code>/retry-later so two concurrent copies don't both execute.</li>
</ol>
<p>Crucially the <b>same key must return the same response</b> as the first call, so the client can retry blindly until it gets an answer.</p>
<pre>// Servlet filter — enforce Idempotency-Key on POST /payments
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class IdempotencyKeyFilter extends OncePerRequestFilter {

    private static final Set&lt;String&gt; PROTECTED_PATHS =
        Set.of("/v1/payments", "/v1/orders");

    private final IdempotencyStore idempotencyStore;

    public IdempotencyKeyFilter(IdempotencyStore idempotencyStore) {
        this.idempotencyStore = idempotencyStore;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!"POST".equals(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        String path = request.getRequestURI();
        if (!PROTECTED_PATHS.stream().anyMatch(path::startsWith)) {
            chain.doFilter(request, response);
            return;
        }

        String key = request.getHeader("Idempotency-Key");
        if (key == null || key.isBlank()) {
            response.setStatus(400);
            response.getWriter().write("{\"code\":\"missing_idempotency_key\"}");
            return;
        }

        Optional&lt;StoredResponse&gt; cached = idempotencyStore.lookup(key);
        if (cached.isPresent()) {
            replayStoredResponse(response, cached.get());
            return;
        }

        // Wrap response to capture body for storage after successful execution
        ContentCachingResponseWrapper wrapped =
            new ContentCachingResponseWrapper(response);
        idempotencyStore.markInProgress(key);
        try {
            chain.doFilter(request, wrapped);
            idempotencyStore.store(key, wrapped.getStatus(), wrapped.getContentAsByteArray());
            wrapped.copyBodyToResponse();
        } catch (Exception ex) {
            idempotencyStore.clearInProgress(key);
            throw ex;
        }
    }
}</pre>` },
    { title: `Implementation details that matter`, body: `<p><b>Atomicity:</b> record the key and perform the effect in a way that can't race — a unique constraint on the key, or an <code>INSERT ... ON CONFLICT</code>, so two simultaneous retries can't both pass the check. <b>Scope:</b> a key should be scoped to an account/endpoint and (ideally) validated against a hash of the request body, so reusing a key with a <em>different</em> payload is rejected rather than silently returning the wrong stored result.</p>
<p><b>Expiry:</b> keep keys for a bounded window (e.g. 24h) — long enough to cover client retries, short enough to bound storage. <b>Downstream:</b> propagate idempotency to the <b>Payment Gateway</b> call too (most gateways accept their own idempotency key), so a retry inside your service doesn't double-charge the real processor.</p>
<pre>@Entity
@Table(name = "idempotency_keys",
       uniqueConstraints = @UniqueConstraint(columnNames = "key_hash"))
public class IdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "key_hash", nullable = false, length = 64)
    private String keyHash;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "status", nullable = false)
    private IdempotencyStatus status;  // IN_PROGRESS | COMPLETED

    @Column(name = "response_status")
    private int responseStatus;

    @Lob
    @Column(name = "response_body")
    private byte[] responseBody;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}

@Service
public class PaymentService {

    @Transactional
    public PaymentResponse charge(CreatePaymentRequest req, String idempotencyKey) {
        // Propagate key to Payment Gateway — at-most-once end to end
        ChargeResult gatewayResult = paymentGateway.charge(
            new ChargeRequest(req.walletId(), req.amountMinor(),
                req.currency(), idempotencyKey)
        );
        Payment payment = paymentRepository.save(mapToPayment(gatewayResult));
        ledgerRepository.recordDebit(req.walletId(), req.amountMinor());
        return toResponse(payment);
    }
}</pre>` },
    { title: `Relationship to other guarantees`, body: `<p>Idempotency keys give <b>at-most-once effect</b> on the write path; they are the request-side complement to the <b>inbox pattern</b> (dedup on the message-consumer side) and to a broker's at-least-once delivery. Together they let a client "retry until success" without fear.</p>
<p>Apply idempotency to every non-idempotent, high-stakes endpoint: charges, refunds, transfers, order creation. Skip it only where the operation is naturally idempotent or the duplicate is harmless. Treat a missing Idempotency-Key on a charge endpoint as a design bug, not an edge case.</p>
<pre>// Reject key reuse with a different request body
public Optional&lt;StoredResponse&gt; lookup(String key, String requestBody) {
    String keyHash = sha256(key);
    String requestHash = sha256(requestBody);
    return repository.findByKeyHash(keyHash)
        .map(record -&gt; {
            if (!record.getRequestHash().equals(requestHash)) {
                throw new IdempotencyKeyConflictException(key);
            }
            if (record.getStatus() == IdempotencyStatus.IN_PROGRESS) {
                throw new IdempotencyInProgressException(key);
            }
            return new StoredResponse(record.getResponseStatus(),
                record.getResponseBody());
        });
}</pre>` },
  ],
  related: ["idempotency-key", "rest-resource-modeling", "error-contract-design", "correlation-trace-ids", "outbox-inbox-combo"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("api-idempotency", stage, panel, stageEl);
}
