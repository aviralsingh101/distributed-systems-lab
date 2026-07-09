// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "delayed-scheduled-messages",
  title: "Delayed / Scheduled Messages",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Enqueue a message now but make it invisible to consumers until a future time — the basis for retries with backoff, timeouts, and reminders.`,
  sections: [
    { title: `What delayed messaging is`, body: `<p>A <b>delayed</b> (or <b>scheduled</b>) message is one that is produced now but must not be delivered until a specified time or after a fixed delay. It lets you schedule future work without a polling loop or a cron job scanning a table. Typical uses in a payment system: retry a failed Gateway call in 30 seconds, cancel an unpaid order after 15 minutes, send a "payment still pending" reminder in an hour, or fire a reconciliation check after a settlement window.</p>
<p>The distinguishing feature is a per-message <b>visibility time</b>: the broker holds the message and only makes it available to consumers once the delay elapses.</p>` },
    { title: `Structure: how brokers implement delay`, body: `<p>Different systems realize the same idea with different mechanisms:</p>
<ul>
<li><b>Native delay</b> — SQS supports a per-message delay (up to 15 min) and Azure Service Bus supports <code>ScheduledEnqueueTime</code>. The broker keeps the message hidden until due.</li>
<li><b>Dead-letter + TTL trick</b> (RabbitMQ) — publish to a queue with a message TTL and no consumer; on expiry the message dead-letters into the real queue. A delay is modeled as "expire, then route".</li>
<li><b>Timer / delay topic</b> (Kafka) — Kafka has no native per-message delay, so you use a dedicated delay topic plus a scheduler, or a tumbling set of per-duration topics, or an external scheduler (a DB "due_at" table, a timer service) that republishes when due.</li>
</ul>
<p>Under the hood these are priority queues / timer wheels ordered by due time, so the earliest-due message is dispatched first.</p>` },
    { title: `The dominant use: retry with backoff`, body: `<p>The most common application is <b>retry scheduling</b>. When a consumer fails, instead of immediately redelivering (which hammers a struggling dependency), you re-enqueue the message with an increasing delay — <b>exponential backoff</b>, ideally with <b>jitter</b> to avoid synchronized retry storms. After a maximum number of attempts the message is routed to a dead-letter queue.</p>
<p>Scheduled messages also implement <b>timeouts as data</b>: when an order is created, schedule a "cancel if still unpaid" message for T+15m; if payment arrives first, the handler sees the order already paid and no-ops.</p>` },
    { title: `Semantics and pitfalls`, body: `<p>Delay is a <b>lower bound, not an exact deadline</b> — brokers guarantee "not before" the scheduled time, not "precisely at" it; expect drift under load. Delivery is still at-least-once, so a scheduled timeout handler can fire more than once and must be idempotent and must re-check current state (the order may already be paid).</p>
<p>Beware caps (SQS's 15-minute limit forces you to chain hops for longer delays), the storage cost of many long-pending messages, and clock/timezone bugs when the "due at" is computed on a different host than the one that evaluates it.</p>
<pre>// --- Schedule order cancellation 15 minutes after creation ---
@Service
public class OrderTimeoutScheduler {
    private final KafkaTemplate&lt;String, String&gt; kafka;

    @Transactional
    public Order createOrder(CreateOrderCommand cmd) {
        Order order = orderRepo.save(Order.create(cmd));
        CancelUnpaidOrderTask task = new CancelUnpaidOrderTask(
            order.getId(), Instant.now().plus(15, ChronoUnit.MINUTES));
        kafka.send("order.cancel.delayed", order.getId().toString(), Json.write(task));
        return order;
    }
}</pre>
<pre>// --- Kafka delay via dedicated scheduler service ---
@Service
public class DelayedMessageScheduler {
    private final ScheduledTaskRepository tasks;
    private final KafkaTemplate&lt;String, String&gt; kafka;

    public void schedule(String targetTopic, String key, String payload, Instant dueAt) {
        tasks.save(new ScheduledTask(targetTopic, key, payload, dueAt));
    }

    @Scheduled(fixedRate = 1000)
    @Transactional
    public void dispatchDue() {
        tasks.findDue(Instant.now()).forEach(task -&gt; {
            kafka.send(task.targetTopic(), task.key(), task.payload());
            tasks.delete(task.id());
        });
    }
}

// --- Handler must re-check state (idempotent) ---
@KafkaListener(topics = "order.cancel.ready")
@Transactional
public void cancelIfStillUnpaid(CancelUnpaidOrderTask task) {
    Order order = orderRepo.findById(task.orderId()).orElseThrow();
    if (order.getStatus() == OrderStatus.UNPAID) {
        order.cancel("payment timeout");
    }
}</pre>` },
  ],
  related: ["work-queue", "dead-letter-pattern", "point-to-point", "api-idempotency", "backpressure-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
