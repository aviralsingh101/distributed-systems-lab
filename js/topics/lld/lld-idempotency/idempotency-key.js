// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "idempotency-key", title: "Idempotency-Key", category: "idempotency" };

const KEY_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Idempotency key store returning the saved result on a retry">
  <defs><marker id="fig-idempotency-key-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="30" width="140" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="90" y="48" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Request #1</text>
  <text x="90" y="63" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Key: abc-123</text>
  <rect x="20" y="112" width="140" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="90" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Retry (same key)</text>
  <text x="90" y="145" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Key: abc-123</text>
  <rect x="290" y="70" width="180" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.8"/>
  <text x="380" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Idempotency store</text>
  <text x="380" y="105" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">abc-123 → charge #778, 200</text>
  <line x1="160" y1="50" x2="288" y2="82" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-idempotency-key-arr)"/>
  <text x="225" y="58" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">insert → charge once</text>
  <line x1="160" y1="132" x2="288" y2="104" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-idempotency-key-arr)"/>
  <text x="225" y="140" text-anchor="middle" fill="#5b9dff" font-size="9" font-family="system-ui">hit → replay saved result</text>
  <rect x="560" y="70" width="140" height="44" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.4"/>
  <text x="630" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Wallet</text>
  <text x="630" y="105" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">debited exactly once</text>
  <line x1="470" y1="92" x2="558" y2="92" stroke="#93a1bd" stroke-width="1.2" marker-end="url(#fig-idempotency-key-arr)"/>
</svg>`;

export const content = {
  oneliner: `A client-supplied unique key on a write request that lets the server detect and collapse retries, so a re-sent charge executes exactly once and returns the original result.`,
  archetype: "pattern",
  figures: [
    { id: "idem-key-flow", svg: KEY_SVG, caption: "The first request with key abc-123 performs the charge and stores its result; a retry with the same key finds the record and replays the saved response instead of charging again." },
  ],
  sections: [
    { title: `The problem it solves`, body: `<p>Network calls fail ambiguously. A client sends "charge $50," the server processes it, but the response is lost to a timeout. The client cannot tell whether the charge happened, so it retries — and without protection the customer is billed twice. Retries are unavoidable and correct behavior in distributed systems; the job of an <b>idempotency key</b> is to make a retried write have the same effect as sending it once. It turns an unsafe operation (POST a payment) into one that is safe to repeat.</p>` },
    { title: `Structure`, figureAfter: "idem-key-flow", body: `<p>The client generates a unique key per <em>logical operation</em> — a UUID, typically sent in an <code>Idempotency-Key</code> header (this is exactly how Stripe's and PayPal's APIs work). The server keeps an <b>idempotency store</b>: a table keyed by that value, holding the request's status and, once complete, the saved response. The key identifies "this specific attempt to do this specific thing," so all retries of it share one record.</p>
<p>Crucially the key must be stable across retries (the client reuses the same key when retrying) but different for genuinely different operations, so two separate $50 charges are not mistaken for one.</p>
<pre>@Service
public class IdempotencyService {
    private final IdempotencyKeyRepository repo;
    private final PaymentGateway gateway;
    private final LedgerService ledger;

    @Transactional
    public ChargeResponse charge(ChargeRequest req, String idempotencyKey) {
        String hash = sha256(idempotencyKey + ":" + req.walletId());

        Optional&lt;IdempotencyKeyRecord&gt; existing = repo.findByKeyHash(hash);
        if (existing.isPresent()) {
            IdempotencyKeyRecord rec = existing.get();
            if (rec.getStatus() == Status.COMPLETED) {
                return deserialize(rec.getResponseBody());
            }
            throw new ConflictException("Charge in progress for key");
        }

        repo.save(new IdempotencyKeyRecord(hash, Status.IN_PROGRESS));

        ChargeResult result = gateway.charge(req);
        if (result.status() == ChargeStatus.CAPTURED) {
            ledger.debit(req.walletId(), req.amount(), req.paymentId());
        }

        ChargeResponse response = ChargeResponse.from(result);
        repo.markCompleted(hash, 200, serialize(response));
        return response;
    }
}</pre>` },
    { title: `Processing flow, step by step`, body: `<ol>
