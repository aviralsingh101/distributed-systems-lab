// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const REQREPLY_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Request-reply over messaging with correlation id">
  <defs><marker id="fig-request-reply-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="65" width="140" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="100" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order Service</text>
  <text x="100" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">requester</text>
  <rect x="300" y="20" width="130" height="34" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="365" y="41" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">request queue</text>
  <rect x="300" y="116" width="130" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="365" y="137" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">reply queue</text>
  <rect x="560" y="65" width="140" height="40" rx="6" fill="#1a2236" stroke="#ff8fab" stroke-width="1.5"/>
  <text x="630" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Payment Gateway</text>
  <text x="630" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">replier</text>
  <line x1="170" y1="75" x2="298" y2="40" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-request-reply-arr)"/>
  <line x1="430" y1="40" x2="558" y2="72" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-request-reply-arr)"/>
  <line x1="560" y1="96" x2="432" y2="132" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-request-reply-arr)"/>
  <line x1="298" y1="132" x2="172" y2="98" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-request-reply-arr)"/>
  <text x="365" y="80" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">correlationId + replyTo</text>
</svg>`;

const topic = makeTopic({
  id: "request-reply",
  title: "Request-Reply",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Two-way messaging: a requester sends a message and later receives a matching response, correlated by an ID over a return channel.`,
  figures: [
    { id: "reqreply-flow", svg: REQREPLY_SVG, caption: "Request-reply over a broker: the request carries a correlationId and a replyTo address; the replier posts the response to the reply queue, where the requester matches it by correlationId." },
  ],
  sections: [
    { title: `What request-reply solves`, body: `<p>Fire-and-forget is one-way; <b>request-reply</b> restores the two-way conversation of an RPC but keeps it <em>asynchronous</em>. The requester sends a message and, at some later point, receives a response that it must match back to the original request. It is how you get an answer ("did the Gateway authorize this charge?") without a synchronous, tightly-coupled blocking call.</p>
<p>The core problem it solves is <b>correlation and routing</b>: because many requests are in flight and responses arrive out of order on a shared channel, each reply must be tied to its request, and the replier must know where to send it.</p>` },
    { title: `Structure: correlation ID and reply-to`, figureAfter: "reqreply-flow", body: `<p>Two pieces of metadata make the pattern work:</p>
<ul>
<li><b>Correlation ID</b> — a unique token the requester generates and stamps on the request. The replier copies it verbatim onto the response so the requester can match reply → request (and resolve the right waiting future/promise).</li>
<li><b>Reply-to address</b> — the destination where the response should be sent: a shared reply queue, or a per-consumer <b>exclusive/temporary queue</b>. The replier reads <code>replyTo</code> from the message rather than hard-coding a destination.</li>
</ul>
<p>The requester keeps a pending-requests map (correlationId → callback/future) and completes the entry when a matching reply lands. Unmatched replies (late arrivals after a timeout) are discarded.</p>` },
    { title: `Implementation flow`, body: `<ol>
<li>Requester creates <code>correlationId</code>, records a pending future, and publishes the request with <code>replyTo</code> set.</li>
<li>Replier consumes, does the work, and publishes a response to <code>replyTo</code> carrying the same <code>correlationId</code>.</li>
<li>Requester consumes the reply queue, looks up the pending future by <code>correlationId</code>, and completes it.</li>
<li>A <b>timeout</b> fires if no reply arrives; the requester fails the future and decides whether to retry or surface an error.</li>
</ol>
<p>Synchronous request-reply (blocking the caller's thread until the reply) is a convenience wrapper on top of this; it must always carry a timeout so a lost reply cannot hang the caller forever.</p>
<pre>// --- Request message carries correlationId + replyTo ---
public record AuthorizePaymentRequest(
    UUID correlationId,
    String replyTo,
    UUID paymentId,
    long amountCents,
    String walletId) {}

public record AuthorizePaymentReply(
    UUID correlationId,
    boolean approved,
    String declineReason) {}</pre>
<pre>// --- Requester: pending map + timeout ---
@Service
public class PaymentAuthorizationClient {
    private final KafkaTemplate&lt;String, String&gt; kafka;
    private final ConcurrentMap&lt;UUID, CompletableFuture&lt;AuthorizePaymentReply&gt;&gt; pending
        = new ConcurrentHashMap&lt;&gt;();

    public AuthorizePaymentReply authorize(AuthorizePaymentRequest req) {
        CompletableFuture&lt;AuthorizePaymentReply&gt; future = new CompletableFuture&lt;&gt;();
        pending.put(req.correlationId(), future);
        kafka.send("gateway.authorize.requests", req.paymentId().toString(), Json.write(req));
        return future.orTimeout(5, TimeUnit.SECONDS).join();
    }

    @KafkaListener(topics = "gateway.authorize.replies", groupId = "order-service")
    public void onReply(AuthorizePaymentReply reply) {
        CompletableFuture&lt;AuthorizePaymentReply&gt; f = pending.remove(reply.correlationId());
        if (f != null) f.complete(reply);
    }
}</pre>
<pre>// --- Replier: process and echo correlationId back to replyTo ---
@KafkaListener(topics = "gateway.authorize.requests", groupId = "payment-gateway")
public void handle(AuthorizePaymentRequest req) {
    boolean approved = fraudCheck(req);
    AuthorizePaymentReply reply = new AuthorizePaymentReply(
        req.correlationId(), approved, approved ? null : "FRAUD_SUSPECT");
    kafka.send(req.replyTo(), req.paymentId().toString(), Json.write(reply));
}</pre>` },
    { title: `Semantics and pitfalls`, body: `<p>Because delivery is typically <b>at-least-once</b>, both the request and the reply can be duplicated. Make the replier's work idempotent (key it on the correlationId or a business key) so a redelivered request does not double-charge. A <b>lost reply</b> is indistinguishable from a slow one — after a timeout you may retry, and if the original request actually succeeded you will re-execute it unless it is idempotent.</p>
<p>Prefer real synchronous RPC when you need low latency and the callee is always available. Reach for asynchronous request-reply when the work is slow, the replier may be temporarily down (the broker buffers), or you want to decouple deploy/scaling of the two sides. Watch out for temporary-queue churn and for pending-map leaks when replies never arrive.</p>` },
  ],
  related: ["fire-and-forget", "correlation-trace-ids", "api-idempotency", "pub-sub-pattern", "point-to-point"],
});

export const meta = topic.meta;
export const content = topic.content;
