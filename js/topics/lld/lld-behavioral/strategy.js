// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "strategy",
  title: "Strategy",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Encapsulate each member of a family of interchangeable algorithms behind one interface so the caller can swap them without changing its code.`,
  sections: [
    { title: `Intent`, body: `<p><b>Strategy</b> defines a family of algorithms, encapsulates each one behind a common interface, and makes them interchangeable. The algorithm can then vary independently of the client that uses it.</p>
<p>The smell it removes is a growing conditional that selects behaviour. A payment router that picks a gateway with <code>if (mode === "cheapest") … else if (mode === "fastest") …</code> becomes harder to test and extend with every new rule. Strategy replaces that branch with an object you plug in.</p>
<pre>// --- Strategy: interchangeable routing algorithms ---
public interface RoutingStrategy {
    PaymentGateway pick(List&lt;PaymentGateway&gt; gateways, Payment payment);
}</pre>` },
    { title: `Participants and structure`, body: `<p>Three roles:</p>
<ul>
<li><b>Strategy</b> — the interface every algorithm implements, e.g. <code>RoutingStrategy.pick(gateways, payment)</code>.</li>
<li><b>Concrete Strategies</b> — <code>CheapestRouting</code>, <code>FastestRouting</code>, <code>HighestSuccessRouting</code>. Each is a self-contained algorithm.</li>
<li><b>Context</b> — <code>PaymentRouter</code>, which holds a Strategy reference and delegates the decision to it.</li>
</ul>
<pre>public final class CheapestRouting implements RoutingStrategy {
    @Override
    public PaymentGateway pick(List&lt;PaymentGateway&gt; gateways, Payment payment) {
        return gateways.stream()
            .min(Comparator.comparing(g -&gt; g.feeFor(payment.amount())))
            .orElseThrow();
    }
}

public final class HighestSuccessRouting implements RoutingStrategy {
    private final GatewayMetrics metrics;

    public HighestSuccessRouting(GatewayMetrics metrics) { this.metrics = metrics; }

    @Override
    public PaymentGateway pick(List&lt;PaymentGateway&gt; gateways, Payment payment) {
        return gateways.stream()
            .max(Comparator.comparing(g -&gt; metrics.successRate(g.id())))
            .orElseThrow();
    }
}</pre>
<p>The strategies are independent of one another and unaware of the context's internals; the context simply forwards the call.</p>` },
    { title: `Implementation flow`, body: `<p>Selection and execution are separated:</p>
<ol>
<li>Some policy chooses a strategy — from config, an experiment flag, or the merchant's tier: <code>router.setStrategy(new HighestSuccessRouting(metrics))</code>.</li>
<li>The context delegates when work arrives: <code>router.route(payment)</code> calls <code>strategy.pick(...)</code>.</li>
<li>Swapping behaviour is a one-line change of the injected strategy; adding a new algorithm means adding a class, not editing the context (open/closed).</li>
</ol>
<pre>// --- Context: delegates to the injected strategy ---
public class PaymentRouter {
    private RoutingStrategy strategy;

    public PaymentRouter(RoutingStrategy strategy) {
        this.strategy = strategy;
    }

    public void setStrategy(RoutingStrategy strategy) {
        this.strategy = strategy;  // client chooses the algorithm
    }

    public ChargeResult route(Payment payment, List&lt;PaymentGateway&gt; gateways) {
        PaymentGateway chosen = strategy.pick(gateways, payment);
        return chosen.charge(payment.toChargeRequest());
    }
}</pre>
<p>In Java, a strategy is often a functional interface — the pattern degenerates to passing a lambda, which is perfectly idiomatic.</p>` },
    { title: `Strategy vs State`, body: `<p>Strategy and <b>State</b> share the same class diagram — a context delegating to a swappable object — but their intent is opposite:</p>
<ul>
<li><b>Strategy</b>: the <em>client</em> chooses which algorithm to inject; the choice is usually fixed for the operation; strategies never trigger each other. Answers "how should I do this?"</li>
<li><b>State</b>: the object itself moves between states in response to events; states are aware of and cause transitions to one another. Answers "how do I behave now that I am in this mode?"</li>
</ul>
<pre>// Strategy: client injects — payment does NOT change its own algorithm
router.setStrategy(new CheapestRouting());   // external choice

// State: payment transitions itself — PENDING → CAPTURED → REFUNDED
payment.capture();  // internal state object decides the next transition</pre>
<p>Strategy's costs are the usual ones — more classes and the client needing to know the options — but it eliminates sprawling conditionals and makes each algorithm independently testable.</p>` },
  ],
  related: ["state", "template-method", "command", "bridge", "specification-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("strategy", stage, panel, stageEl);
}
