// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const SPEC_SVG = `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Specification composition">
  <defs><marker id="fig-specification-pattern-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="200" y="14" width="160" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="280" y="34" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">And</text>
  <text x="280" y="50" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">isSatisfiedBy(payment)</text>
  <rect x="40" y="100" width="150" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="115" y="120" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">HighValueSpec</text>
  <text x="115" y="134" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">amount &gt; 1000</text>
  <rect x="210" y="100" width="140" height="46" rx="6" fill="#7c5cff22" stroke="#7c5cff" stroke-width="1.4"/>
  <text x="280" y="120" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Not</text>
  <rect x="230" y="150" width="150" height="34" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="305" y="171" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">TrustedMerchantSpec</text>
  <rect x="400" y="100" width="150" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="475" y="120" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">ForeignCountrySpec</text>
  <text x="475" y="134" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">country != home</text>
  <line x1="245" y1="60" x2="140" y2="98" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-specification-pattern-arr)"/>
  <line x1="280" y1="60" x2="280" y2="98" stroke="#7c5cff" stroke-width="1.3" marker-end="url(#fig-specification-pattern-arr)"/>
  <line x1="315" y1="60" x2="450" y2="98" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-specification-pattern-arr)"/>
  <line x1="285" y1="146" x2="300" y2="148" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-specification-pattern-arr)"/>
  <text x="470" y="176" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">needsReview = high AND not(trusted) AND foreign</text>
</svg>`;

const topic = makeTopic({
  id: "specification-pattern",
  title: "Specification Pattern",
  category: "lld-behavioral",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Wrap each business rule in a small predicate object, then combine them with and/or/not to build complex rules from simple, testable pieces.`,
  sections: [
    { title: `Intent`, body: `<p>The <b>Specification</b> pattern (from domain-driven design) encapsulates a business rule as a predicate object that answers a single question — <code>isSatisfiedBy(candidate)</code> — and can be combined with boolean operators to form larger rules. It turns rules into first-class, named, reusable values instead of anonymous <code>if</code> conditions buried in service methods.</p>
<p>Payment risk is full of such rules: "high value", "foreign country", "new account", "trusted merchant". You need them in different combinations for fraud review, limits, and reporting. Specifications let you name each once and recombine them freely.</p>
<pre>// --- Specification interface with fluent combinators ---
public interface Specification&lt;T&gt; {
    boolean isSatisfiedBy(T candidate);

    default Specification&lt;T&gt; and(Specification&lt;T&gt; other) {
        return candidate -&gt; this.isSatisfiedBy(candidate) &amp;&amp; other.isSatisfiedBy(candidate);
    }

    default Specification&lt;T&gt; or(Specification&lt;T&gt; other) {
        return candidate -&gt; this.isSatisfiedBy(candidate) || other.isSatisfiedBy(candidate);
    }

    default Specification&lt;T&gt; not() {
        return candidate -&gt; !this.isSatisfiedBy(candidate);
    }
}</pre>` },
    { title: `Structure`, figureAfter: "spec-tree", body: `<p>It is a small composite of predicates:</p>
<ul>
<li><b>Specification</b> — the interface with <code>isSatisfiedBy(candidate): boolean</code>, plus fluent combinators <code>and()</code>, <code>or()</code>, <code>not()</code>.</li>
<li><b>Leaf specifications</b> — one rule each: <code>HighValueSpec</code>, <code>ForeignCountrySpec</code>, <code>TrustedMerchantSpec</code>.</li>
<li><b>Composite specifications</b> — <code>AndSpecification</code>, <code>OrSpecification</code>, <code>NotSpecification</code>, which hold child specs and combine their results.</li>
</ul>
<pre>// --- Leaf specifications: one rule each ---
public final class HighValueSpec implements Specification&lt;Payment&gt; {
    private final long thresholdCents;

    public HighValueSpec(long thresholdCents) { this.thresholdCents = thresholdCents; }

    @Override
    public boolean isSatisfiedBy(Payment payment) {
        return payment.amount().minorUnits() &gt; thresholdCents;
    }
}

public final class ForeignCountrySpec implements Specification&lt;Payment&gt; {
    private final String homeCountry;

    public ForeignCountrySpec(String homeCountry) { this.homeCountry = homeCountry; }

    @Override
    public boolean isSatisfiedBy(Payment payment) {
        return !homeCountry.equals(payment.country());
    }
}

public final class TrustedMerchantSpec implements Specification&lt;Payment&gt; {
    private final Set&lt;String&gt; trustedMerchants;

    public TrustedMerchantSpec(Set&lt;String&gt; trustedMerchants) {
        this.trustedMerchants = trustedMerchants;
    }

    @Override
    public boolean isSatisfiedBy(Payment payment) {
        return trustedMerchants.contains(payment.merchantId());
    }
}</pre>
<p>An abstract base implements the combinators so every leaf gets <code>.and(...)</code> for free.</p>` },
    { title: `Implementation flow and uses`, body: `<p>You compose specs, then apply the composite:</p>
<ol>
<li>Build the rule: <code>highValue.and(trusted.not()).and(foreign)</code>.</li>
<li><b>Validation</b>: <code>if (needsReview.isSatisfiedBy(payment)) flagForReview()</code>.</li>
<li><b>Selection</b>: filter a list of transactions to those matching the spec.</li>
</ol>
<pre>// --- Compose rules fluently ---
Specification&lt;Payment&gt; needsReview = new HighValueSpec(1000_00)
    .and(new TrustedMerchantSpec(trustedSet).not())
    .and(new ForeignCountrySpec("US"));

// Validation: flag payments matching the composite rule
public void processPayment(Payment payment) {
    if (needsReview.isSatisfiedBy(payment)) {
        fraudQueue.enqueue(payment);
    } else {
        authorize(payment);
    }
}

// Selection: pull matching records from a batch
List&lt;Payment&gt; flagged = payments.stream()
    .filter(needsReview::isSatisfiedBy)
    .toList();</pre>
<p>A third use is <b>querying</b>: a specification can also expose a translation to a SQL <code>WHERE</code> clause or query object, so a <b>Repository</b> can push the same rule down to the database instead of loading every row and filtering in memory.</p>` },
    { title: `Trade-offs and neighbours`, body: `<p>Specifications make rules reusable, individually unit-testable, and combinable without editing existing code, and they read close to the domain language. The costs are a proliferation of small classes and — if you use them for querying — the effort of translating an in-memory predicate into an efficient database query (or you risk fetching everything and filtering client-side).</p>
<p>It is a pragmatic, restricted <b>Interpreter</b>: a fixed boolean grammar with a fluent API rather than a general language. It differs from <b>Strategy</b>, which encapsulates an <em>algorithm</em> rather than a boolean test, and from <b>Chain of Responsibility</b>, which routes a request through handlers rather than evaluating one composite condition.</p>` },
  ],
  figures: [
    { id: "spec-tree", svg: SPEC_SVG, caption: "Leaf rules combined with And/Not/Or into one composite specification evaluated by isSatisfiedBy()." },
  ],
  related: ["interpreter", "strategy", "repository-pattern", "chain-of-responsibility", "value-objects"],
});

export const meta = topic.meta;
export const content = topic.content;
