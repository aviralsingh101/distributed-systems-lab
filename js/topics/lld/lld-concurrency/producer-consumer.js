// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const PC_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Producer consumer bounded buffer">
  <defs><marker id="fig-producer-consumer-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="55" width="120" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="90" y="75" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">producer A</text>
  <rect x="30" y="95" width="120" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="90" y="115" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">producer B</text>
  <rect x="260" y="60" width="200" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="360" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">bounded buffer (cap = 4)</text>
  <text x="360" y="102" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">[ x ][ x ][ x ][ &nbsp; ]</text>
  <rect x="570" y="55" width="120" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="630" y="75" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">consumer 1</text>
  <rect x="570" y="95" width="120" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="630" y="115" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">consumer 2</text>
  <line x1="150" y1="70" x2="258" y2="80" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-producer-consumer-arr)"/>
  <line x1="150" y1="110" x2="258" y2="100" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-producer-consumer-arr)"/>
  <line x1="460" y1="80" x2="568" y2="70" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-producer-consumer-arr)"/>
  <line x1="460" y1="100" x2="568" y2="110" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-producer-consumer-arr)"/>
  <text x="360" y="145" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">full → producers block · empty → consumers block</text>
</svg>`;

const topic = makeTopic({
  id: "producer-consumer",
  title: "Producer-Consumer",
  category: "lld-concurrency",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A bounded queue between producers and consumers decouples their rates and applies backpressure when the two sides drift apart.`,
  sections: [
    { title: `The rate-mismatch problem`, body: `<p>Producers and consumers rarely run at the same speed, and their speeds vary over time. If producers outrun consumers with no buffer, either producers block on every hand-off or work piles up without bound. The <b>producer-consumer</b> pattern puts a <b>bounded buffer</b> (a thread-safe queue) between them: producers <code>put</code> items, consumers <code>take</code> them, and neither needs to know how many of the other exist or how fast they run.</p>` },
    { title: `Structure and the blocking contract`, figureAfter: "pc", body: `<p>The core is a queue plus two synchronization conditions:</p>
<ul>
<li>When the buffer is <b>full</b>, <code>put</code> blocks until a consumer frees a slot. This is <b>backpressure</b> — it slows fast producers to the consumer rate instead of exhausting memory.</li>
<li>When the buffer is <b>empty</b>, <code>take</code> blocks until a producer adds an item, so idle consumers do not busy-spin.</li>
</ul>
<p>Classically this is implemented with a mutex and two condition variables (<code>notFull</code>, <code>notEmpty</code>). A waiting thread releases the lock while parked and re-checks its condition in a <code>while</code> loop on wake-up (never an <code>if</code>) to guard against spurious wake-ups and lost wake-ups. Most languages ship a ready-made <code>BlockingQueue</code> / channel that encapsulates this correctly.</p>
<pre>// Payment webhook events: HTTP producers, settlement consumers
public final class PaymentEventPipeline {
    private final BlockingQueue&lt;PaymentEvent&gt; buffer =
        new ArrayBlockingQueue&lt;&gt;(256);  // bounded — backpressure on producers

    public void publish(PaymentEvent event) throws InterruptedException {
        buffer.put(event);   // blocks when full
    }

    public PaymentEvent consume() throws InterruptedException {
        return buffer.take(); // blocks when empty
    }
}

// Producer: webhook controller enqueues, returns 202 immediately
@RestController
class WebhookController {
    private final PaymentEventPipeline pipeline;
    @PostMapping("/webhooks/stripe")
    public ResponseEntity&lt;Void&gt; onEvent(@RequestBody StripePayload payload)
            throws InterruptedException {
        pipeline.publish(PaymentEvent.fromStripe(payload));
        return ResponseEntity.accepted().build();
    }
}

// Consumer: worker thread drains and settles
void runSettlementWorker() {
    while (running) {
        PaymentEvent event = pipeline.consume();
        settlementService.apply(event);
    }
}</pre>` },
    { title: `Why bounded matters`, body: `<p>An <b>unbounded</b> queue removes backpressure: a producer burst is absorbed silently, latency grows as the backlog deepens, and a sustained overload ends in an out-of-memory crash rather than a graceful slowdown. A <b>bounded</b> queue converts overload into an explicit signal — producers block (or the enqueue is rejected) — which propagates pressure back up the pipeline where it can be handled: shed load, scale out consumers, or return "busy" to the caller.</p>` },
    { title: `Correctness and shutdown`, body: `<p>Watch for the <b>lost-wakeup</b> bug (signalling before the waiter has registered) — condition-variable predicates re-checked in a loop avoid it. For shutdown, use a <b>poison pill</b> (a sentinel item that tells a consumer to exit) or an explicit "closed" flag so consumers drain the remaining items and then stop, rather than blocking forever on an empty queue. In distributed form this same pattern becomes a message broker: the topic is the bounded buffer, and consumer-lag metrics are the queue depth you monitor.</p>
<pre>public record PaymentEvent(String paymentId, Money amount, EventType type) {}
public enum EventType { CAPTURED, REFUNDED, POISON }

// Graceful shutdown: poison pill per consumer
public void shutdown(List&lt;Thread&gt; consumers) throws InterruptedException {
    for (int i = 0; i &lt; consumers.size(); i++) {
        buffer.put(new PaymentEvent("shutdown", Money.ZERO, EventType.POISON));
    }
    for (Thread t : consumers) t.join();
}

// Consumer loop
while (true) {
    PaymentEvent event = buffer.take();
    if (event.type() == EventType.POISON) break;
    ledgerService.record(event);
}</pre>` },
  ],
  figures: [
    { id: "pc", svg: PC_SVG, caption: "A fixed-capacity buffer decouples producers from consumers; a full buffer blocks producers, an empty one blocks consumers." },
  ],
  related: ["thread-pool", "reactive-streams", "readers-writers", "message-queue"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("producer-consumer", stage, panel, stageEl);
}
