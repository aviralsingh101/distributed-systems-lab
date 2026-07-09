// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "point-to-point",
  title: "Point-to-Point",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A message on a queue is delivered to exactly one consumer — competing consumers share the load, each message processed once.`,
  sections: [
    { title: `What point-to-point is`, body: `<p><b>Point-to-point</b> messaging routes each message through a <b>queue</b> to a single consumer. Even if many consumers are attached, any given message is handed to only one of them. This is the opposite of pub/sub's fan-out: pub/sub gives every subscriber a copy, point-to-point gives one message to one worker.</p>
<p>The pattern models a unit of work that must happen exactly once: process this refund, send this receipt, settle this batch. You do not want three workers each processing the same refund.</p>` },
    { title: `Structure: the competing-consumers model`, body: `<p>The canonical structure is <b>competing consumers</b>: multiple identical workers subscribe to the same queue and the broker distributes messages among them. This gives you horizontal scalability (add workers to drain faster) and fault tolerance (if one worker dies, others keep pulling) for free, while preserving the once-per-message guarantee.</p>
<p>Delivery is coordinated by <b>acknowledgements</b>: the broker marks a message "in flight" when a worker picks it up and only removes it after the worker acks. If the worker crashes before acking, a visibility timeout expires and the message is redelivered to another worker. This is what makes the queue reliable — but it is also why processing must be idempotent.</p>` },
    { title: `Ordering and delivery semantics`, body: `<p>Point-to-point queues are typically <b>at-least-once</b>: a crash between "work done" and "ack sent" causes redelivery, so consumers can see a message twice. Key handlers on a business ID (<code>payment_id</code>) to dedupe.</p>
<p>Ordering is subtle. A single consumer draining one FIFO queue preserves order, but the moment you add competing consumers for throughput, messages are processed concurrently and global order is lost. Systems that need both ordering <em>and</em> parallelism (Kafka, SQS FIFO) use per-key partitions/message-groups: order is preserved within a key while different keys run in parallel.</p>` },
    { title: `When to use it`, body: `<p>Use point-to-point when a message represents work that exactly one worker should do and you want to scale that work by adding consumers — job processing, task distribution, command handling. Use pub/sub instead when several <em>different</em> services must each react to the same event. In practice large systems combine them: a topic fans an event out to several teams, and within each team a queue with competing consumers load-balances the actual processing.</p>
<p>Beware the <b>poison message</b> that fails on every redelivery and blocks or thrashes the queue — pair the queue with a dead-letter destination and a retry cap.</p>
<pre>// --- Point-to-point: one queue, competing consumers, same groupId ---
@Configuration
@EnableKafka
public class RefundQueueConfig {
    @Bean
    public NewTopic refundQueue() {
        return TopicBuilder.name("refund.process")
            .partitions(6) // max 6 parallel consumers
            .replicas(3)
            .build();
    }
}

@Service
public class RefundProcessor {
    @KafkaListener(
        topics = "refund.process",
        groupId = "refund-workers",  // all instances compete
        concurrency = "3"
    )
    @Transactional
    public void processRefund(RefundTask task) {
        inbox.dedup(task.refundId()); // at-least-once safe
        wallet.credit(task.walletId(), task.amount());
        refundRepo.markCompleted(task.refundId());
    }
}</pre>` },
  ],
  related: ["pub-sub-pattern", "work-queue", "dead-letter-pattern", "api-idempotency", "backpressure-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
