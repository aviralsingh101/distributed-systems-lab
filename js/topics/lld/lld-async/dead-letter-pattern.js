// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const DLQ_SVG = `<svg viewBox="0 0 720 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dead-letter routing after max retries">
  <defs><marker id="fig-dead-letter-pattern-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="55" width="110" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="75" y="79" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">main queue</text>
  <rect x="200" y="55" width="120" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="260" y="73" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">consumer</text>
  <text x="260" y="88" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">try, retry N×</text>
  <rect x="200" y="55" width="120" height="40" rx="6" fill="none" stroke="none"/>
  <path d="M320 68 C 380 40, 380 40, 322 62" fill="none" stroke="#ffb454" stroke-width="1.2" marker-end="url(#fig-dead-letter-pattern-arr)"/>
  <text x="372" y="40" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">requeue &lt; N</text>
  <rect x="430" y="55" width="120" height="40" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="490" y="73" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">DLQ</text>
  <text x="490" y="88" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">parked, alerted</text>
  <rect x="600" y="55" width="100" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="650" y="73" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">fix + replay</text>
  <line x1="130" y1="75" x2="198" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-dead-letter-pattern-arr)"/>
  <line x1="320" y1="82" x2="428" y2="82" stroke="#ff6b6b" stroke-width="1.5" marker-end="url(#fig-dead-letter-pattern-arr)"/>
  <text x="375" y="100" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">after N failures</text>
  <line x1="550" y1="75" x2="598" y2="75" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-dead-letter-pattern-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "dead-letter-pattern",
  title: "Dead Letter Pattern",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Route messages that repeatedly fail processing to a separate dead-letter queue so one bad message cannot block or thrash the main queue.`,
  figures: [
    { id: "dlq-flow", svg: DLQ_SVG, caption: "A message is retried up to N times; once it exhausts retries it is moved to the dead-letter queue for inspection, then fixed and replayed." },
  ],
  sections: [
    { title: `The problem: poison messages`, body: `<p>In an at-least-once queue, a message that the consumer can never successfully process — malformed JSON, a reference to a deleted account, a bug that throws on this payload — is a <b>poison message</b>. Naive redelivery retries it forever: it returns to the head of the queue, fails, returns again. This either blocks a strictly-ordered queue entirely or burns consumer capacity in a tight failure loop while the backlog grows.</p>
<p>The <b>dead-letter pattern</b> breaks that loop by giving failures somewhere to go.</p>` },
    { title: `Structure and flow`, figureAfter: "dlq-flow", body: `<p>A <b>dead-letter queue (DLQ)</b> is an ordinary queue that holds messages which could not be processed. The broker (or your consumer) moves a message there when a policy trips:</p>
<ol>
<li>Consumer pulls the message and attempts to process it.</li>
<li>On failure the message is retried up to a configured <b>max-receive count</b> (usually with backoff).</li>
<li>Once retries are exhausted, the broker redirects the message to the DLQ instead of the main queue.</li>
<li>Operators inspect DLQ messages, fix the root cause (bad data, code bug, missing dependency), and <b>replay</b> them back onto the main queue.</li>
</ol>
<p>Preserve context on the way out: attach the failure reason, stack trace, attempt count, and original queue so the DLQ is debuggable rather than a graveyard of opaque blobs.</p>` },
    { title: `Configuration and semantics`, body: `<p>SQS attaches a <b>redrive policy</b> (a DLQ + <code>maxReceiveCount</code>) to a queue; RabbitMQ uses a <code>x-dead-letter-exchange</code> that catches rejected/expired messages; Kafka has no built-in DLQ, so frameworks (Kafka Connect, Spring) publish failures to a dead-letter topic. Distinguish <b>transient</b> failures (network blip, dependency down — worth retrying) from <b>permanent</b> ones (validation error — send straight to DLQ, do not waste retries).</p>
<p>Because the underlying delivery is still at-least-once, a message can be processed successfully and yet be seen again; idempotent handlers keep replay safe.</p>` },
    { title: `Operating a DLQ`, body: `<p>A DLQ is only useful if someone watches it. <b>Alert on DLQ depth &gt; 0</b> — a non-empty DLQ means real messages are going undelivered (a dropped payment event, a lost receipt). Treat it as an incident signal, not a passive log.</p>
<p>Provide a replay tool that lets operators fix data or deploy a patch and then re-inject DLQ messages after the bug is resolved. Watch for silent overflow (a DLQ that itself fills and drops) and for retry counts set so high that poison messages waste capacity for minutes before finally dead-lettering.</p>
<pre>// --- Spring Kafka: ErrorHandlingDeserializer + DeadLetterPublishingRecoverer ---
@Bean
public ConcurrentKafkaListenerContainerFactory&lt;String, String&gt; kafkaListenerContainerFactory(
        ConsumerFactory&lt;String, String&gt; cf,
        KafkaTemplate&lt;String, String&gt; template) {
    ConcurrentKafkaListenerContainerFactory&lt;String, String&gt; factory =
        new ConcurrentKafkaListenerContainerFactory&lt;&gt;();
    factory.setConsumerFactory(cf);
    factory.setCommonErrorHandler(new DefaultErrorHandler(
        new DeadLetterPublishingRecoverer(template,
            (record, ex) -&gt; new TopicPartition("payment.events.dlq", -1)),
        new FixedBackOff(1000L, 3) // 3 retries, then DLQ
    ));
    return factory;
}</pre>
<pre>@KafkaListener(topics = "payment.events", groupId = "wallet-service")
@Transactional
public void process(PaymentCapturedEvent event) {
    validate(event); // permanent failure → skip retries, send to DLQ
    inbox.dedup(event.eventId());
    wallet.applyCredit(event);
}

// --- DLQ replay tool (operator-facing) ---
@RestController
public class DlqReplayController {
    @PostMapping("/ops/dlq/replay/{messageId}")
    public void replay(@PathVariable UUID messageId) {
        DlqMessage msg = dlqStore.find(messageId);
        kafka.send(msg.originalTopic(), msg.key(), msg.payload());
        dlqStore.markReplayed(messageId);
    }
}</pre>` },
  ],
  related: ["dead-letter-queue", "work-queue", "point-to-point", "delayed-scheduled-messages", "api-idempotency"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("dead-letter-pattern", stage, panel, stageEl);
}