<li><b>Insert-or-find.</b> On arrival, atomically insert a row for the key in an <code>in-progress</code> state. Use a unique constraint so two concurrent retries race and exactly one wins the insert.</li>
<li><b>First time (won the insert):</b> perform the operation — debit the wallet, call the gateway — and then store the result and mark the row <code>completed</code>, ideally in the <em>same transaction</em> as the effect so they commit together.</li>
<li><b>Duplicate (row already exists):</b> if <code>completed</code>, return the stored response verbatim without re-executing. If still <code>in-progress</code>, the original is running concurrently — return a "retry later" / 409 so you do not double-apply.</li>
</ol>
<p>Binding the effect and the key record in one atomic commit is what closes the crash window: you never end up having charged without recording the key, or recorded the key without charging.</p>
<pre>// Idempotency-Key header filter (Spring)
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class IdempotencyKeyFilter extends OncePerRequestFilter {
    private final IdempotencyService idempotency;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String key = req.getHeader("Idempotency-Key");
        if (key == null || !"POST".equals(req.getMethod())) {
            chain.doFilter(req, res);
            return;
        }
        Optional&lt;CachedResponse&gt; cached = idempotency.find(key);
        if (cached.isPresent()) {
            res.setStatus(cached.get().status());
            res.getWriter().write(cached.get().body());
            return;
        }
        ContentCachingResponseWrapper wrapped =
            new ContentCachingResponseWrapper(res);
        idempotency.begin(key);
        try {
            chain.doFilter(req, wrapped);
            idempotency.complete(key, wrapped.getStatus(),
                new String(wrapped.getContentAsByteArray()));
            wrapped.copyBodyToResponse();
        } catch (Exception e) {
            idempotency.fail(key);
            throw e;
        }
    }
}

@Entity
@Table(name = "idempotency_keys",
       uniqueConstraints = @UniqueConstraint(columnNames = "key_hash"))
public class IdempotencyKeyRecord {
    @Id @GeneratedValue private Long id;
    @Column(name = "key_hash", nullable = false) private String keyHash;
    @Enumerated(EnumType.STRING) private Status status; // IN_PROGRESS, COMPLETED
    private int responseStatus;
    @Lob private String responseBody;
    private Instant createdAt;
    public enum Status { IN_PROGRESS, COMPLETED, FAILED }
}</pre>` },
    { title: `Subtleties to get right`, body: `<ul>
<li><b>Atomicity.</b> If the debit and the key record are separate commits, a crash between them either double-charges or loses the record. Put both in one transaction, or use the store's conditional insert as the fence.</li>
<li><b>Concurrent duplicates.</b> Two retries can arrive at once; the unique-key insert must serialize them so only the first executes.</li>
<li><b>Request fingerprint.</b> Optionally hash the request body and store it with the key; if the same key arrives with a <em>different</em> body, reject it — that is a client bug, not a retry.</li>
<li><b>Expiry.</b> Keys need a TTL (hours to days) long enough to cover realistic retry windows; too short and a late retry re-executes.</li>
<li><b>Scope.</b> A key is meaningful within one endpoint/tenant; namespace it so unrelated operations cannot collide.</li>
</ul>` },
    { title: `Where it fits`, body: `<p>Idempotency keys are the standard defense for any <b>non-idempotent HTTP write</b> a client may retry — payments, transfers, order creation. They are the request-layer counterpart to broker-side <b>deduplication</b> (which keys off event ids) and the concrete mechanism that makes "exactly-once processing" achievable on top of at-least-once delivery. Expose the header in your API, generate a fresh key per user intent on the client, and keep the store's write atomic with the side effect.</p>` },
  ],
  related: ["deduplication", "exactly-once", "duplicate-events", "fencing-tokens", "tcc", "consumer-rebalancing"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("idempotency-key", stage, panel, stageEl);
}
