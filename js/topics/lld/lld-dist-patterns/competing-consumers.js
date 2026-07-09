// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const CC_SVG = `<svg viewBox="0 0 540 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Competing consumers on one queue"><defs><marker id="fig-competing-consumers-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="60" width="120" height="44" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="74" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Queue</text><text x="74" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">m1 m2 m3 m4</text><rect x="380" y="14" width="140" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="450" y="35" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Worker A</text><rect x="380" y="63" width="140" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="450" y="84" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Worker B</text><rect x="380" y="112" width="140" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="450" y="133" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Worker C</text><line x1="134" y1="74" x2="378" y2="32" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-competing-consumers-arr)"/><line x1="134" y1="82" x2="378" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-competing-consumers-arr)"/><line x1="134" y1="90" x2="378" y2="128" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-competing-consumers-arr)"/><text x="256" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">each message goes to exactly one worker; add workers to scale throughput</text></svg>`;

const topic = makeTopic({
  id: "competing-consumers",
  title: "Competing Consumers",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Run many workers pulling from one queue so throughput scales with worker count and each message is handled by exactly one consumer.",
  sections: [
    {
      title: "The idea",
      body: `<p>A single consumer processing a queue serially becomes the bottleneck: if messages arrive faster than one worker can handle them, lag grows without bound. The <b>competing consumers</b> pattern points <em>multiple</em> worker instances at the <em>same</em> queue. The broker hands each message to whichever worker is free, so the workers compete for messages and the pool's total throughput scales roughly linearly with its size.</p>
<p>This is the standard way to build an elastic pool of stateless workers — payment-notification senders, image processors, webhook deliverers.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "cc-flow",
      body: `<p>One logical channel, N consumers:</p>
<ul>
<li>In classic queues (SQS, RabbitMQ) all workers subscribe to one queue; the broker load-balances by delivering each message to a single available consumer.</li>
<li>In partitioned logs (Kafka) the equivalent is a <b>consumer group</b>: partitions are distributed across group members, and each partition is consumed by exactly one member. Parallelism is therefore capped at the partition count.</li>
</ul>
<p>Either way the guarantee is <b>one message, one worker</b> at a time — the pool does not double-process under normal operation.</p>`,
    },
    {
      title: "Implementation flow and delivery semantics",
      body: `<p>The delivery contract is <b>at-least-once</b>, which shapes the flow:</p>
<ol>
<li>A worker receives a message; it becomes invisible to others (SQS visibility timeout) or is checked out to that member.</li>
<li>The worker processes it and only then acknowledges/commits the offset.</li>
<li>If the worker crashes before acking, the visibility timeout expires and another worker retries the same message.</li>
</ol>
<p>Because a crash-then-retry can re-run a message, handlers <b>must be idempotent</b> — dedup on <code>payment_id</code> via the <b>inbox pattern</b>, or make the effect an upsert. Set the visibility timeout longer than the worst-case processing time, or a slow (not dead) worker's message gets picked up in parallel by a second worker.</p>
<pre>// --- Three competing consumers on one Kafka topic (same groupId) ---
@Configuration
@EnableKafka
public class ReceiptWorkerConfig {
    @Bean
    public ConcurrentKafkaListenerContainerFactory&lt;String, String&gt; factory(
            ConsumerFactory&lt;String, String&gt; cf) {
        ConcurrentKafkaListenerContainerFactory&lt;String, String&gt; f =
            new ConcurrentKafkaListenerContainerFactory&lt;&gt;();
        f.setConsumerFactory(cf);
        f.setConcurrency(3); // 3 worker threads compete for partitions
        f.getContainerProperties().setAckMode(AckMode.RECORD);
        return f;
    }
}

@Service
public class ReceiptSender {
    @KafkaListener(
        topics = "receipt.send",
        groupId = "receipt-workers",
        containerFactory = "factory"
    )
    @Transactional
    public void sendReceipt(SendReceiptCommand cmd) {
        inbox.dedup(cmd.paymentId()); // idempotent under redelivery
        emailGateway.send(cmd.customerEmail(), buildReceipt(cmd));
    }
}</pre>`,
    },
    {
      title: "Ordering, scaling, and poison messages",
      body: `<p><b>Ordering:</b> spreading messages across workers destroys global order. If you need per-entity order (all events for one wallet in sequence), route them to the same worker — Kafka does this by partition key; with plain queues use one queue per ordering key or a session/group id.</p>
<p><b>Scaling:</b> add workers to drain a backlog, but watch the shared downstream (a database) — more workers means more concurrent load, so competing consumers can turn a queue backlog into a database overload. In Kafka you cannot exceed the partition count, so provision partitions for peak parallelism up front.</p>
<p><b>Poison messages:</b> a message that always fails will be retried forever and can block progress; cap retries and route to a dead-letter queue.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> simple horizontal scaling and elasticity; automatic failover (a dead worker's messages are redelivered); smooths bursty load. <b>Cons:</b> loses global ordering; requires idempotent handlers due to at-least-once; can overload shared downstreams; Kafka parallelism bounded by partitions. <b>Use when</b> work items are independent and throughput must scale; <b>avoid</b> when strict total ordering across all messages is required.</p>`,
    },
  ],
  figures: [
    { id: "cc-flow", svg: CC_SVG, caption: "Competing consumers: many workers pull from one queue, each message handled by exactly one worker; throughput scales with the pool." },
  ],
  related: ["priority-queue-consumer", "work-queue", "dead-letter-pattern", "backpressure-pattern", "inbox-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("competing-consumers", stage, panel, stageEl);
}
