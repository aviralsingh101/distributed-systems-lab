// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "state",
  title: "State",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Give each state of an object its own class so behaviour changes with the state — and illegal transitions become impossible by construction.`,
  sections: [
    { title: `Intent`, body: `<p><b>State</b> lets an object alter its behaviour when its internal state changes; the object appears to change its class. Instead of a status field inspected by <code>switch</code> statements scattered across every method, each state is a class that knows how to handle operations while in that state — and which state comes next.</p>
<p>A payment is the canonical example: it moves through <em>Pending → Authorized → Captured → Refunded</em>, with a <em>Failed</em> branch. What <code>capture()</code> or <code>refund()</code> means depends entirely on where the payment currently is.</p>
<pre>// --- State interface: operations that vary by lifecycle phase ---
public interface PaymentState {
    void authorize(PaymentContext payment);
    void capture(PaymentContext payment);
    void refund(PaymentContext payment);
    void cancel(PaymentContext payment);
}</pre>` },
    { title: `Participants and structure`, body: `<p>Three roles:</p>
<ul>
<li><b>Context</b> — the <code>Payment</code> object. It holds a reference to a current State and forwards operations to it.</li>
<li><b>State</b> — an interface declaring the operations that vary by state: <code>authorize()</code>, <code>capture()</code>, <code>refund()</code>, <code>cancel()</code>.</li>
<li><b>Concrete States</b> — <code>PendingState</code>, <code>AuthorizedState</code>, <code>CapturedState</code>, <code>RefundedState</code>, <code>FailedState</code>. Each implements the operations that are legal for it and rejects the rest.</li>
</ul>
<pre>// --- Context: forwards every operation to the current state ---
public class PaymentContext {
    private PaymentState state = new PendingState();

    public void setState(PaymentState state) { this.state = state; }

    public void authorize() { state.authorize(this); }
    public void capture()   { state.capture(this); }
    public void refund()    { state.refund(this); }
    public void cancel()    { state.cancel(this); }
}</pre>
<p>Crucially, a concrete state decides the transition: after a successful capture, <code>AuthorizedState</code> tells the context to become <code>CapturedState</code>.</p>` },
    { title: `Implementation flow`, body: `<p>Operations are delegated, and transitions happen inside the states:</p>
<ol>
<li>Caller invokes <code>payment.capture()</code>; the context forwards to <code>currentState.capture(context)</code>.</li>
<li><code>AuthorizedState.capture()</code> performs the capture and calls <code>context.setState(new CapturedState())</code>.</li>
<li>Calling <code>capture()</code> again now runs <code>CapturedState.capture()</code>, which throws an <code>IllegalTransition</code> — a double capture is impossible because no code path allows it.</li>
</ol>
<pre>public final class PendingState implements PaymentState {
    @Override
    public void authorize(PaymentContext payment) {
        payment.setState(new AuthorizedState());
    }
    @Override
    public void capture(PaymentContext payment) {
        throw new IllegalStateException("Cannot capture before authorize");
    }
    // refund, cancel similarly guarded…
}

public final class AuthorizedState implements PaymentState {
    @Override
    public void capture(PaymentContext payment) {
        // call gateway, record result…
        payment.setState(new CapturedState());  // PENDING → CAPTURED
    }
}

public final class CapturedState implements PaymentState {
    @Override
    public void refund(PaymentContext payment) {
        // issue refund via gateway…
        payment.setState(new RefundedState());  // CAPTURED → REFUNDED
    }
    @Override
    public void capture(PaymentContext payment) {
        throw new IllegalStateException("Already captured");
    }
}</pre>
<p>The set of legal transitions is encoded in which methods each state implements, so the state machine is explicit rather than implied by scattered <code>if (status === ...)</code> checks.</p>` },
    { title: `State vs Strategy, and trade-offs`, body: `<p>State and <b>Strategy</b> have the same shape — a context delegating to a pluggable object — but differ in who drives change:</p>
<ul>
<li><b>Strategy</b>: the <em>client</em> injects an algorithm; strategies ignore each other. "How should I route this payment?"</li>
<li><b>State</b>: the object <em>transitions itself</em> between states in response to events; states reference one another. "What can I do now that I am CAPTURED?"</li>
</ul>
<pre>// Strategy: external injection, no self-transition
router.setStrategy(new CheapestRouting());

// State: internal transition driven by events
payment.capture();  // AuthorizedState → CapturedState automatically</pre>
<p>The pattern eliminates brittle status switches and makes invalid operations fail loudly, at the cost of one class per state and transition logic spread across them. If transitions are complex, document the diagram (the interactive lab makes the legal moves visible) and consider centralizing the transition table in the context.</p>` },
  ],
  related: ["strategy", "command", "memento", "template-method", "two-pc"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("state", stage, panel, stageEl);
}
