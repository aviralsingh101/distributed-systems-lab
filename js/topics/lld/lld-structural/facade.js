// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const FACADE_SVG = `<svg viewBox="0 0 580 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Facade over a subsystem">
  <defs><marker id="fig-facade-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="100" width="110" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="75" y="120" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">HTTP handler</text>
  <text x="75" y="134" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">(client)</text>
  <rect x="180" y="92" width="150" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.8"/>
  <text x="255" y="116" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">CheckoutFacade</text>
  <text x="255" y="133" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">placeOrder(cart)</text>
  <line x1="130" y1="122" x2="178" y2="122" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-facade-arr)"/>
  <rect x="400" y="12" width="160" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="480" y="34" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">InventoryService</text>
  <rect x="400" y="56" width="160" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="480" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">PricingService</text>
  <rect x="400" y="100" width="160" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="480" y="122" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">PaymentGateway</text>
  <rect x="400" y="144" width="160" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="480" y="166" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">LedgerService</text>
  <rect x="400" y="188" width="160" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="480" y="210" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">NotificationService</text>
  <line x1="330" y1="118" x2="398" y2="30" stroke="#5b9dff" stroke-width="1.1" marker-end="url(#fig-facade-arr)"/>
  <line x1="330" y1="120" x2="398" y2="73" stroke="#5b9dff" stroke-width="1.1" marker-end="url(#fig-facade-arr)"/>
  <line x1="330" y1="122" x2="398" y2="117" stroke="#5b9dff" stroke-width="1.1" marker-end="url(#fig-facade-arr)"/>
  <line x1="330" y1="126" x2="398" y2="161" stroke="#5b9dff" stroke-width="1.1" marker-end="url(#fig-facade-arr)"/>
  <line x1="330" y1="130" x2="398" y2="205" stroke="#5b9dff" stroke-width="1.1" marker-end="url(#fig-facade-arr)"/>
  <text x="255" y="176" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">one call fans out to the subsystem</text>
</svg>`;

const topic = makeTopic({
  id: "facade",
  title: "Facade",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Offer one simple entry point that orchestrates a complicated subsystem, so callers do not wire its parts together themselves.`,
  sections: [
    { title: `Intent`, body: `<p><b>Facade</b> provides a single, higher-level interface to a set of interfaces in a subsystem, making that subsystem easier to use. It does not hide the subsystem — advanced callers can still reach the parts directly — it just gives the common case one convenient door.</p>
<p>Placing an order touches many services: check inventory, price the cart, debit the wallet or charge a gateway, write the ledger entry, then notify the customer. If every HTTP handler wired those five or six collaborators together, the orchestration logic (and its ordering bugs) would be copy-pasted everywhere.</p>
<pre>// --- Subsystem classes: each does real work, unaware of the facade ---
public interface InventoryService { void reserve(Cart cart); void release(Cart cart); }
public interface PricingService { Money total(Cart cart); }
public interface PaymentGateway { ChargeResult charge(ChargeRequest req); }
public interface LedgerService { void recordDebit(String walletId, Money amount, String ref); }
public interface NotificationService { void sendReceipt(Order order); }</pre>` },
    { title: `Participants and structure`, figureAfter: "facade-diagram", body: `<p>The pattern has only two roles:</p>
<ul>
<li><b>Facade</b> — <code>CheckoutFacade</code> exposes a small, task-oriented API such as <code>placeOrder(cart)</code> and knows the correct sequence and dependencies among the subsystem parts.</li>
<li><b>Subsystem classes</b> — <code>InventoryService</code>, <code>PricingService</code>, <code>PaymentGateway</code>, <code>LedgerService</code>, <code>NotificationService</code>. They do the real work and are unaware the facade exists.</li>
</ul>
<p>The dependency is one-directional: the client depends on the facade, the facade depends on the subsystem, and the subsystem depends on neither.</p>
<pre>// --- Facade: one simple entry point over many services ---
public final class CheckoutFacade {
    private final InventoryService inventory;
    private final PricingService pricing;
    private final PaymentGateway gateway;
    private final LedgerService ledger;
    private final NotificationService notifications;

    public CheckoutFacade(InventoryService inventory, PricingService pricing,
            PaymentGateway gateway, LedgerService ledger,
            NotificationService notifications) {
        this.inventory = inventory;
        this.pricing = pricing;
        this.gateway = gateway;
        this.ledger = ledger;
        this.notifications = notifications;
    }

    public Order placeOrder(Cart cart) {
        inventory.reserve(cart);
        try {
            Money total = pricing.total(cart);
            ChargeResult result = gateway.charge(new ChargeRequest(
                cart.paymentId(), cart.walletId(), total, cart.method()));
            if (result.status() != ChargeStatus.CAPTURED) {
                throw new PaymentFailedException(result.status());
            }
            ledger.recordDebit(cart.walletId(), total, result.processorRef());
            Order order = Order.from(cart, result);
            notifications.sendReceipt(order);
            return order;
        } catch (RuntimeException e) {
            inventory.release(cart);
            throw e;
        }
    }
}</pre>` },
    { title: `Implementation and flow`, body: `<p>The facade encapsulates the orchestration sequence in one place:</p>
<ol>
<li>Client calls <code>checkout.placeOrder(cart)</code>.</li>
<li>The facade reserves inventory, asks pricing for the total, and calls the payment gateway to charge.</li>
<li>On success it writes the ledger entry and fires a notification; on failure it releases the reservation and surfaces one coherent error.</li>
</ol>
<pre>// --- Client: one dependency, one call ---
@RestController
public class CheckoutController {
    private final CheckoutFacade checkout;

    public CheckoutController(CheckoutFacade checkout) { this.checkout = checkout; }

    @PostMapping("/checkout")
    public OrderResponse checkout(@RequestBody Cart cart) {
        return OrderResponse.from(checkout.placeOrder(cart));
    }
}</pre>
<p>Note the facade adds <em>no new capability</em> — it only wires existing operations and enforces their order. Keep it thin: business rules still belong in the individual services, or the facade drifts into a god object.</p>` },
    { title: `Trade-offs and confusable patterns`, body: `<p>A facade decouples clients from subsystem structure and shrinks the surface they must learn, at the risk of becoming a bloated coordinator if it keeps absorbing logic. Because it is optional, it does not restrict access — that is a feature, not a proxy.</p>
<p>Contrast the neighbours:</p>
<ul>
<li><b>Adapter</b> makes <em>one</em> existing interface conform to a <em>specific expected</em> one; a Facade invents a <em>new, simpler</em> interface over <em>many</em> classes.</li>
<li><b>Mediator</b> also centralizes interaction, but it is bidirectional and its colleagues know and talk back to it, whereas a Facade's subsystem is oblivious to it.</li>
<li><b>Proxy</b> stands in for a single object; a Facade coordinates many.</li>
</ul>` },
  ],
  figures: [
    { id: "facade-diagram", svg: FACADE_SVG, caption: "One placeOrder() call fans out to inventory, pricing, payment, ledger, and notifications; the client depends only on the facade." },
  ],
  related: ["adapter", "mediator", "layered-architecture", "hexagonal-ports-adapters", "proxy"],
});

export const meta = topic.meta;
export const content = topic.content;
