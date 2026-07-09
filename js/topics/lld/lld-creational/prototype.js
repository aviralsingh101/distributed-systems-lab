// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const PROTO_SVG = `<svg viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Prototype clone flow">
  <defs><marker id="fig-prototype-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="60" width="150" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="2"/>
  <text x="105" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">prototype</text>
  <text x="105" y="102" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">configured Invoice</text>
  <rect x="320" y="18" width="150" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="395" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">clone A</text>
  <text x="395" y="58" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">tweak lineItems</text>
  <rect x="320" y="106" width="150" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="395" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">clone B</text>
  <text x="395" y="146" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">tweak customer</text>
  <line x1="180" y1="80" x2="318" y2="44" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-prototype-arr)"/>
  <line x1="180" y1="100" x2="318" y2="132" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-prototype-arr)"/>
  <text x="250" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">clone() copies state; no re-running expensive setup</text>
</svg>`;

const topic = makeTopic({
  id: "prototype",
  title: "Prototype",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Create new objects by copying a fully-configured existing instance (the prototype) rather than constructing them from scratch.`,
  sections: [
    { title: `The problem it solves`, body: `<p><b>Prototype</b> is a GoF creational pattern used when constructing an object is expensive or when its exact class and configuration are only known at runtime. Instead of calling a constructor and re-running costly setup, you keep a ready-made instance and <b>clone</b> it, then adjust the copy.</p>
<p>It is the right tool when many objects share most of their state, when creation involves heavy work (parsing a template, loading defaults, an expensive computation), or when a system must copy objects without depending on their concrete classes.</p>` },
    { title: `Structure`, figureAfter: "proto-uml", body: `<p>The roles are minimal. A <b>Prototype</b> interface declares a <code>clone()</code> method. <b>Concrete Prototypes</b> implement <code>clone()</code> to return a copy of themselves. A prototype <em>registry</em> mapping keys to instances is a common companion.</p>
<pre>public interface Prototype&lt;T&gt; {
    T clone();
}

public final class InvoiceTemplate implements Prototype&lt;InvoiceTemplate&gt; {
    private final String companyName;
    private final String taxId;
    private final List&lt;LineItem&gt; defaultLineItems;
    private final String footerText;

    public InvoiceTemplate(String companyName, String taxId,
                           List&lt;LineItem&gt; defaultLineItems, String footerText) {
        this.companyName = companyName;
        this.taxId = taxId;
        this.defaultLineItems = new ArrayList&lt;&gt;(defaultLineItems);
        this.footerText = footerText;
    }

    @Override
    public InvoiceTemplate clone() {
        // Deep copy — new list, new LineItem objects
        List&lt;LineItem&gt; copiedItems = defaultLineItems.stream()
            .map(LineItem::copy)
            .collect(Collectors.toList());
        return new InvoiceTemplate(companyName, taxId, copiedItems, footerText);
    }

    public InvoiceTemplate withCustomer(String customerId, List&lt;LineItem&gt; items) {
        InvoiceTemplate copy = clone();
        copy.defaultLineItems.clear();
        copy.defaultLineItems.addAll(items);
        return copy;
    }
}</pre>
<p>A registry lets clients clone by key without knowing the concrete type:</p>
<pre>public class InvoiceTemplateRegistry {
    private final Map&lt;String, InvoiceTemplate&gt; templates = new HashMap&lt;&gt;();

    public void register(String key, InvoiceTemplate template) {
        templates.put(key, template);
    }

    public InvoiceTemplate createFrom(String key) {
        InvoiceTemplate prototype = templates.get(key);
        if (prototype == null) throw new IllegalArgumentException("unknown template: " + key);
        return prototype.clone();
    }
}</pre>` },
    { title: `Flow and the deep-copy trap`, body: `<p>The flow: (1) build and configure a prototype once — e.g. load company header, tax ID, default line items from config. (2) to make a new invoice, call <code>clone()</code>. (3) mutate only the fields that differ (customer, line items). The subtle part is implementing <code>clone()</code> correctly.</p>
<pre>// SHALLOW COPY trap — mutating clone corrupts prototype
public InvoiceTemplate shallowClone() {
    return new InvoiceTemplate(companyName, taxId, defaultLineItems, footerText);
    // defaultLineItems is SHARED — adding to clone affects prototype!
}

// Usage that breaks
InvoiceTemplate proto = registry.createFrom("standard");
proto.defaultLineItems().add(new LineItem("extra", 500));
// Oops: the registered "standard" template now has the extra item too

// DEEP COPY — safe
InvoiceTemplate safe = proto.clone();  // new ArrayList, new LineItem objects
safe.defaultLineItems().add(new LineItem("extra", 500));  // prototype untouched</pre>
<p>Handle nested structures and cyclic references carefully. For simple value objects, a copy constructor or Java's <code>record</code> with immutable collections avoids the trap entirely.</p>` },
    { title: `Trade-offs and relationships`, body: `<p><b>Benefits:</b> skips expensive initialization, lets you add and remove product variants at runtime by registering prototypes, and decouples the client from concrete classes. <b>Costs:</b> correct deep cloning is error-prone; every prototype must maintain its own <code>clone()</code>, and shared mutable state or circular references make it tricky.</p>
<p>Compared to <b>Factory Method</b> / <b>Abstract Factory</b>, which construct via subclassing/interfaces, Prototype constructs by copying an instance — useful when the desired configuration is easier to demonstrate than to specify in code.</p>` },
  ],
  figures: [
    { id: "proto-uml", svg: PROTO_SVG, caption: `A configured prototype is cloned into independent copies; each clone is tweaked without rebuilding from scratch.` },
  ],
  related: ["factory-method", "abstract-factory", "builder", "object-pool"],
});

export const meta = topic.meta;
export const content = topic.content;
