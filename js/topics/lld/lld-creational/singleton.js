// @article-v2
// @sim-lab
// @figure-handcrafted
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const SINGLETON_SVG = `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Singleton instance sharing">
  <defs><marker id="fig-singleton-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="260" y="20" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Singleton — one MetricsRegistry per JVM</text>
  <rect x="40" y="40" width="100" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="90" y="65" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Handler 1</text>
  <rect x="40" y="95" width="100" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="90" y="120" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Handler 2</text>
  <rect x="220" y="68" width="120" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="2"/>
  <text x="280" y="88" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">MetricsRegistry</text>
  <text x="280" y="104" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">single instance</text>
  <line x1="140" y1="60" x2="218" y2="82" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-singleton-arr)"/>
  <line x1="140" y1="115" x2="218" y2="98" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-singleton-arr)"/>
  <text x="400" y="55" fill="#ff5c6c" font-size="9" font-family="system-ui">without singleton:</text>
  <rect x="380" y="65" width="90" height="28" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="425" y="83" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Registry A</text>
  <rect x="380" y="100" width="90" height="28" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="425" y="118" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Registry B</text>
</svg>`;

const topic = makeTopic({
  id: "singleton",
  title: "Singleton",
  category: "lld-creational",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Ensure a class has exactly one instance and provide a global access point — without turning your codebase into untestable static globals.",
  sections: [
    {
      title: "Motivation",
      body: `<p>Some resources should exist exactly once per process: connection pool manager, metrics registry, feature-flag client, or in-memory rate-limit counter. <b>Singleton</b> centralizes that instance and exposes a single access point.</p>
<p>Unlike global static mutable state scattered across files, Singleton is an explicit pattern — one class, one instance, one getter. The danger is overuse: not every shared object needs Singleton; dependency injection often provides "one instance per container" without the pattern's baggage.</p>`,
    },
    {
      title: "Structure — enum singleton (recommended)",
      figureAfter: "singleton-instance",
      body: `<p>Joshua Bloch recommends the <b>enum singleton</b> in Java: thread-safe, serialization-safe, and reflection-proof in one line.</p>
<pre>public enum PaymentMetricsRegistry {
    INSTANCE;

    private final Map&lt;String, LongAdder&gt; counters = new ConcurrentHashMap&lt;&gt;();

    public void increment(String metric) {
        counters.computeIfAbsent(metric, k -&gt; new LongAdder()).increment();
    }

    public long count(String metric) {
        LongAdder adder = counters.get(metric);
        return adder == null ? 0 : adder.sum();
    }
}

// Usage — two handlers share the same counters
public class ChargeHandler {
    public void handle(ChargeRequest req) {
        PaymentMetricsRegistry.INSTANCE.increment("charges.total");
        // ...
    }
}

public class RefundHandler {
    public void handle(RefundRequest req) {
        PaymentMetricsRegistry.INSTANCE.increment("refunds.total");
    }
}</pre>
<p>Enum serialization cannot create a second instance — the JVM guarantees <code>INSTANCE</code> is the only object after deserialization.</p>`,
    },
    {
      title: "Structure — initialization-on-demand holder",
      body: `<p>For non-enum classes, the <b>holder idiom</b> gives lazy, thread-safe initialization without synchronized getters. The JVM class loader guarantees thread safety when a nested class is first referenced.</p>
<pre>public final class GatewayConnectionPool {
    private GatewayConnectionPool() {
        // expensive: open TCP connections to payment gateway
    }

    private static class Holder {
        static final GatewayConnectionPool INSTANCE = new GatewayConnectionPool();
    }

    public static GatewayConnectionPool getInstance() {
        return Holder.INSTANCE;
    }

    public Connection acquire() { /* ... */ }
    public void release(Connection conn) { /* ... */ }
}</pre>
<p>The pool is created only when <code>getInstance()</code> is first called, and only once — no double-checked locking bugs.</p>`,
    },
    {
      title: "Why DI is usually better",
      body: `<p><code>PaymentMetricsRegistry.getInstance()</code> in business logic hides dependencies — unit tests cannot inject a fake without reflection or reset hooks. Constructor injection of an interface; the container wires one implementation per JVM scope.</p>
<pre>public interface MetricsRegistry {
    void increment(String metric);
    long count(String metric);
}

public class OrderService {
    private final MetricsRegistry metrics;
    private final PaymentGateway gateway;

    // DI: explicit dependency, swappable in tests
    public OrderService(MetricsRegistry metrics, PaymentGateway gateway) {
        this.metrics = metrics;
        this.gateway = gateway;
    }

    public Order placeOrder(PlaceOrderCommand cmd) {
        metrics.increment("orders.placed");
        return gateway.charge(cmd.toChargeRequest()).toOrder();
    }
}

// Spring @Singleton scope or manual wiring in main()
// MetricsRegistry bean = new InMemoryMetricsRegistry();  // one instance per container
// OrderService svc = new OrderService(bean, stripeGateway);</pre>
<p>The container provides singleton <em>scope</em> without static globals — same "one instance" guarantee, but testable and explicit.</p>`,
    },
    {
      title: "Distributed systems caveat",
      body: `<p>Singleton is <b>per process</b>, not per cluster. Two Order Service pods each have their own Singleton — fine for per-JVM metrics, wrong for cluster-wide counters (use Redis or the database). Do not use Singleton to hold cross-request payment state; Wallet balance belongs in Ledger.</p>
<p>Serialization: if Singleton holds mutable state, deserialization can create a second instance unless you use enum singleton or override <code>readResolve()</code>. Kubernetes rolling deploys create new JVMs — any in-memory Singleton state resets on pod restart.</p>`,
    },
    {
      title: "Tradeoffs and when to use",
      body: `<p><b>Use when:</b> exactly one coordinated resource per JVM (connection pool, metrics registry, config snapshot loaded once at startup). The access cost of creating multiple instances is high or correctness requires single coordination point within the process.</p>
<p><b>Avoid when:</b> DI container already provides singleton scope; you need multiple instances in tests without global reset; the object holds mutable per-payment or per-user state; you are synchronizing across pods (use distributed lock or database instead).</p>
<p>Reasonable Singletons in payment services: OpenTelemetry meter registry, shared gRPC channel pool to Gateway, read-only merchant config cache refreshed hourly. Poor Singletons: current user's Wallet balance, idempotency dedup table, rate-limit counters that must be global across replicas.</p>`,
    },
  ],
  figures: [
    { id: "singleton-instance", svg: SINGLETON_SVG, caption: "Two HTTP handlers share one MetricsRegistry instance. Without Singleton (or DI singleton scope), each handler gets duplicate counters." },
  ],
  related: ["factory-method", "dependency-injection", "object-pool"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("singleton", stage, panel, stageEl);
}
