// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const AST_SVG = `<svg viewBox="0 0 560 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interpreter AST">
  <defs><marker id="fig-interpreter-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="220" y="14" width="120" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="280" y="34" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">And</text>
  <text x="280" y="47" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">(nonterminal)</text>
  <rect x="70" y="100" width="150" height="42" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="145" y="120" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">GreaterThan</text>
  <text x="145" y="134" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">amount &gt; 1000</text>
  <rect x="340" y="100" width="150" height="42" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/>
  <text x="415" y="120" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Equals</text>
  <text x="415" y="134" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">country == "US"</text>
  <rect x="70" y="164" width="150" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="145" y="184" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">Var(amount) / Const(1000)</text>
  <rect x="340" y="164" width="150" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="415" y="184" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">Var(country) / Const(US)</text>
  <line x1="255" y1="54" x2="160" y2="98" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-interpreter-arr)"/>
  <line x1="305" y1="54" x2="400" y2="98" stroke="#5b9dff" stroke-width="1.3" marker-end="url(#fig-interpreter-arr)"/>
  <line x1="145" y1="142" x2="145" y2="162" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-interpreter-arr)"/>
  <line x1="415" y1="142" x2="415" y2="162" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-interpreter-arr)"/>
  <text x="280" y="80" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">interpret(context) recurses down the tree</text>
</svg>`;

const topic = makeTopic({
  id: "interpreter",
  title: "Interpreter",
  category: "lld-behavioral",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Model a small language's grammar as a class per rule, then evaluate sentences by walking the resulting tree of expression objects.`,
  sections: [
    { title: `Intent`, body: `<p><b>Interpreter</b> defines a representation for a simple language's grammar, plus an interpreter that evaluates sentences written in it. Each grammar rule becomes a class, and a sentence becomes a tree of those objects (an abstract syntax tree) that you evaluate by recursion.</p>
<p>It shines for small, embedded rule languages. A promotions engine might let ops define eligibility as <code>amount &gt; 1000 AND country == "US"</code>. Rather than hard-coding that in Java, you represent each operator as an expression object and evaluate the tree against each payment.</p>
<pre>// --- Abstract expression: every rule implements interpret ---
public interface PaymentExpression {
    boolean interpret(PaymentContext context);
}

public record PaymentContext(Money amount, String country, String merchantId) {}</pre>` },
    { title: `Participants and structure`, figureAfter: "interpreter-ast", body: `<p>Interpreter is <b>Composite applied to a grammar</b>:</p>
<ul>
<li><b>Abstract Expression</b> — declares <code>interpret(context)</code>.</li>
<li><b>Terminal Expression</b> — leaves that need no sub-parts: <code>Variable("amount")</code>, <code>Constant(1000)</code>.</li>
<li><b>Nonterminal Expression</b> — composite rules holding sub-expressions: <code>And</code>, <code>GreaterThan</code>, <code>Equals</code>, whose <code>interpret</code> combines the results of their children.</li>
<li><b>Context</b> — the input the sentence is evaluated against (the payment's fields).</li>
</ul>
<pre>// --- Terminal expressions ---
public final class AmountVariable implements PaymentExpression {
    @Override
    public boolean interpret(PaymentContext ctx) {
        throw new UnsupportedOperationException("Variable is not boolean");
    }
    public Money value(PaymentContext ctx) { return ctx.amount(); }
}

public final class CountryVariable implements PaymentExpression {
    public String value(PaymentContext ctx) { return ctx.country(); }
    @Override public boolean interpret(PaymentContext ctx) {
        throw new UnsupportedOperationException("Variable is not boolean");
    }
}

// --- Nonterminal: GreaterThan(amount, 1000) ---
public final class GreaterThan implements PaymentExpression {
    private final AmountVariable left;
    private final long thresholdCents;

    public GreaterThan(long thresholdCents) {
        this.left = new AmountVariable();
        this.thresholdCents = thresholdCents;
    }

    @Override
    public boolean interpret(PaymentContext ctx) {
        return left.value(ctx).minorUnits() &gt; thresholdCents;
    }
}</pre>
<p>The tree structure mirrors the grammar, so evaluating a rule is a depth-first walk that bottoms out at the terminals.</p>` },
    { title: `Implementation flow`, body: `<p>You build the AST, then interpret it against each context:</p>
<ol>
<li>Construct the tree: <code>new And(new GreaterThan(1000_00), new Equals("US"))</code>.</li>
<li>Evaluate: <code>rule.interpret(new PaymentContext(Money.of(1500_00, "USD"), "US", "m-1"))</code>.</li>
<li><code>And.interpret</code> recurses into both children; <code>GreaterThan</code> reads <code>amount</code> from the context and compares; the booleans bubble back up.</li>
</ol>
<pre>public final class Equals implements PaymentExpression {
    private final String expectedCountry;
    public Equals(String expectedCountry) { this.expectedCountry = expectedCountry; }

    @Override
    public boolean interpret(PaymentContext ctx) {
        return expectedCountry.equals(ctx.country());
    }
}

public final class And implements PaymentExpression {
    private final PaymentExpression left;
    private final PaymentExpression right;

    public And(PaymentExpression left, PaymentExpression right) {
        this.left = left;
        this.right = right;
    }

    @Override
    public boolean interpret(PaymentContext ctx) {
        return left.interpret(ctx) &amp;&amp; right.interpret(ctx);
    }
}

// Build and evaluate: amount &gt; 1000 AND country == "US"
PaymentExpression promoRule = new And(
    new GreaterThan(1000_00),
    new Equals("US")
);
boolean eligible = promoRule.interpret(
    new PaymentContext(Money.of(1500_00, "USD"), "US", "m-42"));</pre>
<p>Note the pattern covers <em>representation and evaluation</em>, not parsing — turning the raw string into the tree is a separate concern (a hand-written parser or a config format).</p>` },
    { title: `Trade-offs and boundaries`, body: `<p>Adding a new operator is easy — one more expression class — which makes the grammar pleasantly extensible. But the pattern does not scale: every rule is a class, so a rich grammar explodes into dozens of them, and tree-walking evaluation is slow. Use it only for <b>small, stable</b> DSLs (rule engines, query filters, feature flags); for a real programming language, use a proper parser producing an AST that a <b>Visitor</b> walks.</p>
<p>The <b>Specification</b> pattern is a focused, practical cousin: it is essentially an Interpreter restricted to composable boolean business rules (<code>and</code>, <code>or</code>, <code>not</code>) with a friendlier fluent API.</p>` },
  ],
  figures: [
    { id: "interpreter-ast", svg: AST_SVG, caption: "The rule amount > 1000 AND country == \"US\" as a tree of expression objects, each implementing interpret(context)." },
  ],
  related: ["specification-pattern", "composite", "visitor", "iterator"],
});

export const meta = topic.meta;
export const content = topic.content;
