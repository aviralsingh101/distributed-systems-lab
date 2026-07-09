// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const BUILDER_SVG = `<svg viewBox="0 0 520 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Builder pattern fluent assembly">
  <defs><marker id="fig-builder-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="150" height="52" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="95" y="92" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">ChargeBuilder</text>
  <text x="95" y="110" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">amount() .currency()</text>
  <rect x="210" y="30" width="130" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="275" y="52" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">.idempotencyKey()</text>
  <rect x="210" y="80" width="130" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="275" y="102" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="ui-monospace,monospace">.metadata()</text>
  <rect x="210" y="130" width="130" height="34" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.2"/>
  <text x="275" y="152" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="ui-monospace,monospace">optional steps</text>
  <rect x="380" y="72" width="120" height="48" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="2"/>
  <text x="440" y="93" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Charge</text>
  <text x="440" y="110" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">build() → immutable</text>
  <line x1="170" y1="96" x2="378" y2="96" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-builder-arr)"/>
  <text x="300" y="180" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">chained calls set parts; build() validates and returns the product</text>
</svg>`;

const topic = makeTopic({
  id: "builder",
  title: "Builder",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Separate the construction of a complex object from its representation, assembling it step by step and producing a validated, often immutable, result.`,
  sections: [
    { title: `The problem it solves`, body: `<p><b>Builder</b> is a GoF creational pattern for objects with many parameters — several required, several optional. The alternatives are ugly: a <b>telescoping constructor</b> with null placeholders is unreadable and error-prone when arguments share a type, while a no-arg object with setters can be left in a half-built, invalid state.</p>
<p>Builder collects the parts through named steps and constructs the final object in one atomic <code>build()</code>, which validates invariants and can return an immutable instance.</p>` },
    { title: `Structure`, figureAfter: "builder-uml", body: `<p>The roles: the <b>Product</b> is the complex object being created (<code>ChargeRequest</code>), ideally immutable. The <b>Builder</b> holds mutable working state and exposes one step method per part, each returning <code>this</code> for fluent chaining. A terminal <code>build()</code> validates and returns the Product.</p>
<pre>// Immutable product — no setters, only built via builder
public final class ChargeRequest {
    private final String paymentId;
    private final String walletId;
    private final int amountCents;
    private final String currency;
    private final Map&lt;String, String&gt; metadata;

    private ChargeRequest(Builder builder) {
        this.paymentId = builder.paymentId;
        this.walletId = builder.walletId;
        this.amountCents = builder.amountCents;
        this.currency = builder.currency;
        this.metadata = Map.copyOf(builder.metadata);
    }

    public String paymentId() { return paymentId; }
    public String walletId() { return walletId; }
    public int amountCents() { return amountCents; }
    public String currency() { return currency; }
    public Map&lt;String, String&gt; metadata() { return metadata; }

    public static Builder builder() { return new Builder(); }
}</pre>
<p>The builder accumulates parts and validates at build time:</p>
<pre>public static class Builder {
    private String paymentId;
    private String walletId;
    private int amountCents;
    private String currency;
    private final Map&lt;String, String&gt; metadata = new HashMap&lt;&gt;();

    public Builder paymentId(String id) { this.paymentId = id; return this; }
    public Builder walletId(String id)  { this.walletId = id; return this; }
    public Builder amountCents(int c)   { this.amountCents = c; return this; }
    public Builder currency(String c)   { this.currency = c; return this; }
    public Builder metadata(String k, String v) { metadata.put(k, v); return this; }

    public ChargeRequest build() {
        if (paymentId == null || paymentId.isBlank())
            throw new IllegalStateException("paymentId is required");
        if (walletId == null)
            throw new IllegalStateException("walletId is required");
        if (amountCents &lt;= 0)
            throw new IllegalStateException("amount must be positive");
        if (currency == null)
            throw new IllegalStateException("currency is required");
        return new ChargeRequest(this);
    }
}</pre>` },
    { title: `Flow`, body: `<p>The construction flow: (1) create a builder. (2) call the step methods for the parts you need, in any order, skipping optional ones. (3) call <code>build()</code>, which runs validation and returns the Product. Because the object only exists after <code>build()</code> succeeds, callers can never observe a partially initialized charge.</p>
<pre>// Fluent call site — readable, self-documenting
ChargeRequest charge = ChargeRequest.builder()
    .paymentId("pay_abc123")
    .walletId("wal_user42")
    .amountCents(1999)
    .currency("USD")
    .metadata("order_id", "ord_789")
    .build();

// Gateway receives a fully validated, immutable request
ChargeResult result = gateway.charge(charge);</pre>
<p>Optional fields are simply omitted — no null placeholders, no ambiguity about which int is which.</p>` },
    { title: `Trade-offs and related patterns`, body: `<p><b>Benefits:</b> readable call sites with named parts, no invalid intermediate states, centralized validation, and support for immutable products. It shines when a type has many optional fields or multiple valid configurations. <b>Costs:</b> a builder is extra boilerplate that is unjustified for objects with two or three fields, where a plain constructor is simpler (KISS).</p>
<p>Builder assembles <em>one</em> complex product step by step; <b>Factory Method</b> and <b>Abstract Factory</b> instead choose <em>which</em> product/family to instantiate in a single call.</p>` },
  ],
  figures: [
    { id: "builder-uml", svg: BUILDER_SVG, caption: `Fluent step methods accumulate parts on the builder; build() validates and returns an immutable Charge.` },
  ],
  related: ["factory-method", "abstract-factory", "prototype", "kiss-yagni-principles"],
});

export const meta = topic.meta;
export const content = topic.content;
