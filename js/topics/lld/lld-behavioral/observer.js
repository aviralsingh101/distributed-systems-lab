// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "observer",
  title: "Observer",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Let a subject broadcast state changes to a dynamic set of listeners without knowing who they are.`,
  sections: [
    { title: `Intent`, body: `<p><b>Observer</b> defines a one-to-many dependency: when one object — the <b>subject</b> — changes state, all its registered dependents — the <b>observers</b> — are notified automatically. The subject knows only that it has a list of observers implementing a common interface, not their concrete types.</p>
<p>When a payment is captured, several things must happen: email a receipt, post to the ledger, update analytics, and score for fraud. Hard-wiring those calls into the capture method couples it to every downstream concern and forces an edit each time one is added. Observer inverts that: capture just announces "payment captured" and interested parties react.</p>
<pre>// --- Observer: the listener interface ---
public interface PaymentObserver {
    void onPaymentEvent(PaymentEvent event);
}

public record PaymentEvent(String paymentId, PaymentStatus status, Money amount) {}
public enum PaymentStatus { PENDING, CAPTURED, REFUNDED, FAILED }</pre>` },
    { title: `Participants and structure`, body: `<p>Four roles:</p>
<ul>
<li><b>Subject</b> — <code>Payment</code>, exposing <code>subscribe()</code>, <code>unsubscribe()</code>, and an internal <code>notify()</code> that walks the observer list.</li>
<li><b>Observer</b> — the interface with an <code>update(event)</code> callback.</li>
<li><b>Concrete Observers</b> — <code>ReceiptEmailer</code>, <code>LedgerPoster</code>, <code>FraudScorer</code>, <code>Analytics</code>.</li>
<li><b>Registration</b> — observers add and remove themselves at runtime, so the fan-out set is dynamic.</li>
</ul>
<pre>// --- Subject: broadcasts to registered observers ---
public class Payment {
    private final List&lt;PaymentObserver&gt; observers = new CopyOnWriteArrayList&lt;&gt;();
    private PaymentStatus status = PaymentStatus.PENDING;

    public void subscribe(PaymentObserver observer) { observers.add(observer); }
    public void unsubscribe(PaymentObserver observer) { observers.remove(observer); }

    public void capture(Money amount) {
        this.status = PaymentStatus.CAPTURED;
        notifyObservers(new PaymentEvent(id(), status, amount));
    }

    private void notifyObservers(PaymentEvent event) {
        for (PaymentObserver observer : observers) {
            observer.onPaymentEvent(event);
        }
    }
}</pre>` },
    { title: `Implementation flow, push vs pull`, body: `<p>The notification loop is the heart of the pattern:</p>
<ol>
<li>Observers subscribe: <code>payment.subscribe(new LedgerPoster(ledger))</code>.</li>
<li>A state change calls <code>notify(event)</code>, which iterates the list calling <code>observer.onPaymentEvent(event)</code>.</li>
<li>Each observer runs its own reaction independently.</li>
</ol>
<pre>// --- Concrete observers: each reacts independently ---
public final class ReceiptEmailer implements PaymentObserver {
    private final MailSender mailSender;
    public ReceiptEmailer(MailSender mailSender) { this.mailSender = mailSender; }

    @Override
    public void onPaymentEvent(PaymentEvent event) {
        if (event.status() == PaymentStatus.CAPTURED) {
            mailSender.sendReceipt(event.paymentId(), event.amount());
        }
    }
}

public final class LedgerPoster implements PaymentObserver {
    private final LedgerService ledger;
    public LedgerPoster(LedgerService ledger) { this.ledger = ledger; }

    @Override
    public void onPaymentEvent(PaymentEvent event) {
        if (event.status() == PaymentStatus.CAPTURED) {
            ledger.recordCredit(event.paymentId(), event.amount());
        }
    }
}</pre>
<p>Two delivery styles: <b>push</b> sends the changed data inside the event (simple, but the subject guesses what observers need); <b>pull</b> sends only a notification and lets each observer query the subject for what it wants (flexible, but chattier).</p>` },
    { title: `Observer vs Mediator, and hazards`, body: `<p><b>Observer</b> is one-to-many and one-directional: the subject broadcasts, observers listen, and observers are decoupled from each other. <b>Mediator</b> is many-to-many and bidirectional: colleagues route their interactions <em>through</em> a hub that coordinates them.</p>
<pre>// Observer: subject broadcasts — observers do NOT talk to each other
payment.subscribe(new LedgerPoster(ledger));
payment.subscribe(new ReceiptEmailer(mail));
payment.capture(amount);  // both react independently

// Mediator: colleagues report TO the hub, hub decides who acts NEXT
mediator.notify(inventory, "reserved");
// mediator tells payment to charge, then tells shipping to allocate</pre>
<p>Reach for Observer to broadcast events, for Mediator to untangle a web of mutual dependencies. In-process Observer is the synchronous foundation of pub/sub; a message broker adds asynchrony, durability, and cross-process delivery on top. Watch the classic hazards: notification order is undefined, a slow or throwing observer can stall or break the subject (wrap callbacks defensively), cascading updates can loop, and forgetting to unsubscribe leaks memory — the "lapsed listener" problem.</p>` },
  ],
  related: ["mediator", "in-memory-pub-sub", "command", "domain-vs-integration-events", "chain-of-responsibility"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("observer", stage, panel, stageEl);
}
