// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "error-contract-design",
  title: "Error Contract Design",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Design errors as a first-class, stable part of your API: consistent status codes, machine-readable codes, and a documented body shape clients can program against.`,
  sections: [
    { title: `Errors are part of the contract`, body: `<p>An API's error responses are as much a contract as its success responses — clients write code against them. Yet errors are routinely an afterthought: a 500 with an HTML stack trace here, a 200 with <code>{"error": true}</code> there, free-text messages that change between releases. <b>Error contract design</b> makes failure predictable so callers can react programmatically: retry, show a field-level validation message, refresh a token, or fail hard.</p>
<p>The core principle: <b>the HTTP status code says what category of thing happened; a stable machine-readable code says exactly what; a human-readable message helps developers.</b> Never signal failure with a 200.</p>
<pre>// Stable error codes — clients branch on these, not on message text
public enum PaymentErrorCode {
    WALLET_NOT_FOUND,
    WALLET_INSUFFICIENT_FUNDS,
    PAYMENT_ALREADY_CAPTURED,
    PAYMENT_DECLINED,
    IDEMPOTENCY_KEY_CONFLICT,
    VALIDATION_FAILED
}</pre>` },
    { title: `Structure of a good error body`, body: `<p>Standardize on <b>RFC 7807 Problem Details</b> (<code>application/problem+json</code>) or a close equivalent. A well-formed error carries:</p>
<ul>
<li><b>A correct HTTP status</b> — 4xx for client faults, 5xx for server faults (this drives caching, retries, and dashboards).</li>
<li><b>A stable <code>code</code></b> — a machine string like <code>wallet_insufficient_funds</code> that never changes wording. Clients branch on this, not on the message.</li>
<li><b>A human <code>message</code> / <code>detail</code></b> — for developers/logs, safe to reword.</li>
<li><b>Field-level errors</b> for validation — an array of <code>{ field, code, message }</code> so a form can highlight the right input.</li>
<li><b>A <code>trace_id</code> / correlation id</b> so a user can quote it and support can find the exact request in logs.</li>
</ul>
<p>Example: <code>{ "type": "...", "title": "Insufficient funds", "status": 422, "code": "wallet_insufficient_funds", "trace_id": "abc-123" }</code>.</p>
<pre>// Global exception handler — one envelope everywhere
@RestControllerAdvice
public class PaymentExceptionHandler {

    @ExceptionHandler(WalletNotFoundException.class)
    public ProblemDetail handleWalletNotFound(WalletNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND,
            "Wallet " + ex.getWalletId() + " does not exist");
        problem.setTitle("Wallet not found");
        problem.setType(URI.create("https://api.example.com/errors/wallet_not_found"));
        problem.setProperty("code", PaymentErrorCode.WALLET_NOT_FOUND.name());
        problem.setProperty("trace_id", RequestContext.correlationId());
        return problem;
    }

    @ExceptionHandler(InsufficientFundsException.class)
    public ProblemDetail handleInsufficientFunds(InsufficientFundsException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Wallet balance is " + ex.getAvailable() + ", requested " + ex.getRequested());
        problem.setTitle("Insufficient funds");
        problem.setType(URI.create("https://api.example.com/errors/insufficient_funds"));
        problem.setProperty("code", PaymentErrorCode.WALLET_INSUFFICIENT_FUNDS.name());
        problem.setProperty("trace_id", RequestContext.correlationId());
        return problem;
    }
}</pre>` },
    { title: `Choosing the right status code`, body: `<p>Map failure classes deliberately: <b>400</b> malformed request; <b>401</b> not authenticated; <b>403</b> authenticated but not allowed; <b>404</b> resource absent; <b>409</b> state conflict (charge already captured); <b>422</b> syntactically valid but business-rule failure (insufficient funds, card expired); <b>429</b> rate-limited (add <code>Retry-After</code>); <b>5xx</b> server-side.</p>
<p>This split is operational, not cosmetic: the caller retries <b>5xx, 429, and timeouts</b> with backoff but must <b>not</b> retry a 4xx (retrying a 422 will just fail again and may double-submit). Getting the code wrong — returning 500 for a validation error, or 200 for a decline — breaks every client's retry logic.</p>
<pre>@ExceptionHandler(PaymentAlreadyCapturedException.class)
public ProblemDetail handleAlreadyCaptured(PaymentAlreadyCapturedException ex) {
    // 409 Conflict — state clash, not a server fault
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT,
        "Payment " + ex.getPaymentId() + " is already captured");
    problem.setProperty("code", PaymentErrorCode.PAYMENT_ALREADY_CAPTURED.name());
    return problem;
}

@ExceptionHandler(GatewayUnavailableException.class)
public ProblemDetail handleGatewayDown(GatewayUnavailableException ex) {
    // 503 — retryable server-side fault
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.SERVICE_UNAVAILABLE,
        "Payment processor temporarily unavailable");
    problem.setProperty("code", "gateway_unavailable");
    problem.setProperty("retryable", true);
    return problem;
}</pre>` },
    { title: `Consistency, security, and evolution`, body: `<p>Apply the same shape <b>everywhere</b> — one error envelope across all endpoints and services (enforce it in a shared middleware / exception handler, not per-controller). Treat error codes like an enum you version: add new codes freely, but don't repurpose an existing one.</p>
<p><b>Don't leak internals</b>: never return stack traces, SQL, or PAN/PII in error bodies on public APIs; log the detail server-side keyed by <code>trace_id</code> and return a generic message. A disciplined error contract turns "the API returned an error" into an actionable, testable, secure behavior.</p>
<pre>// Validation errors — field-level detail for forms
@ExceptionHandler(MethodArgumentNotValidException.class)
public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
    problem.setTitle("Validation failed");
    problem.setProperty("code", PaymentErrorCode.VALIDATION_FAILED.name());

    List&lt;Map&lt;String, String&gt;&gt; fieldErrors = ex.getBindingResult()
        .getFieldErrors().stream()
        .map(fe -&gt; Map.of(
            "field", fe.getField(),
            "code", fe.getCode(),
            "message", fe.getDefaultMessage()))
        .toList();
    problem.setProperty("errors", fieldErrors);
    return problem;
}

// Security: log detail server-side, return generic message to client
@ExceptionHandler(Exception.class)
public ProblemDetail handleUnexpected(Exception ex) {
    String traceId = RequestContext.correlationId();
    log.error("unhandled error trace_id={}", traceId, ex);
    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
    problem.setDetail("An unexpected error occurred. Reference: " + traceId);
    problem.setProperty("trace_id", traceId);
    return problem;
}</pre>` },
  ],
  related: ["rest-resource-modeling", "correlation-trace-ids", "api-idempotency", "api-versioning-strategies", "grpc-service-design"],
});

export const meta = topic.meta;
export const content = topic.content;
