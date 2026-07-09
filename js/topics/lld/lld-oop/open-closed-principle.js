// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const OCP_SVG = `<svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Open/Closed: add a strategy without editing existing code">
  <defs><marker id="fig-open-closed-principle-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="20" y="80" width="150" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="95" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">FeeCalculator</text>
  <text x="95" y="117" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">closed for edit</text>
  <rect x="210" y="80" width="150" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="285" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">&lt;&lt;FeeRule&gt;&gt;</text>
  <text x="285" y="117" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">rate(order)</text>
  <rect x="390" y="20" width="95" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="437" y="43" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">FlatFee</text>
  <rect x="390" y="82" width="95" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="437" y="105" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">TieredFee</text>
  <rect x="390" y="144" width="95" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="437" y="167" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">+ new rule</text>
  <line x1="170" y1="103" x2="208" y2="103" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-open-closed-principle-arr)"/>
  <line x1="360" y1="98" x2="388" y2="42" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3"/>
  <line x1="360" y1="103" x2="388" y2="101" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3"/>
  <line x1="360" y1="108" x2="388" y2="160" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3"/>
</svg>`;

const topic = makeTopic({
  id: "open-closed-principle",
  title: "Open/Closed Principle",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Software entities should be open for extension but closed for modification — add new behavior by adding code, not by editing tested code.`,
  sections: [
    { title: `The formal statement`, body: `<p>The <b>Open/Closed Principle (OCP)</b>, coined by Bertrand Meyer, states that a module should be <em>open for extension but closed for modification</em>. You should be able to add new behavior by adding new code, without editing the existing, already-tested source of the module.</p>
<p>The motivation is risk. Every edit to working code can introduce a regression and forces re-testing and re-deployment. If new requirements can be satisfied by <em>adding</em> a class rather than <em>changing</em> one, the stable core stays untouched and the change surface shrinks.</p>` },
    { title: `How it works — violation vs fix`, figureAfter: "fee-rules", body: `<p>OCP works through <b>abstraction and polymorphism</b>. You identify the axis of expected variation, express it as an interface, and let the stable module depend on that interface. New variants are new implementations; the module that consumes them never changes.</p>
<pre>// VIOLATION: must edit this class for every new payment method
public class FeeCalculator {
    public int calculateFee(Order order) {
        return switch (order.paymentMethod()) {
            case CARD -> (int) (order.totalCents() * 0.029);
            case ACH  -> 50;  // flat 50 cents
            case WALLET -> 0;
            // adding CRYPTO means editing THIS method — OCP broken
        };
    }
}</pre>
<p>Refactor to a <code>FeeRule</code> interface. The calculator stays closed; new rules extend the system:</p>
<pre>public interface FeeRule {
    boolean appliesTo(PaymentMethod method);
    int rate(Order order);
}

public final class FlatFeeRule implements FeeRule {
    private final PaymentMethod method;
    private final int flatCents;
    public FlatFeeRule(PaymentMethod method, int flatCents) {
        this.method = method; this.flatCents = flatCents;
    }
    @Override public boolean appliesTo(PaymentMethod m) { return m == method; }
    @Override public int rate(Order order) { return flatCents; }
}

public final class PercentageFeeRule implements FeeRule {
    private final PaymentMethod method;
    private final double rate;
    public PercentageFeeRule(PaymentMethod method, double rate) {
        this.method = method; this.rate = rate;
    }
    @Override public boolean appliesTo(PaymentMethod m) { return m == method; }
    @Override public int rate(Order order) { return (int) (order.totalCents() * rate); }
}

// CLOSED: never edited when a new fee type arrives
public class FeeCalculator {
    private final List&lt;FeeRule&gt; rules;
    public FeeCalculator(List&lt;FeeRule&gt; rules) { this.rules = rules; }

    public int calculateFee(Order order) {
        return rules.stream()
            .filter(r -&gt; r.appliesTo(order.paymentMethod()))
            .findFirst()
            .orElseThrow()
            .rate(order);
    }
}</pre>
<p>Adding a crypto promotion fee means writing <code>PromoFeeRule implements FeeRule</code> and registering it — <code>FeeCalculator</code> stays closed.</p>` },
    { title: `Predicting the right axis`, body: `<p>OCP protects against the variation you anticipate — you cannot make code closed against <em>every</em> possible change. The skill is choosing which axis is likely to vary (payment methods, tax jurisdictions, notification channels) and abstracting exactly that. Guess wrong and you pay for indirection that never earns its keep; the Strategy and Factory patterns are the usual tools once you know the axis.</p>` },
    { title: `Costs and balance`, body: `<p>OCP trades edit-safety for indirection. Each abstraction adds a type and a layer of dispatch, which can obscure simple logic. Apply it where change is frequent and expensive to get wrong, not everywhere by default — this is where OCP tensions with YAGNI. A pragmatic rule: write the concrete version first; introduce the abstraction on the second variant, when the axis of change has proven itself real.</p>` },
  ],
  figures: [
    { id: "fee-rules", svg: OCP_SVG, caption: `FeeCalculator depends on the FeeRule abstraction. New fee types are added as new implementations without editing the calculator.` },
  ],
  related: ["single-responsibility-principle", "liskov-substitution-principle", "polymorphism", "kiss-yagni-principles"],
});

export const meta = topic.meta;
export const content = topic.content;
