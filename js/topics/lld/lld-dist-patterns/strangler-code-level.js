// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const STR_SVG = `<svg viewBox="0 0 540 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Strangler facade routing to old or new implementation"><defs><marker id="fig-strangler-code-level-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="58" width="96" height="42" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="62" y="76" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Callers</text><text x="62" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">interface</text><rect x="160" y="56" width="120" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="220" y="74" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Facade</text><text x="220" y="88" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">flag routes %</text><rect x="360" y="18" width="150" height="36" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/><text x="435" y="40" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">legacy impl</text><rect x="360" y="98" width="150" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="435" y="120" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">new impl</text><line x1="110" y1="79" x2="158" y2="79" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-strangler-code-level-arr)"/><line x1="280" y1="72" x2="358" y2="40" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="3 3" marker-end="url(#fig-strangler-code-level-arr)"/><line x1="280" y1="86" x2="358" y2="114" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-strangler-code-level-arr)"/><text x="250" y="146" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">shift traffic new; delete legacy when 0% remains</text></svg>`;

const topic = makeTopic({
  id: "strangler-code-level",
  title: "Strangler at Code Level",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Replace a legacy module incrementally by hiding it behind an interface and shifting calls to a new implementation until the old one can be deleted.",
  sections: [
    {
      title: "The problem: rewriting in place is a big-bang risk",
      body: `<p>You have a gnarly legacy class — a tangled <code>PaymentProcessor</code> — that you must modernize. A big-bang rewrite is risky: you cannot ship for weeks, and the cut-over is all-or-nothing. The <b>strangler</b> approach (from Martin Fowler's strangler fig) replaces it <em>gradually</em>: new code grows around the old, taking over responsibilities one at a time, until the legacy is fully surrounded and can be removed.</p>
<p>This page is the <em>code-level</em> variant — refactoring within a codebase — as opposed to the architecture-level strangler fig that migrates whole services behind a routing facade.</p>`,
    },
    {
      title: "Structure — the facade / seam",
      figureAfter: "str-flow",
      body: `<p>The enabling move is to insert an <b>interface (seam)</b> between callers and the legacy code, so callers depend on an abstraction rather than the concrete legacy class:</p>
<ul>
<li>Define <code>PaymentProcessor</code> as an interface.</li>
<li>Wrap the existing code as <code>LegacyPaymentProcessor implements PaymentProcessor</code>.</li>
<li>Point all callers at the interface. Behavior is unchanged — this is a pure, safe refactor.</li>
</ul>
<p>A <b>facade</b> (or a routing/dispatch implementation) now stands where callers used to reach in directly, giving you one controlled place to redirect calls.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>Introduce the interface and adapt the legacy class behind it (no behavior change).</li>
<li>Build a <code>NewPaymentProcessor</code> implementing the same interface for one slice of functionality.</li>
<li>In the facade, route that slice to the new implementation behind a <b>feature flag</b>; keep the rest on legacy.</li>
<li>Verify with tests and (optionally) a <b>parallel run</b>: execute both and compare outputs before trusting the new path.</li>
<li>Shift more slices over incrementally, expanding the flag's scope.</li>
<li>When 100% flows to the new implementation and has soaked in production, delete the legacy class and the facade branch.</li>
</ol>
<pre>// --- Step 1: extract interface, wrap legacy ---
public interface PaymentProcessor {
    PaymentResult process(PaymentRequest request);
}

@Component
public class LegacyPaymentProcessor implements PaymentProcessor {
    @Override
    public PaymentResult process(PaymentRequest req) {
        // existing tangled code unchanged
    }
}</pre>
<pre>// --- Step 2–3: facade routes by feature flag ---
@Component
@Primary
public class RoutingPaymentProcessor implements PaymentProcessor {
    private final LegacyPaymentProcessor legacy;
    private final NewStripeProcessor stripe;
    private final FeatureFlags flags;

    @Override
    public PaymentResult process(PaymentRequest req) {
        if (flags.isEnabled("stripe-processor", req.merchantId())) {
            return stripe.process(req);
        }
        return legacy.process(req);
    }
}</pre>
<pre>// --- Step 4: parallel run for verification ---
public PaymentResult processWithShadow(PaymentRequest req) {
    PaymentResult primary = routing.process(req);
    if (flags.isEnabled("shadow-stripe")) {
        CompletableFuture.runAsync(() -&gt; {
            PaymentResult shadow = stripe.process(req);
            comparator.assertEquivalent(primary, shadow);
        });
    }
    return primary;
}</pre>`,
    },
    {
      title: "Why it works and what to watch",
      body: `<p>Each step is small, independently shippable, and reversible via the flag, so you keep releasing throughout the migration and can roll back instantly. The safety net is <b>characterization tests</b> — tests that pin down the legacy's current behavior (bugs included) so the new implementation is proven equivalent. Risks: the interface must be a clean seam (a leaky one drags legacy assumptions forward); running two implementations in parallel adds temporary complexity and cost; and teams often forget the final <em>delete</em> step, leaving dead code and permanent branching.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> low-risk, incremental modernization with continuous delivery; instant rollback via flags; forces clean abstractions that improve testability even before the rewrite finishes.</p>
<p><b>Cons:</b> the codebase temporarily hosts two implementations plus routing scaffolding; requires disciplined test coverage of legacy behavior; benefits vanish if you never complete and clean up. <b>Use when</b> the legacy is too big or risky to rewrite at once and must keep running; <b>avoid</b> when the module is small enough to rewrite and swap in a single safe change.</p>`,
    },
  ],
  figures: [
    { id: "str-flow", svg: STR_SVG, caption: "Code-level strangler: callers depend on an interface; a facade shifts a growing share of calls from the legacy to the new implementation until legacy is deleted." },
  ],
  related: ["strangler-fig", "anti-corruption-code-boundary", "test-doubles"],
});

export const meta = topic.meta;
export const content = topic.content;
