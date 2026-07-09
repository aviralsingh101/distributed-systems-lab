// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const HUB_SVG = `<svg viewBox="0 0 580 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mediator hub vs mesh">
  <defs><marker id="fig-mediator-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="130" y="18" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">without: n×n mesh</text>
  <circle cx="60" cy="60" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <circle cx="200" cy="60" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <circle cx="60" cy="160" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <circle cx="200" cy="160" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <line x1="78" y1="60" x2="182" y2="60" stroke="#ff6b6b" stroke-width="1"/>
  <line x1="60" y1="78" x2="60" y2="142" stroke="#ff6b6b" stroke-width="1"/>
  <line x1="200" y1="78" x2="200" y2="142" stroke="#ff6b6b" stroke-width="1"/>
  <line x1="78" y1="72" x2="182" y2="148" stroke="#ff6b6b" stroke-width="1"/>
  <line x1="78" y1="148" x2="182" y2="72" stroke="#ff6b6b" stroke-width="1"/>
  <line x1="78" y1="160" x2="182" y2="160" stroke="#ff6b6b" stroke-width="1"/>
  <text x="440" y="18" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">with: hub (n links)</text>
  <rect x="405" y="92" width="70" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="440" y="114" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Mediator</text>
  <circle cx="360" cy="55" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <circle cx="520" cy="55" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <circle cx="360" cy="165" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <circle cx="520" cy="165" r="18" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.2"/>
  <line x1="375" y1="66" x2="408" y2="96" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-mediator-arr)"/>
  <line x1="505" y1="66" x2="472" y2="96" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-mediator-arr)"/>
  <line x1="375" y1="154" x2="408" y2="124" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-mediator-arr)"/>
  <line x1="505" y1="154" x2="472" y2="124" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-mediator-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "mediator",
  title: "Mediator",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Route all interaction between a set of objects through one coordinator, turning an n×n mesh of references into a hub.`,
  sections: [
    { title: `Intent`, body: `<p><b>Mediator</b> defines an object that encapsulates how a set of objects interact. Colleagues stop referring to each other directly and instead talk to the mediator, which promotes loose coupling and lets you change the interaction logic in one place.</p>
<p>Without it, a set of collaborating components tends toward a tangled mesh: every component holds references to every other, so a change to one ripples everywhere and the interaction rules are smeared across all of them.</p>
<pre>// --- Colleague interface: reports events TO the mediator ---
public interface OrderColleague {
    void setMediator(OrderMediator mediator);
    void notifyMediator(String event);
}</pre>` },
    { title: `Participants and structure`, figureAfter: "mediator-hub", body: `<p>The pattern collapses that mesh into a hub:</p>
<ul>
<li><b>Mediator</b> — an interface for the coordination the colleagues need.</li>
<li><b>Concrete Mediator</b> — knows all colleagues and holds the interaction logic: when colleague A reports an event, it decides which colleagues act next.</li>
<li><b>Colleagues</b> — each holds a reference only to the mediator and notifies it of events, never calling siblings directly.</li>
</ul>
<pre>// --- Concrete mediator: holds coordination logic ---
public final class OrderOrchestrationMediator implements OrderMediator {
    private InventoryColleague inventory;
    private PaymentColleague payment;
    private ShippingColleague shipping;

    public void register(InventoryColleague i, PaymentColleague p, ShippingColleague s) {
        this.inventory = i;
        this.payment = p;
        this.shipping = s;
        i.setMediator(this);
        p.setMediator(this);
        s.setMediator(this);
    }

    @Override
    public void onEvent(OrderColleague sender, String event) {
        switch (event) {
            case "inventory_reserved" -> payment.charge();
            case "payment_authorized"   -> shipping.allocateLabel();
            case "payment_failed"       -> inventory.release();
            default -> throw new IllegalArgumentException("Unknown event: " + event);
        }
    }
}</pre>
<p>An order-orchestration mediator coordinates Inventory, Payment, and Shipping: each reports its outcome to the orchestrator, which drives the next step. A saga <b>orchestrator</b> is essentially a distributed mediator.</p>` },
    { title: `Implementation flow`, body: `<p>Communication is always colleague → mediator → colleague:</p>
<ol>
<li>A colleague raises an event: <code>mediator.onEvent(this, "paymentAuthorized")</code>.</li>
<li>The concrete mediator's coordination logic decides the reaction — here, tell Shipping to allocate a label.</li>
<li>It calls the relevant colleague(s); the colleagues remain unaware of one another.</li>
</ol>
<pre>// --- Colleague: never calls siblings directly ---
public final class PaymentColleague implements OrderColleague {
    private OrderMediator mediator;
    private final PaymentGateway gateway;

    public PaymentColleague(PaymentGateway gateway) { this.gateway = gateway; }

    @Override
    public void setMediator(OrderMediator mediator) { this.mediator = mediator; }

    public void charge() {
        ChargeResult result = gateway.charge(/* … */);
        if (result.status() == ChargeStatus.CAPTURED) {
            notifyMediator("payment_authorized");
        } else {
            notifyMediator("payment_failed");
        }
    }

    @Override
    public void notifyMediator(String event) {
        mediator.onEvent(this, event);
    }
}</pre>
<p>Adding or reordering an interaction step means editing the mediator, not the colleagues — the whole point is that the collaboration rules live in one auditable place.</p>` },
    { title: `Mediator vs Observer vs Facade`, body: `<p>These three centralize things but are not interchangeable:</p>
<ul>
<li><b>Observer</b> — one-to-many broadcast: a subject emits, observers react independently, no central decision-making. Observers do not talk to each other.</li>
<li><b>Mediator</b> — many-to-many with logic: colleagues send it events <em>and</em> it decides who does what next — bidirectional, explicit routing rules.</li>
<li><b>Facade</b> — one-directional and dumb: simplifies access to a subsystem that is unaware of it, adding no coordination.</li>
</ul>
<pre>// Observer: payment broadcasts — ledger and email react independently
payment.subscribe(ledgerPoster);
payment.subscribe(receiptEmailer);
payment.capture(amount);

// Mediator: inventory reports TO hub, hub tells payment to charge NEXT
inventory.notifyMediator("inventory_reserved");
// mediator.onEvent → payment.charge() → shipping.allocateLabel()</pre>
<p>The trade-off is real: a mediator concentrates coupling into a single well-understood object, but if it keeps absorbing behaviour it becomes a god object. Keep its job to <em>coordination</em>, and leave the actual work in the colleagues.</p>` },
  ],
  figures: [
    { id: "mediator-hub", svg: HUB_SVG, caption: "Direct references grow as n×n; routing interaction through a mediator reduces coupling to n links and one place to hold the rules." },
  ],
  related: ["observer", "facade", "saga-choreography", "command", "in-memory-pub-sub"],
});

export const meta = topic.meta;
export const content = topic.content;
