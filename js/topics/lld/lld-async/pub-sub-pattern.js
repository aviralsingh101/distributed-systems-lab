// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "pub-sub-pattern",
  title: "Pub/Sub",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `One publisher emits an event to a topic; every interested subscriber receives its own copy — senders and receivers never know each other.`,
  sections: [
    { title: `What pub/sub is`, body: `<p><b>Publish-subscribe</b> is a one-to-many messaging style. A publisher sends a message to a <b>topic</b> (a named channel) rather than to a specific recipient; the broker delivers a copy to <em>every</em> subscriber of that topic. Publishers and subscribers are fully decoupled — in identity (neither addresses the other), in time (subscribers can be offline and catch up), and in scaling (you add consumers without touching the producer).</p>
<p>This is the backbone of event-driven architecture. When a charge is captured, <b>Order Service</b> publishes <code>PaymentCaptured</code> once; the Ledger, the notifications service, and the fraud pipeline each react independently, and you can add a fifth consumer next quarter with zero producer changes.</p>` },
    { title: `Structure: topics, fan-out, and subscriptions`, body: `<p>The defining structural choice is <b>fan-out</b>: one publish becomes N deliveries. Two subscription models exist:</p>
<ul>
<li><b>Ephemeral / at-most-once</b> (classic Redis pub/sub) — messages are pushed only to subscribers connected right now; there is no retention. Simple, but a disconnected subscriber loses events.</li>
<li><b>Durable subscriptions</b> (Kafka consumer groups, SNS→SQS, RabbitMQ with durable queues) — the broker retains messages and tracks each subscriber's position, so a subscriber that was down resumes where it left off.</li>
</ul>
<p>Contrast with a <b>point-to-point</b> queue where each message goes to exactly one consumer. Pub/sub means each <em>distinct</em> subscriber gets a copy; within one subscriber you can still load-balance across a group so only one instance handles each message.</p>` },
    { title: `Delivery and ordering semantics`, body: `<p>Most durable pub/sub systems provide <b>at-least-once</b> delivery to each subscription, so every consumer must be idempotent. Ordering is guaranteed only per partition/key: in Kafka, messages with the same key (e.g. <code>wallet_id</code>) land on one partition and are ordered; across partitions there is no global order. Fan-out also means each subscriber advances at its own pace, so two consumers can be at very different offsets.</p>
<p>Filtering can happen by topic granularity or by message attributes (content-based routing, SNS filter policies), letting a subscriber receive only the subset it cares about instead of the whole firehose.</p>` },
    { title: `Tradeoffs and when to use it`, body: `<p><b>Strengths:</b> loose coupling, easy extensibility, and natural parallelism — the reasons event-driven systems scale organizationally. <b>Costs:</b> the producer loses visibility into who consumed what and whether they succeeded; debugging spans many independent consumers; and duplicate/reordered delivery pushes correctness work onto every subscriber.</p>
<p>Reach for pub/sub when multiple independent services must react to the same fact and you want to add consumers without redeploying the producer. Prefer a work queue when a message should be processed <em>once</em> by <em>one</em> worker, and prefer request-reply when the sender needs an answer.</p>
<pre>// --- Producer: one publish, many independent subscribers ---
@Service
public class PaymentEventBroadcaster {
    private final KafkaTemplate&lt;String, String&gt; kafka;

    @Transactional
    public void capture(CapturePaymentCommand cmd) {
        Payment payment = paymentRepo.save(Payment.create(cmd));
        outbox.save(OutboxEntity.paymentCaptured(payment));
    }
}

// Relay publishes to topic "payment.captured" — fan-out handled by broker</pre>
<pre>// --- Subscriber A: Ledger (own consumer group) ---
@KafkaListener(topics = "payment.captured", groupId = "ledger-service")
@Transactional
public void postEntry(PaymentCapturedEvent e) {
    inbox.dedup(e.eventId());
    ledger.post(e);
}

// --- Subscriber B: Notifications (different group, same topic) ---
@KafkaListener(topics = "payment.captured", groupId = "notifications")
public void sendReceipt(PaymentCapturedEvent e) {
    emailService.sendReceipt(e.customerEmail(), e);
}

// --- Subscriber C: Fraud (added next quarter — zero producer changes) ---
@KafkaListener(topics = "payment.captured", groupId = "fraud-scoring")
public void score(PaymentCapturedEvent e) {
    fraudEngine.evaluate(e);
}</pre>` },
  ],
  related: ["point-to-point", "work-queue", "fire-and-forget", "event-notification-vs-ecst", "event-driven-architecture"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("pub-sub-pattern", stage, panel, stageEl);
}
