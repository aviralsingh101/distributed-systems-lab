// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";

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
      title: "Structure",
      body: `<pre>class PaymentMetrics {
  private static instance: PaymentMetrics | null = null;
  private constructor() {}
  static getInstance(): PaymentMetrics {
    if (!PaymentMetrics.instance) {
      PaymentMetrics.instance = new PaymentMetrics();
    }
    return PaymentMetrics.instance;
  }
}</pre>
<p>In Spring or NestJS, prefer <code>@Singleton</code> scope in the DI container over hand-rolled <code>getInstance()</code> — the container owns lifecycle and makes testing easier (swap with mock bean).</p>`,
    },
    {
      title: "Thread safety",
      body: `<p>Lazy initialization in multi-threaded Order Service must be safe. Options:</p>
<ul>
<li><b>Eager static</b> — instance created at class load; simple, no race.</li>
<li><b>Synchronized getter</b> — correct but contended under load.</li>
<li><b>Initialization-on-demand holder</b> — JVM class loader guarantees thread-safe lazy init.</li>
<li><b>Enum singleton</b> — Joshua Bloch's recommended approach in Java; serialization-safe.</li>
</ul>`,
    },
    {
      title: "Testing and hidden coupling",
      body: `<p><code>PaymentMetrics.getInstance()</code> in business logic hides dependencies — unit tests cannot inject a fake without reflection or reset hooks. Better: constructor injection of an interface; container wires one implementation.</p>
<p>If you must use Singleton, add <code>resetForTests()</code> in test builds or pass the instance through DI in production while keeping the pattern for legacy entry points.</p>`,
    },
    {
      title: "Distributed systems caveat",
      body: `<p>Singleton is <b>per process</b>, not per cluster. Two Order Service pods each have their own Singleton — fine for per-JVM metrics, wrong for cluster-wide counters (use Redis or the database). Do not use Singleton to hold cross-request payment state; Wallet balance belongs in Ledger.</p>
<p>Serialization: if Singleton holds mutable state, deserialization can create a second instance unless you override <code>readResolve()</code> (Java) or use enum singleton. Kubernetes rolling deploys create new JVMs — any in-memory Singleton state resets on pod restart.</p>`,
    },
    {
      title: "Tradeoffs and when to use",
      body: `<p><b>Use when:</b> exactly one coordinated resource per JVM (connection pool, metrics registry, config snapshot loaded once at startup). The access cost of creating multiple instances is high or correctness requires single coordination point within the process.</p>
<p><b>Avoid when:</b> DI container already provides singleton scope; you need multiple instances in tests without global reset; the object holds mutable per-payment or per-user state; you are synchronizing across pods (use distributed lock or database instead).</p>
<p>Reasonable Singletons in payment services: OpenTelemetry meter registry, shared gRPC channel pool to Gateway, read-only merchant config cache refreshed hourly. Poor Singletons: current user's Wallet balance, idempotency dedup table, rate-limit counters that must be global across replicas.</p>`,
    },
  ],
  related: ["factory-method", "dependency-injection", "object-pool"],
  template: "topology",
  sim: () => ({
    note: "One MetricsRegistry instance — all Order pods share the same in-process counter.",
    toggles: [{ key: "fix", label: "Singleton via DI container", kind: "ok", value: false }],
    nodes: (ctx) => [
      { id: "h1", x: 200, y: 180, title: "Handler 1", color: C.service },
      { id: "h2", x: 200, y: 380, title: "Handler 2", color: C.service },
      { id: "singleton", x: 500, y: 280, title: "MetricsRegistry", color: ctx.toggles.fix ? C.accent : C.err, value: ctx.toggles.fix ? "1 instance" : "2 instances!" },
      { id: "prom", x: 750, y: 280, title: "Prometheus", color: C.ok },
    ],
    edges: (ctx) => [
      { from: "h1", to: "singleton", active: true, label: "increment" },
      { from: "h2", to: "singleton", active: true, label: "increment" },
      { from: "singleton", to: "prom", active: ctx.toggles.fix, label: "scrape" },
    ],
    activeEdge: (ctx) => ({ from: "h1", to: "singleton" }),
    status: (ctx) => ({
      text: ctx.toggles.fix ? "one registry — consistent metrics" : "duplicate counters — wrong QPS",
      cls: ctx.toggles.fix ? "ok" : "err",
    }),
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
