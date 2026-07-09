// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const SC_SVG = `<svg viewBox="0 0 720 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Structured concurrency scope tree">
  <defs><marker id="fig-structured-concurrency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="250" y="20" width="220" height="150" rx="10" fill="none" stroke="#7c5cff" stroke-width="1.6" stroke-dasharray="5 4"/>
  <text x="360" y="40" text-anchor="middle" fill="#7c5cff" font-size="10" font-family="system-ui">scope — opens, forks, joins, closes</text>
  <rect x="290" y="52" width="140" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="360" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">parent task</text>
  <rect x="270" y="110" width="80" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="310" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">child A</text>
  <rect x="370" y="110" width="80" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="410" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">child B</text>
  <line x1="345" y1="82" x2="310" y2="108" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-structured-concurrency-arr)"/>
  <line x1="375" y1="82" x2="410" y2="108" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-structured-concurrency-arr)"/>
  <text x="120" y="95" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">parent cannot exit</text>
  <text x="120" y="111" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">until all children</text>
  <text x="120" y="127" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">finish or are cancelled</text>
  <text x="600" y="95" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">A fails →</text>
  <text x="600" y="111" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">B is cancelled</text>
</svg>`;

const topic = makeTopic({
  id: "structured-concurrency",
  title: "Structured Concurrency",
  category: "lld-concurrency",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Bind the lifetime of concurrent tasks to a lexical scope so that errors, cancellation, and completion propagate like they do in ordinary structured code.`,
  sections: [
    { title: `The problem with unstructured tasks`, body: `<p>Ad-hoc concurrency — spawn a task and move on — breaks the block structure programmers rely on. Once you <code>go</code>/<code>submit</code>/fire a task, it outlives the function that started it: nobody necessarily waits for it, its errors surface somewhere unrelated, and cancelling the parent operation leaks the still-running children. <b>Structured concurrency</b> applies the same discipline to concurrent tasks that <code>{ }</code> blocks apply to sequential code: tasks have a bounded lifetime tied to a lexical <b>scope</b>.</p>` },
    { title: `The core rule`, figureAfter: "sc", body: `<p>The defining principle: <b>a scope does not return until every task started inside it has completed</b> (finished, failed, or been cancelled). Concurrency is opened and closed like a bracket. Structurally:</p>
<ol>
<li>Open a scope.</li>
<li><b>Fork</b> one or more child tasks inside it.</li>
<li><b>Join</b> — wait for the children at the end of the scope.</li>
<li>The scope closes; no child can outlive it.</li>
</ol>
<p>Because children live within the parent's scope, the call tree and the concurrency tree line up again: you can look at a block of code and know exactly which tasks it may have running.</p>
<pre>// Fan-out: authorize, fraud-check, FX lookup — all-or-nothing
public PaymentQuote quotePayment(QuoteRequest req) throws Exception {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        Subtask&lt;AuthResult&gt; auth = scope.fork(() -&gt; authService.authorize(req));
        Subtask&lt;FraudScore&gt; fraud = scope.fork(() -&gt; fraudService.score(req));
        Subtask&lt;Money&gt; fx     = scope.fork(() -&gt; fxService.convert(req.amount()));

        scope.join();
        scope.throwIfFailed();  // any child failure cancels siblings

        return new PaymentQuote(auth.get(), fraud.get(), fx.get());
    }
}

// CompletableFuture equivalent — same structured discipline
public CompletableFuture&lt;PaymentQuote&gt; quotePaymentAsync(QuoteRequest req) {
    CompletableFuture&lt;AuthResult&gt; auth = CompletableFuture.supplyAsync(
        () -&gt; authService.authorize(req), virtualExec);
    CompletableFuture&lt;FraudScore&gt; fraud = CompletableFuture.supplyAsync(
        () -&gt; fraudService.score(req), virtualExec);
    CompletableFuture&lt;Money&gt; fx = CompletableFuture.supplyAsync(
        () -&gt; fxService.convert(req.amount()), virtualExec);

    return CompletableFuture.allOf(auth, fraud, fx)
        .thenApply(v -&gt; new PaymentQuote(auth.join(), fraud.join(), fx.join()));
}</pre>` },
    { title: `Cancellation and error propagation`, body: `<p>Scoping makes failure handling automatic. In a typical "fan-out and wait for all" scope, if one child <b>throws</b>, the scope <b>cancels the siblings</b> (their work is no longer needed), waits for them to unwind, and propagates the error to the parent — no orphaned tasks, no leaked resources. Cancellation flows <b>downward</b>: cancelling the parent cancels the whole subtree. A "race / any-of" scope instead cancels the losers as soon as the first child succeeds. This turns error and timeout handling from bespoke plumbing into a property of the structure.</p>
<pre>// Race: first gateway response wins, losers cancelled
public ChargeResult chargeWithFallback(ChargeRequest req) throws Exception {
    try (var scope = new StructuredTaskScope.ShutdownOnSuccess&lt;ChargeResult&gt;()) {
        scope.fork(() -&gt; stripeGateway.charge(req));
        scope.fork(() -&gt; adyenGateway.charge(req));
        scope.join();
        return scope.result();  // losing gateway call interrupted
    }
}

// Timeout: parent deadline cancels entire subtree
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    scope.fork(() -&gt; ledgerService.reserve(req.walletId(), req.amount()));
    scope.fork(() -&gt; gateway.charge(req));
    scope.joinUntil(Instant.now().plusSeconds(5));
    scope.throwIfFailed();
}</pre>` },
    { title: `Where you meet it`, body: `<p>The idea is realized in Kotlin coroutine scopes (<code>coroutineScope</code>, <code>supervisorScope</code>), Swift's <code>TaskGroup</code>, Trio/anyio nurseries in Python, and the JVM's <code>StructuredTaskScope</code> (from Project Loom, pairing naturally with virtual threads). A concrete use: a request handler that must call three services and combine their results opens a scope, forks three tasks, and joins — if any call fails or the overall deadline fires, the rest are cancelled and cleaned up as a unit. Contrast this with unstructured executors where a failed sub-call leaves the others running and consuming a connection long after the response was abandoned.</p>` },
  ],
  figures: [
    { id: "sc", svg: SC_SVG, caption: "Child tasks are confined to a scope: the parent waits for all of them, and a child failure cancels its siblings." },
  ],
  related: ["threads-vs-async", "virtual-threads", "async-await-pitfalls", "thread-pool"],
});

export const meta = topic.meta;
export const content = topic.content;
