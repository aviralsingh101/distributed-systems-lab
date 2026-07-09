// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "correlation-trace-ids",
  title: "Correlation / Trace IDs",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Stamp every request with an ID that flows through every service, log line, and message so you can reconstruct one request's whole journey across a distributed system.`,
  sections: [
    { title: `Why you need them`, body: `<p>In a monolith, one request is one thread and one log stream — easy to follow. In a distributed system, a single <code>POST /v1/charge</code> fans out across the <b>Order Service</b>, <b>Payment Gateway</b>, <b>Ledger</b>, and <b>Event Queue</b>, each on different hosts writing to different logs, interleaved with thousands of other requests. Without a shared identifier you cannot tell which log lines belong to <em>this</em> charge. <b>Correlation and trace IDs</b> are the thread you pull to reassemble that story.</p>
<pre>// Request context — one ID per logical charge
public final class RequestContext {
    private static final ThreadLocal&lt;String&gt; CORRELATION_ID = new ThreadLocal&lt;&gt;();
    private static final ThreadLocal&lt;String&gt; TRACE_ID = new ThreadLocal&lt;&gt;();

    public static void set(String correlationId, String traceId) {
        CORRELATION_ID.set(correlationId);
        TRACE_ID.set(traceId);
    }

    public static String correlationId() {
        return CORRELATION_ID.get();
    }

    public static void clear() {
        CORRELATION_ID.remove();
        TRACE_ID.remove();
    }
}</pre>` },
    { title: `Correlation ID vs trace/span`, body: `<p>Two related but distinct concepts:</p>
<ul>
<li><b>Correlation ID</b> — one opaque ID that identifies a single logical request/transaction end to end. Attach it to every log line and propagate it to every downstream call so all work for that request shares one key.</li>
<li><b>Trace ID + span IDs</b> (distributed tracing) — a <b>trace ID</b> identifies the whole request tree, while each hop creates a <b>span</b> (with its own span ID and a parent span ID) capturing timing. Spans reconstruct not just <em>what</em> happened but the causal tree and where the latency went.</li>
</ul>
<p>A correlation ID gives you groupable logs; tracing gives you a timed, hierarchical waterfall. Modern stacks standardize both via the <b>W3C <code>traceparent</code></b> header and OpenTelemetry.</p>
<pre>// W3C traceparent: 00-{trace-id}-{parent-span-id}-{flags}
// Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

@Component
public class TraceContextFilter extends OncePerRequestFilter {

    private static final String TRACEPARENT = "traceparent";
    private static final String REQUEST_ID = "X-Request-ID";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String correlationId = Optional.ofNullable(request.getHeader(REQUEST_ID))
            .filter(s -&gt; !s.isBlank())
            .orElseGet(() -&gt; UUID.randomUUID().toString());

        String traceparent = request.getHeader(TRACEPARENT);
        String traceId = parseTraceId(traceparent).orElse(correlationId);

        RequestContext.set(correlationId, traceId);
        MDC.put("correlation_id", correlationId);
        MDC.put("trace_id", traceId);

        response.setHeader(REQUEST_ID, correlationId);
        try {
            chain.doFilter(request, response);
        } finally {
            RequestContext.clear();
            MDC.clear();
        }
    }
}</pre>` },
    { title: `Implementation flow`, body: `<ol>
<li><b>Generate or accept at the edge</b> — the gateway/first service reads an inbound <code>X-Request-ID</code>/<code>traceparent</code> if present (trust boundaries permitting) or generates a new one.</li>
<li><b>Store in context</b> — put the ID in a request-scoped context (thread-local, async-local, or the tracing context) so any code can read it without threading it through every function signature.</li>
<li><b>Inject into logs</b> — a logging filter adds the ID to every structured log entry automatically.</li>
<li><b>Propagate outward</b> — HTTP clients add the header on every outbound call; message producers stamp it into message headers so <b>async</b> consumers keep the same ID (tracing across the queue, not just synchronous calls).</li>
</ol>
<pre>// Outbound HTTP client — propagate headers to Payment Gateway
@Component
public class TracingRestClientInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body,
            ClientHttpRequestExecution execution) throws IOException {
        String correlationId = RequestContext.correlationId();
        if (correlationId != null) {
            request.getHeaders().set("X-Request-ID", correlationId);
        }
        return execution.execute(request, body);
    }
}

// Payment service logs with automatic MDC injection
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    public PaymentResponse charge(CreatePaymentRequest req) {
        log.info("charging wallet={} amount={}", req.walletId(), req.amountMinor());
        // log output: {"correlation_id":"abc-123","msg":"charging wallet=w-7 amount=5000"}
        return paymentGateway.charge(req);
    }
}</pre>` },
    { title: `Getting it right in production`, body: `<p>The pattern only pays off if propagation is <b>complete</b> — one service that drops the header breaks the chain and you lose the trail exactly where an incident often hides. Enforce it in shared middleware/interceptors rather than relying on each team.</p>
<p>Practical notes: make IDs high-entropy and collision-resistant (UUID/ULID); include the correlation ID in <b>error responses</b> so a user can quote it to support; keep IDs opaque and non-sensitive (never encode PII); and remember async — the biggest gap is usually forgetting to carry the ID through the Event Queue into consumers. With IDs everywhere, debugging a failed payment becomes a single log query instead of a cross-team archaeology dig.</p>
<pre>// Async: stamp correlation ID into Kafka message headers
@Service
public class PaymentEventPublisher {

    private final KafkaTemplate&lt;String, PaymentCapturedEvent&gt; kafka;

    public void publish(PaymentCapturedEvent event) {
        String correlationId = RequestContext.correlationId();
        ProducerRecord&lt;String, PaymentCapturedEvent&gt; record =
            new ProducerRecord&lt;&gt;("payments.captured", event.paymentId(), event);
        if (correlationId != null) {
            record.headers().add("X-Request-ID",
                correlationId.getBytes(StandardCharsets.UTF_8));
        }
        kafka.send(record);
    }
}

// Error response includes trace_id for support lookup
@ExceptionHandler(PaymentDeclinedException.class)
public ProblemDetail handleDecline(PaymentDeclinedException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
    problem.setProperty("code", "payment_declined");
    problem.setProperty("trace_id", RequestContext.correlationId());
    return problem;
}</pre>` },
  ],
  related: ["error-contract-design", "request-reply", "api-idempotency", "rest-resource-modeling", "pub-sub-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("correlation-trace-ids", stage, panel, stageEl);
}
