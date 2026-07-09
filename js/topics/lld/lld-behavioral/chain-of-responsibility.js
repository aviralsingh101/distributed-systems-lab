// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const CHAIN_SVG = `<svg viewBox="0 0 620 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chain of responsibility pipeline">
  <defs><marker id="fig-chain-of-responsibility-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="10" y="55" width="70" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.4"/>
  <text x="45" y="79" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">request</text>
  <rect x="110" y="55" width="95" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="157" y="79" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">FraudCheck</text>
  <rect x="235" y="55" width="95" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="282" y="79" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">BalanceCheck</text>
  <rect x="360" y="55" width="95" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="407" y="79" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">VelocityLimit</text>
  <rect x="485" y="55" width="120" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/>
  <text x="545" y="79" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Authorize</text>
  <line x1="80" y1="75" x2="108" y2="75" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-chain-of-responsibility-arr)"/>
  <line x1="205" y1="75" x2="233" y2="75" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-chain-of-responsibility-arr)"/>
  <line x1="330" y1="75" x2="358" y2="75" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-chain-of-responsibility-arr)"/>
  <line x1="455" y1="75" x2="483" y2="75" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-chain-of-responsibility-arr)"/>
  <line x1="282" y1="95" x2="282" y2="120" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-chain-of-responsibility-arr)"/>
  <text x="360" y="123" fill="#ff6b6b" font-size="8" font-family="system-ui">reject → short-circuit</text>
  <text x="300" y="30" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">each handler decides: handle, or pass to next</text>
</svg>`;

const topic = makeTopic({
  id: "chain-of-responsibility",
  title: "Chain of Responsibility",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Pass a request along a line of handlers, each free to handle it or forward it — decoupling the sender from whichever object ultimately responds.`,
  sections: [
    { title: `Intent`, body: `<p><b>Chain of Responsibility</b> avoids coupling the sender of a request to its receiver by giving more than one object a chance to handle it. The receivers are linked into a chain, and the request travels along it until a handler deals with it (or it falls off the end).</p>
<p>Authorizing a payment is a natural fit: it must pass fraud scoring, a balance check, a velocity limit, and compliance rules before it executes. Each of those is an independent handler, and any one of them can stop the request cold.</p>
<pre>// --- Handler: each link in the chain ---
public abstract class PaymentHandler {
    private PaymentHandler next;

    public PaymentHandler setNext(PaymentHandler next) {
        this.next = next;
        return next;  // fluent chaining
    }

    public final AuthResult handle(PaymentRequest request) {
        AuthResult result = doHandle(request);
        if (!result.approved()) return result;       // short-circuit
        return next != null ? next.handle(request) : result;
    }

    protected abstract AuthResult doHandle(PaymentRequest request);
}</pre>` },
    { title: `Participants and structure`, figureAfter: "cor-chain", body: `<p>The pattern is deliberately small:</p>
<ul>
<li><b>Handler</b> — an interface with <code>handle(request)</code> and a link to the <code>next</code> handler.</li>
<li><b>Concrete Handlers</b> — <code>FraudCheck</code>, <code>BalanceCheck</code>, <code>VelocityLimit</code>, <code>Authorize</code>. Each either fully handles the request, or does its part and delegates to <code>next</code>.</li>
<li><b>Client</b> — assembles the chain and hands the request to the first handler.</li>
</ul>
<pre>public final class FraudCheckHandler extends PaymentHandler {
    private final FraudScorer scorer;

    public FraudCheckHandler(FraudScorer scorer) { this.scorer = scorer; }

    @Override
    protected AuthResult doHandle(PaymentRequest request) {
        double score = scorer.score(request);
        if (score &gt; 0.8) {
            return AuthResult.rejected("fraud_score_too_high");
        }
        return AuthResult.approved();
    }
}

public final class BalanceCheckHandler extends PaymentHandler {
    private final WalletService wallet;

    public BalanceCheckHandler(WalletService wallet) { this.wallet = wallet; }

    @Override
    protected AuthResult doHandle(PaymentRequest request) {
        if (!wallet.hasSufficientFunds(request.walletId(), request.amount())) {
            return AuthResult.rejected("insufficient_funds");
        }
        return AuthResult.approved();
    }
}</pre>
<p>This is exactly how HTTP <b>middleware</b> pipelines (Express, servlet filters) work: each middleware inspects the request and calls <code>next()</code> or ends the pipeline.</p>` },
    { title: `Implementation flow`, body: `<p>Control flows down the chain, and any handler can short-circuit it:</p>
<ol>
<li>Client builds the chain: <code>fraud.setNext(balance).setNext(velocity).setNext(authorize)</code>.</li>
<li>It submits the request to the head: <code>fraud.handle(payment)</code>.</li>
<li>Each handler checks its rule. If it passes, it calls <code>next.handle(payment)</code>; if it fails (say the balance is short), it returns a rejection and the request never reaches the later handlers.</li>
</ol>
<pre>// --- Client assembles the chain ---
PaymentHandler pipeline = new FraudCheckHandler(fraudScorer);
pipeline.setNext(new BalanceCheckHandler(wallet))
        .setNext(new VelocityLimitHandler(rateLimiter))
        .setNext(new AuthorizeHandler(paymentGateway));

AuthResult result = pipeline.handle(paymentRequest);
if (!result.approved()) {
    throw new PaymentRejectedException(result.reason());
}</pre>
<p>The chain can be reordered or extended at runtime — insert a new <code>SanctionsCheck</code> without touching the existing handlers.</p>` },
    { title: `Trade-offs and Decorator contrast`, body: `<p>The pattern decouples sender from receiver and gives each rule a single responsibility, but it has a defining weakness: there is <b>no guarantee</b> the request is handled — if no handler claims it, it silently drops off the end, so you often add a terminal default handler. Long chains are also harder to trace, and ordering is significant.</p>
<p>It looks like <b>Decorator</b> — both chain objects of a common type — but the semantics differ. In a Decorator, <em>every</em> layer runs and always delegates, wrapping a single operation with added behaviour. In Chain of Responsibility, a request travels until <em>one</em> handler handles it, and a handler may choose <em>not</em> to forward. Decorator augments; the chain dispatches.</p>` },
  ],
  figures: [
    { id: "cor-chain", svg: CHAIN_SVG, caption: "A payment authorization pipeline: each handler passes the request onward or rejects it, short-circuiting the rest." },
  ],
  related: ["decorator", "command", "specification-pattern", "message-router", "backpressure-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
