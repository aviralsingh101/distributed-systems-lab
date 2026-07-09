// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const CDC_SVG = `<svg viewBox="0 0 580 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CDC relay tailing the write-ahead log"><defs><marker id="fig-cdc-relay-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="59" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order Svc</text><text x="59" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">COMMIT</text><rect x="140" y="45" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="185" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Postgres</text><text x="185" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">WAL</text><rect x="266" y="45" width="96" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="314" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Debezium</text><text x="314" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">log tail</text><rect x="398" y="45" width="80" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="438" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Kafka</text><text x="438" y="76" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">topic</text><rect x="500" y="45" width="70" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="535" y="61" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Consumers</text><line x1="104" y1="65" x2="138" y2="65" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdc-relay-arr)"/><line x1="230" y1="65" x2="264" y2="65" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdc-relay-arr)"/><line x1="362" y1="65" x2="396" y2="65" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdc-relay-arr)"/><line x1="478" y1="65" x2="498" y2="65" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cdc-relay-arr)"/><text x="290" y="18" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">relay reads the log, not the tables — captures every committed change in order</text></svg>`;

const topic = makeTopic({
  id: "cdc-relay",
  title: "CDC Relay",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Turn a database's write-ahead log into an ordered event stream — the relay tails committed changes instead of polling tables.",
  sections: [
    {
      title: "What CDC captures",
      body: `<p><b>Change Data Capture (CDC)</b> reads a database's replication log — the Postgres WAL, MySQL binlog, or Mongo oplog — and emits one event per committed row change (insert, update, delete). Because the log is the same durable stream the database uses for crash recovery and replication, CDC sees <em>exactly</em> what committed, in commit order, with no gaps.</p>
<p>A <b>CDC relay</b> is the process that consumes that log and republishes it to a broker like Kafka. It is one of the two ways to implement the relay half of the outbox pattern; the other is a polling relay that runs <code>SELECT ... WHERE published_at IS NULL</code> against an outbox table.</p>`,
    },
    {
      title: "Structure — log tail vs table poll",
      figureAfter: "cdc-flow",
      body: `<p>A polling relay repeatedly queries a table, which adds query load and latency (you only see changes as fast as you poll). A CDC relay instead attaches as a <b>replication client</b>: the database pushes log records to it as they are written. Tools like <b>Debezium</b> run as Kafka Connect source connectors that manage this connection and offset bookkeeping.</p>
<p>Two common designs: (1) point CDC directly at your <em>business tables</em> and translate row images into events; (2) point CDC at a dedicated <em>outbox table</em> so you emit curated domain events instead of raw column diffs (the "outbox + CDC" combination Debezium supports natively).</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>The connector reads a consistent snapshot of the tables it tracks, establishing a baseline offset (LSN in Postgres).</li>
<li>It then streams the log from that offset, decoding each committed change into a structured record with before/after images.</li>
<li>Each record is published to a topic (often one topic per table), keyed by primary key so all changes to one row land on the same partition and stay ordered.</li>
<li>The connector durably checkpoints the last processed LSN. On restart it resumes from that offset — never re-reading committed history it already published, and never skipping.</li>
</ol>
<pre>// --- Debezium connector config for outbox table (application.properties) ---
// debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector
// debezium.source.table.include.list=public.outbox
// debezium.source.plugin.name=pgoutput
// debezium.transforms=outbox
// debezium.transforms.outbox.type=io.debezium.transforms.outbox.EventRouter
// debezium.transforms.outbox.route.topic.replacement=payment.events
// debezium.transforms.outbox.table.field.event.key=aggregate_id</pre>
<pre>// --- Consumer: treat CDC events like any at-least-once stream ---
@Service
public class CdcPaymentConsumer {
    @KafkaListener(topics = "payment.events", groupId = "ledger-projection")
    @Transactional
    public void apply(PaymentCapturedEvent event) {
        inbox.dedup(event.eventId()); // CDC may re-emit on connector restart
        ledgerProjection.upsert(event);
    }
}</pre>`,
    },
    {
      title: "Delivery semantics and pitfalls",
      body: `<p>CDC is <b>at-least-once</b>: after a crash the connector may re-emit records between its last checkpoint and the failure point, so downstream consumers still need the <b>inbox pattern</b> or idempotent upserts. Ordering is guaranteed only <em>per key/partition</em>, not globally.</p>
<p>Operational hazards: the database retains WAL segments until the replication slot advances, so a stalled relay can fill the disk and take the primary down — you must alert on replication slot lag. Schema changes (a dropped column) can break decoding. And CDC exposes raw persistence structure, which couples consumers to your table layout unless you use the outbox-table variant.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> near-real-time (milliseconds, not poll intervals); no extra query load on the primary; captures every change including those made by other apps or manual SQL; strong ordering per key.</p>
<p><b>Cons:</b> heavier operationally than a polling relay — replication slots, connector clusters, schema-registry management; risk of unbounded WAL growth on lag; raw row images leak schema unless curated. Choose a <b>polling relay</b> when you want the simplest possible ops and can tolerate sub-second-to-second latency; choose CDC when you need low latency, high throughput, or want to capture changes the application layer never modeled.</p>`,
    },
  ],
  figures: [
    { id: "cdc-flow", svg: CDC_SVG, caption: "A CDC relay attaches to the database's write-ahead log, decodes each committed change in order, and republishes to Kafka with per-key partitioning." },
  ],
  related: ["transactional-outbox", "inbox-pattern", "event-sourcing-projection", "deduplication", "domain-vs-integration-events"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("cdc-relay", stage, panel, stageEl);
}
