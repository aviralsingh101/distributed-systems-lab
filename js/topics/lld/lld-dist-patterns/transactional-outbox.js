// @article-v2
import { makeTopic, paymentFlow, actors } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "transactional-outbox",
  title: "Transactional Outbox",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Atomically persist business data and an integration event in one DB transaction — then relay to the queue.",
  sections: [
    {
      title: "Motivation — the dual-write problem",
      body: `<p>Your service must update its database <i>and</i> notify other systems (Kafka, SQS), but those are two separate systems with no shared transaction. Commit DB and crash before publish → downstream never hears about the payment. Publish first and DB rolls back → consumers process phantom <code>payment.completed</code>.</p>
<p>The outbox does not pretend both writes are one global atomic operation. It makes a smaller promise: the business row and a durable <b>"please send this event"</b> record commit together in the same local ACID transaction.</p>`,
    },
    {
      title: "Structure",
      body: `<pre>CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ NULL
);
CREATE INDEX outbox_unpublished ON outbox (created_at)
  WHERE published_at IS NULL;</pre>
<p>Distinct from <b>2PC/XA</b> (fragile), <b>CDC</b> (Debezium — great for replication, less intentful for domain events), and <b>inbox pattern</b> on the consumer (dedup incoming). Outbox is producer-side reliability.</p>`,
    },
    {
      title: "Step-by-step flow",
      body: `<ol>
<li>Inside one <code>@Transactional</code>: <code>UPDATE ledger SET balance = ...</code></li>
<li>Same transaction: <code>INSERT INTO outbox (...)</code></li>
<li><code>COMMIT</code> — both or neither</li>
<li>Relay (separate process): <code>SELECT ... WHERE published_at IS NULL FOR UPDATE SKIP LOCKED</code></li>
<li>Publish to broker, then <code>UPDATE published_at</code> after ack</li>
</ol>
<div class="callout"><p><b>Key insight:</b> Outbox guarantees <em>at-least-once</em> to the broker, not exactly-once end-to-end. Consumers <b>must</b> be idempotent.</p></div>`,
    },
    {
      title: "Relay options and operations",
      body: `<ul>
<li><b>Polling relay</b> — simple; adds 100ms–1s latency. Scale workers with <code>SKIP LOCKED</code>.</li>
<li><b>CDC relay</b> — Debezium on WAL; near-real-time; heavier ops.</li>
</ul>
<p>Alert on outbox oldest-unpublished age. Pause relay during broker maintenance without stopping writes. Store event type + ids in payload, not full snapshots.</p>`,
    },
    {
      title: "Payment platform example",
      body: `<p>On <code>POST /v1/pay</code>, Order Service opens a transaction: debits Wallet in Ledger, inserts <code>outbox { event_type: PaymentCaptured, payment_id }</code>, commits. Within 200ms the relay publishes to Event Queue; Wallet consumer checks inbox for <code>payment_id</code>, applies loyalty credit once.</p>
<p>Integration test: commit payment + outbox, kill relay before publish, restart relay, assert Event Queue receives exactly one processable message. Chaos: duplicate relay delivery, assert Wallet inbox dedups.</p>
<p>Partition Kafka by <code>wallet_id</code> when Wallet must see ordered payment events. Archive published outbox rows older than 7 days to cold storage for audit.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> atomic local guarantee — if payment row exists, publish intent exists. No distributed 2PC; works with any broker and vanilla RDBMS. Curated domain events (<code>PaymentCaptured</code>) unlike raw CDC row images. Backpressure visible via outbox depth metric.</p>
<p><b>Cons:</b> at-least-once to broker — mandatory idempotent consumers. Extra table, relay service, and monitoring. Poll-based relay adds latency vs synchronous publish. Per-aggregate ordering requires explicit <code>sequence</code> column design.</p>
<p><b>Use when:</b> microservice must not lose integration events after DB commit; you own the producer DB; downstream can deduplicate via inbox pattern or idempotency keys.</p>
<p><b>Avoid when:</b> no message broker; only need analytics replication (CDC to warehouse may suffice); hard exactly-once requirement without idempotent consumers.</p>`,
    },
  ],
  related: ["exactly-once", "deduplication", "idempotency-key"],
  template: "flow",
  sim: () => paymentFlow({
    note: "DB + outbox in one txn; relay publishes async.",
    fixLabel: "Transactional outbox + relay",
    actors: () => [
      actors.order("charge"),
      actors.ledger("balance"),
      { id: "outbox", label: "Outbox", color: "#ffb454", kind: "db", value: "0 pending" },
      actors.queue("events"),
    ],
    stepsBroken: () => [
      { from: "order", to: "ledger", label: "commit ✓", set: { ledger: "paid" } },
      { from: "order", to: "queue", label: "publish?", bad: true, dashed: true, set: { queue: "lost!" } },
    ],
    stepsFixed: () => [
      { from: "order", to: "ledger", label: "txn: commit", good: true, set: { ledger: "paid" } },
      { from: "order", to: "outbox", label: "txn: insert", good: true, set: { outbox: "1 pending" } },
      { from: "outbox", to: "queue", label: "relay", good: true, set: { outbox: "sent", queue: "ok" } },
    ],
    statusOk: "outbox guarantees delivery",
    statusBad: "event may be lost",
  }),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
