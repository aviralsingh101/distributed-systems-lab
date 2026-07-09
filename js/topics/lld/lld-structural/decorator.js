// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const WRAP_SVG = `<svg viewBox="0 0 620 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Decorator wrapping chain">
  <defs><marker id="fig-decorator-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="10" y="50" width="90" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="74" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Order Svc</text>
  <rect x="130" y="50" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="185" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Metrics</text>
  <text x="185" y="83" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">decorator</text>
  <rect x="270" y="50" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="325" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Retry</text>
  <text x="325" y="83" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">decorator</text>
  <rect x="410" y="50" width="110" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="465" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">RateLimit</text>
  <text x="465" y="83" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">decorator</text>
  <rect x="550" y="50" width="60" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="580" y="70" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Stripe</text>
  <text x="580" y="83" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">component</text>
  <line x1="100" y1="70" x2="128" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-decorator-arr)"/>
  <line x1="240" y1="70" x2="268" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-decorator-arr)"/>
  <line x1="380" y1="70" x2="408" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-decorator-arr)"/>
  <line x1="520" y1="70" x2="548" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-decorator-arr)"/>
  <text x="310" y="26" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">every box implements the same PaymentGateway interface</text>
</svg>`;

const topic = makeTopic({
  id: "decorator",
  title: "Decorator",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Wrap an object in another object of the same interface to add behaviour at runtime — a composable alternative to subclassing.`,
  sections: [
    { title: `Intent`, body: `<p><b>Decorator</b> attaches additional responsibilities to an object dynamically. Because each decorator implements the same interface as the object it wraps, decorators are a flexible alternative to subclassing for extending behaviour.</p>
<p>The problem it kills is the "cross-cutting concern" subclass explosion. Suppose calls to a <code>PaymentGateway</code> need metrics, retries, and rate limiting. Baking those into subclasses gives you <code>RetryingMetricGateway</code>, <code>RateLimitedRetryingGateway</code>, and every other permutation. Decorator lets you compose those concerns like layers instead.</p>
<pre>// --- Component: the interface every layer shares ---
public interface PaymentGateway {
    ChargeResult charge(ChargeRequest request);
}

// --- Base decorator: holds the wrapped component ---
// NOT an Adapter (same interface, adds behaviour — does not reshape APIs)
// NOT a Proxy (adds cross-cutting concerns, does not control access/lifecycle)
public abstract class PaymentGatewayDecorator implements PaymentGateway {
    protected final PaymentGateway delegate;

    protected PaymentGatewayDecorator(PaymentGateway delegate) {
        this.delegate = delegate;
    }
}</pre>` },
    { title: `Participants and structure`, figureAfter: "decorator-chain", body: `<p>Four roles, all sharing one interface:</p>
<ul>
<li><b>Component</b> — the interface (<code>PaymentGateway.charge()</code>).</li>
<li><b>Concrete Component</b> — the core object being decorated (<code>StripeGateway</code>).</li>
<li><b>Decorator</b> — implements Component and holds a reference to a wrapped Component.</li>
<li><b>Concrete Decorators</b> — <code>MetricsGateway</code>, <code>RetryGateway</code>, <code>RateLimitedGateway</code>: each adds work before and/or after delegating to the wrapped instance.</li>
</ul>
<p>Because a decorator both <em>implements</em> and <em>holds</em> the component type, decorators nest: the client talks to the outermost layer and never knows how deep the stack goes.</p>
<pre>public final class MetricsGateway extends PaymentGatewayDecorator {
    private final MeterRegistry metrics;

    public MetricsGateway(PaymentGateway delegate, MeterRegistry metrics) {
        super(delegate);
        this.metrics = metrics;
    }

    @Override
    public ChargeResult charge(ChargeRequest request) {
        Timer.Sample sample = Timer.start(metrics);
        try {
            return delegate.charge(request);
        } finally {
            sample.stop(metrics.timer("gateway.charge"));
        }
    }
}</pre>` },
    { title: `Implementation and ordering`, body: `<p>You build the stack from the inside out and each layer delegates inward:</p>
<ol>
<li>Wrap the real gateway: <code>new MetricsGateway(new RetryGateway(new RateLimitedGateway(stripe)))</code>.</li>
<li>A call to <code>gw.charge(...)</code> records a timer, then delegates.</li>
<li>The retry layer runs the inner call, re-invoking on transient failure.</li>
<li>The rate-limit layer blocks or rejects, then finally calls the real Stripe gateway.</li>
</ol>
<pre>public final class RetryGateway extends PaymentGatewayDecorator {
    private final int maxAttempts;

    public RetryGateway(PaymentGateway delegate, int maxAttempts) {
        super(delegate);
        this.maxAttempts = maxAttempts;
    }

    @Override
    public ChargeResult charge(ChargeRequest request) {
        GatewayUnavailableException last = null;
        for (int attempt = 1; attempt &lt;= maxAttempts; attempt++) {
            try {
                return delegate.charge(request);
            } catch (GatewayUnavailableException e) {
                last = e;
                sleepBackoff(attempt);
            }
        }
        throw last;
    }
}

// Build from inside out — order matters
PaymentGateway gateway = new MetricsGateway(
    new RetryGateway(
        new RateLimitedGateway(new StripeGateway(stripeClient), rateLimiter),
        3
    ),
    meterRegistry
);</pre>
<p><b>Order matters.</b> Putting retry <em>inside</em> the rate limiter means retries consume tokens; swapping them changes behaviour. Each decorator must faithfully honour the contract (idempotency assumptions, error types) so wrapping stays transparent to the client.</p>` },
    { title: `Trade-offs and Proxy contrast`, body: `<p>Decorator produces many small, single-purpose objects and deep stacks can be hard to debug; object identity is also tricky, since a wrapped object is not <code>==</code> the original. The payoff is that behaviour is composed at runtime and each concern is independently testable.</p>
<p>Decorator and <b>Proxy</b> look identical on a class diagram — same interface, holds a component. The difference is intent: a Decorator <em>adds responsibilities</em> and is designed to stack; a Proxy <em>controls access</em> to a subject (lazy creation, permission checks, remoting) and typically manages one fixed subject. Unlike <b>Composite</b>, a decorator wraps exactly one component rather than aggregating many.</p>` },
  ],
  figures: [
    { id: "decorator-chain", svg: WRAP_SVG, caption: "Each decorator implements PaymentGateway and forwards to the next layer, so cross-cutting concerns stack around the real gateway." },
  ],
  related: ["proxy", "composite", "adapter", "bridge", "chain-of-responsibility"],
});

export const meta = topic.meta;
export const content = topic.content;
