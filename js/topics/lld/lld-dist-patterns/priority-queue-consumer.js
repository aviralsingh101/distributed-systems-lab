// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const PQ_SVG = `<svg viewBox="0 0 540 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Priority queue consumer draining high before low"><defs><marker id="fig-priority-queue-consumer-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="20" width="150" height="34" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/><text x="89" y="41" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">HIGH queue</text><rect x="14" y="96" width="150" height="34" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/><text x="89" y="117" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">LOW queue</text><rect x="230" y="58" width="120" height="42" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="290" y="76" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Consumer</text><text x="290" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">HIGH first</text><rect x="420" y="58" width="106" height="42" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="473" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">worker pool</text><line x1="164" y1="37" x2="228" y2="66" stroke="#ff6b6b" stroke-width="1.5" marker-end="url(#fig-priority-queue-consumer-arr)"/><line x1="164" y1="113" x2="228" y2="92" stroke="#93a1bd" stroke-width="1.3" stroke-dasharray="3 3" marker-end="url(#fig-priority-queue-consumer-arr)"/><line x1="350" y1="79" x2="418" y2="79" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-priority-queue-consumer-arr)"/><text x="300" y="132" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">poll HIGH until empty, then LOW &#8212; reserve capacity to avoid starvation</text></svg>`;

const topic = makeTopic({
  id: "priority-queue-consumer",
  title: "Priority Queue Consumer",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Serve urgent messages ahead of ordinary ones by consuming across priority tiers — while guarding low-priority work from starvation.",
  sections: [
    {
      title: "The problem: not all messages are equal",
      body: `<p>A single FIFO queue treats a fraud alert or a customer-facing payment the same as a nightly report email. Under load, urgent work waits behind a backlog of trivial work. You want <b>priority</b>: high-importance messages should be processed before low-importance ones, regardless of arrival order.</p>
<p>The <b>priority queue consumer</b> pattern delivers this. Note that most real brokers (Kafka, SQS standard) do <em>not</em> offer true per-message priority ordering, so the pattern is usually implemented as multiple queues consumed with a priority policy.</p>`,
    },
    {
      title: "Structure — separate queues per tier",
      figureAfter: "pq-flow",
      body: `<p>The common, broker-agnostic design uses one queue per priority level (HIGH, NORMAL, LOW) fed by a <b>message router</b> that classifies each message:</p>
<ul>
<li>Consumers poll the queues in priority order: drain HIGH, then NORMAL, then LOW.</li>
<li>Because each tier is an ordinary queue, you still get <b>competing consumers</b> within a tier for scale.</li>
</ul>
<p>Some brokers (RabbitMQ priority queues, ActiveMQ) support in-queue priority via a header; that works for modest priority spreads but can reorder within a single queue rather than across dedicated channels.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>Router assigns each incoming message a priority and enqueues it on the matching tier.</li>
<li>A consumer attempts to receive from HIGH; if a message is available it processes it.</li>
<li>Only when HIGH is empty does it poll NORMAL, then LOW.</li>
<li>After finishing, it loops back to HIGH first, so newly-arrived urgent work preempts pending low work.</li>
</ol>
<pre>// --- Priority consumer: poll HIGH, then NORMAL, then LOW ---
@Service
public class PriorityPaymentProcessor {
    private final SqsClient sqs;
    private static final List&lt;String&gt; QUEUES = List.of(
        "payments-high", "payments-normal", "payments-low");

    @Scheduled(fixedDelay = 100)
    public void poll() {
        for (String queue : QUEUES) {
            ReceiveMessageResponse resp = sqs.receiveMessage(r -&gt; r
                .queueUrl(queueUrl(queue))
                .maxNumberOfMessages(1)
                .waitTimeSeconds(1));
            if (!resp.messages().isEmpty()) {
                process(resp.messages().get(0), queue);
                return; // always restart from HIGH on next tick
            }
        }
    }

    private void process(Message msg, String queue) {
        // process payment; delete message on success
    }
}</pre>
<pre>// --- Weighted variant: 8 HIGH for every 2 LOW to prevent starvation ---
private int highProcessed = 0;

public Optional&lt;Message&gt; pollWeighted() {
    if (highProcessed &lt; 8) {
        Optional&lt;Message&gt; high = pollQueue("payments-high");
        if (high.isPresent()) { highProcessed++; return high; }
    }
    highProcessed = 0;
    return pollQueue("payments-low");
}</pre>`,
    },
    {
      title: "The starvation trap",
      body: `<p>A strict "always HIGH first" policy <b>starves</b> low-priority messages: if high-priority traffic never drains, low-priority work is never served (see priority-queue-starvation). Fixes: <b>reserve capacity</b> — dedicate some workers to lower tiers; use <b>weighted</b> polling (process ~8 HIGH for every 2 LOW rather than all HIGH first); or apply <b>aging</b>, promoting a message's effective priority the longer it waits. Also watch <b>priority inversion</b>, where a low-priority item holds a resource a high-priority item needs.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> urgent work gets low latency under load; simple to implement with multiple standard queues; scales per tier with competing consumers.</p>
<p><b>Cons:</b> risk of starving low-priority work without weighting or reservation; more queues and routing to manage; true per-message priority is unavailable on many brokers, and ordering guarantees weaken across tiers. <b>Use when</b> workloads have genuinely different urgency and SLAs; <b>avoid</b> when all work is equally important (one queue is simpler) or when strict global ordering matters more than urgency.</p>`,
    },
  ],
  figures: [
    { id: "pq-flow", svg: PQ_SVG, caption: "Priority queue consumer: messages are classified into priority tiers; consumers drain higher tiers first, with reservation/weighting to prevent starving lower tiers." },
  ],
  related: ["message-router", "competing-consumers", "backpressure-pattern", "dead-letter-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
