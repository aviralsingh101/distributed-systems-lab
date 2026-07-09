// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "interface-segregation-principle",
  title: "Interface Segregation",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `No client should be forced to depend on methods it does not use — prefer many small, role-specific interfaces over one fat one.`,
  sections: [
    { title: `The formal statement`, body: `<p>The <b>Interface Segregation Principle (ISP)</b>, the "I" in SOLID, states that <em>clients should not be forced to depend on interfaces they do not use</em>. When one large interface bundles unrelated operations, every implementer must provide all of them and every caller is coupled to methods it never calls.</p>
<p>ISP is SRP applied to interface boundaries: an interface should represent a single <b>role</b> that a client actually needs, not a catalog of everything a class happens to offer.</p>` },
    { title: `How it works — violation vs fix`, body: `<p>ISP works by splitting a "fat" interface into cohesive role interfaces, each defined from the perspective of a caller.</p>
<pre>// VIOLATION: online gateway forced to implement hardware it lacks
public interface PaymentDevice {
    ChargeResult charge(ChargeRequest req);
    RefundResult refund(RefundRequest req);
    void printReceipt(Receipt receipt);
    void openCashDrawer();
}

public class OnlinePaymentGateway implements PaymentDevice {
    @Override public ChargeResult charge(ChargeRequest req) { /* Stripe API */ }
    @Override public RefundResult refund(RefundRequest req) { /* Stripe API */ }
    @Override public void printReceipt(Receipt r) {
        throw new UnsupportedOperationException("no printer");  // LSP trap
    }
    @Override public void openCashDrawer() {
        throw new UnsupportedOperationException("no drawer");   // LSP trap
    }
}</pre>
<p>Segregate into role interfaces. Each implementer provides only what it actually supports:</p>
<pre>public interface Charger {
    ChargeResult charge(ChargeRequest req);
}

public interface Refunder {
    RefundResult refund(RefundRequest req);
}

public interface ReceiptPrinter {
    void printReceipt(Receipt receipt);
}

public interface CashDrawer {
    void open();
}

// Online gateway: only what it can do
public final class StripeGateway implements Charger, Refunder {
    @Override public ChargeResult charge(ChargeRequest req) { /* ... */ }
    @Override public RefundResult refund(RefundRequest req) { /* ... */ }
}

// Physical terminal: all three roles
public final class PosTerminal implements Charger, Refunder, ReceiptPrinter, CashDrawer {
    @Override public ChargeResult charge(ChargeRequest req) { /* ... */ }
    @Override public RefundResult refund(RefundRequest req) { /* ... */ }
    @Override public void printReceipt(Receipt r) { /* ... */ }
    @Override public void open() { /* ... */ }
}</pre>
<p><code>OrderService</code> depends only on <code>Charger</code>. Receipt printing changes cannot ripple into the online payment path.</p>` },
    { title: `Why fat interfaces hurt`, body: `<p>A wide interface creates coupling out of proportion to real use. Adding a method to it forces recompilation and re-testing of every implementer, even those that ignore the new method. It also invites "not supported" stubs, which lie about the contract and surprise callers at runtime. Small interfaces localize change: only the classes that play a role are affected when that role evolves.</p>
<pre>// Client depends only on the role it needs
public class OrderService {
    private final Charger charger;
    public OrderService(Charger charger) { this.charger = charger; }

    public void checkout(ChargeRequest req) {
        ChargeResult result = charger.charge(req);
        // no knowledge of printReceipt or openCashDrawer
    }
}</pre>` },
    { title: `Applying it well`, body: `<p>Design interfaces from the <em>client's</em> viewpoint — name them after the capability the caller wants (<code>Closeable</code>, <code>Serializable</code>), not after the implementing class. A single class can implement several role interfaces at once, which is exactly the point. Beware over-segmentation, though: an interface per method produces noise. The right unit is a coherent role that some client genuinely depends on as a whole.</p>` },
  ],
  related: ["single-responsibility-principle", "dependency-inversion-principle", "abstraction", "open-closed-principle"],
});

export const meta = topic.meta;
export const content = topic.content;
