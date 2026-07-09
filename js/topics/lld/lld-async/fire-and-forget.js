// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "fire-and-forget",
  title: "Fire-and-Forget",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A one-way messaging style: the sender emits a message and moves on without waiting for, or tracking, any reply.`,
  sections: [
    { title: `What fire-and-forget means`, body: `<p><b>Fire-and-forget</b> is the simplest asynchronous interaction style: the producer sends one message and immediately continues, never blocking on a response and never correlating a reply. It is the messaging analogue of a UDP datagram or a <code>void</code> method call across a network — you hand the message off and forget about it.</p>
<p>The pattern is right when the sender genuinely does not need an answer to make progress: recording an audit event, emitting a metric, warming a cache, or telling the Ledger "a charge was captured" for a downstream projection. The caller's latency is decoupled from the receiver's processing time, which is the whole point.</p>` },
    { title: `Structure and message flow`, body: `<p>There are two common structural variants, and they have very different guarantees:</p>
<ol>
<li><b>In-process fire-and-forget</b> — the caller schedules work on a background thread/executor or an <code>async</code> task and returns. If the process crashes before the task runs, the message is <b>lost</b>. There is no durability.</li>
<li><b>Broker-backed fire-and-forget</b> — the caller publishes to a queue or topic (Kafka, RabbitMQ, SQS) and returns after the broker acknowledges the write. The broker persists and redelivers, so the message survives a consumer crash.</li>
</ol>
<p>The flow is deliberately thin: <b>Order Service</b> emits <code>PaymentCaptured</code> to the <b>Event Queue</b> and returns <code>200</code> to the client; a separate consumer later updates the analytics projection. The producer never learns whether that consumer succeeded.</p>` },
    { title: `Delivery and ordering semantics`, body: `<p>Fire-and-forget says nothing about <em>reliability</em> on its own — that comes from the transport you choose. In-process delivery is effectively <b>at-most-once</b>: no ack, so a crash silently drops the message. A durable broker with producer acks gives <b>at-least-once</b> delivery, which means consumers must be <b>idempotent</b> because redelivery can duplicate.</p>
<p>Ordering is only guaranteed within a single partition/queue and only if you keep one in-flight message per key. The moment you send with a fire-and-forget producer that batches or retries, later messages can overtake earlier ones unless you pin them to a partition key (e.g. <code>wallet_id</code>).</p>` },
    { title: `Failure modes and how to bound them`, body: `<p>The danger of fire-and-forget is that failures are <b>invisible to the sender</b>. Mitigate the common traps:</p>
<ul>
<li><b>Silent loss</b> — an in-process send after a crash disappears. If loss is unacceptable, publish through a durable broker or the <b>transactional outbox</b> so the emit commits with the business row.</li>
<li><b>Unbounded buffering</b> — if the caller never blocks, a slow consumer lets in-memory or broker backlog grow until you run out of memory or disk. Pair with backpressure or bounded queues.</li>
<li><b>Poison messages</b> — a message the consumer can never process loops forever; route it to a dead-letter queue after N attempts.</li>
</ul>
<p>Use fire-and-forget when the emit is genuinely non-critical or when durability is delegated to a broker/outbox — not as a shortcut to avoid handling errors on a path that actually matters, like debiting a Wallet.</p>
<pre>// --- Broker-backed fire-and-forget: publish and return after broker ack ---
@Service
public class PaymentEventPublisher {
    private final KafkaTemplate&lt;String, String&gt; kafka;

    public void paymentCaptured(Payment payment) {
        PaymentCapturedEvent event = new PaymentCapturedEvent(
            UUID.randomUUID(), payment.getId(), payment.getWalletId(),
            payment.getAmountCents());
        kafka.send("payment.events", payment.getWalletId(), Json.write(event));
        // No wait for consumer; caller continues immediately
    }
}</pre>
<pre>// --- Durable variant: outbox instead of direct publish ---
@Transactional
public void captureWithOutbox(CapturePaymentCommand cmd) {
    Payment payment = paymentRepo.save(Payment.create(cmd));
    ledger.debit(cmd.walletId(), cmd.amount());
    outbox.save(OutboxEntity.paymentCaptured(payment));
    // Event survives even if relay crashes before publish
}</pre>
<pre>// --- In-process (fragile): @Async without broker — lost on crash ---
@Async
public void warmAnalyticsCache(PaymentCapturedEvent event) {
    analyticsCache.put(event.paymentId(), event); // no durability guarantee
}</pre>` },
  ],
  related: ["request-reply", "pub-sub-pattern", "transactional-outbox", "dead-letter-pattern", "backpressure-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
