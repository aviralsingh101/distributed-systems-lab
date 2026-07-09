// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const CLASS_SVG = `<svg viewBox="0 0 560 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Composite class structure">
  <defs><marker id="fig-composite-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="190" y="14" width="180" height="56" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="280" y="33" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">«interface» LineComponent</text>
  <line x1="190" y1="42" x2="370" y2="42" stroke="#26324a"/>
  <text x="200" y="60" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">+ amount(): Money</text>
  <rect x="60" y="140" width="150" height="56" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="135" y="164" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">LineItem (leaf)</text>
  <text x="135" y="181" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">amount = qty × price</text>
  <rect x="350" y="140" width="170" height="56" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="435" y="160" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Bundle (composite)</text>
  <text x="435" y="177" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">children: LineComponent[]</text>
  <line x1="135" y1="140" x2="240" y2="72" stroke="#3ddc97" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-composite-arr)"/>
  <line x1="435" y1="140" x2="320" y2="72" stroke="#7c5cff" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-composite-arr)"/>
  <path d="M435,140 C450,110 430,95 385,72" fill="none" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-composite-arr)"/>
  <text x="470" y="112" fill="#93a1bd" font-size="9" font-family="system-ui">contains 0..*</text>
</svg>`;

const topic = makeTopic({
  id: "composite",
  title: "Composite",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Model part-whole trees so a client can treat a single item and a group of items through the same interface.`,
  sections: [
    { title: `Intent`, body: `<p><b>Composite</b> composes objects into tree structures to represent part-whole hierarchies, and lets clients treat an individual object and a composition of objects <b>uniformly</b> through one interface.</p>
<p>The value is that recursion disappears from the caller. An order can hold plain line items and also <em>bundles</em> — a "starter pack" that is itself a group of items, possibly containing further bundles. If the client had to ask "is this a leaf or a group?" everywhere, totalling the order would be a tangle of type checks. Composite pushes that recursion into the objects themselves.</p>
<pre>// --- Component: uniform interface for leaves and composites ---
public interface LineComponent {
    Money amount();
    String description();
}</pre>` },
    { title: `Participants and structure`, figureAfter: "composite-class", body: `<p>Three roles form the tree:</p>
<ul>
<li><b>Component</b> — the shared interface (<code>LineComponent</code> with <code>amount()</code>). Both leaves and composites implement it.</li>
<li><b>Leaf</b> — a node with no children (<code>LineItem</code>); it does the real work.</li>
<li><b>Composite</b> — a node that holds a list of children and implements the operation by <b>aggregating its children's results</b> (<code>Bundle</code> sums each child's <code>amount()</code>).</li>
</ul>
<p>Because a Composite's children are typed as Component, a bundle can contain items <em>and</em> other bundles to any depth.</p>
<pre>// --- Leaf: a single purchasable line ---
public final class LineItem implements LineComponent {
    private final String sku;
    private final int quantity;
    private final Money unitPrice;

    public LineItem(String sku, int quantity, Money unitPrice) {
        this.sku = sku;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    @Override
    public Money amount() {
        return unitPrice.multiply(quantity);
    }

    @Override
    public String description() { return sku + " × " + quantity; }
}</pre>` },
    { title: `Implementation and flow`, body: `<p><code>Bundle.amount()</code> is a recursive fold over its children; the recursion terminates naturally at the leaves:</p>
<ol>
<li>Client calls <code>order.amount()</code> on the root component without knowing the tree's shape.</li>
<li>Each <code>LineItem.amount()</code> returns <code>qty × unitPrice</code>.</li>
<li>Each <code>Bundle.amount()</code> returns the sum of <code>child.amount()</code> over its children, descending into nested bundles.</li>
</ol>
<pre>// --- Composite: aggregates many children (NOT a Decorator — many children, not one wrap) ---
public final class Bundle implements LineComponent {
    private final String name;
    private final List&lt;LineComponent&gt; children = new ArrayList&lt;&gt;();

    public Bundle(String name) { this.name = name; }

    public void add(LineComponent child) { children.add(child); }

    @Override
    public Money amount() {
        return children.stream()
            .map(LineComponent::amount)
            .reduce(Money.ZERO, Money::add);
    }

    @Override
    public String description() { return name + " (" + children.size() + " items)"; }
}

// --- Client: one call, no instanceof checks ---
Bundle starterPack = new Bundle("Starter Pack");
starterPack.add(new LineItem("CARD-READER", 1, Money.of(49_00, "USD")));
starterPack.add(new LineItem("RECEIPT-PAPER", 5, Money.of(3_00, "USD")));

Money total = starterPack.amount();  // recurses through the tree</pre>
<p>A design choice is <b>where child-management methods live</b>. The <em>transparent</em> variant declares <code>add()</code>/<code>remove()</code> on Component so everything looks alike, at the cost of leaves inheriting methods that make no sense. The <em>safe</em> variant keeps them on Composite only, so a leaf cannot be handed children — safer types, less uniform client code.</p>` },
    { title: `Trade-offs and Decorator contrast`, body: `<p>Composite makes client code simple and open to new node types, but its interface is deliberately general, so it is hard to constrain <em>which</em> components may be children — you often enforce those rules at runtime. Deep trees also invite the usual recursion hazards (stack depth, cycles).</p>
<p>It is closely related to <b>Decorator</b>: both rely on an object holding a reference of the component type. But a Composite holds <em>many</em> children and aggregates them, whereas a Decorator wraps exactly <em>one</em> component to add behaviour while preserving its interface.</p>` },
  ],
  figures: [
    { id: "composite-class", svg: CLASS_SVG, caption: "Leaf and Composite share the LineComponent interface; a Bundle aggregates its children, so amount() recurses through the tree." },
  ],
  related: ["decorator", "iterator", "visitor", "aggregate-root", "adapter"],
});

export const meta = topic.meta;
export const content = topic.content;
