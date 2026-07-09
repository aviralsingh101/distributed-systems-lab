// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "backpressure-pattern",
  title: "Backpressure Pattern",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `When a consumer cannot keep up, signal the producer to slow down instead of letting unbounded buffers grow until the system runs out of memory.`,
  sections: [
    { title: `The problem backpressure addresses`, body: `<p>In any producer→consumer pipeline where the producer is faster than the consumer, the difference has to go <em>somewhere</em>. Without a feedback mechanism it accumulates in a buffer — an in-memory queue, a socket buffer, a broker topic — that grows without bound until the process OOMs, latency explodes, or the broker rejects writes. <b>Backpressure</b> is the flow-control signal that pushes the "slow down" information back upstream so the fast producer matches the slow consumer's rate.</p>
<p>It is the difference between a system that degrades gracefully under overload and one that collapses.</p>` },
    { title: `Structure: how the signal propagates`, body: `<p>Backpressure works by making the producer's send <em>depend</em> on the consumer's readiness. Common mechanisms, from tightest to loosest coupling:</p>
<ul>
<li><b>Blocking / bounded buffers</b> — a fixed-size queue; when full, <code>put()</code> blocks the producer thread. TCP flow control does this at the socket level via the receive window.</li>
<li><b>Demand-based (reactive) streams</b> — the consumer explicitly requests N items (<code>request(n)</code>); the producer may only emit up to the outstanding demand. This is the model in Reactive Streams / Project Reactor.</li>
<li><b>Pull-based consumption</b> — the consumer fetches when ready (Kafka poll, work-queue workers), so it inherently cannot be overrun; lag shows up as backlog rather than crash.</li>
<li><b>Credit / token schemes</b> — the consumer grants the producer a budget of in-flight messages and replenishes it as it drains.</li>
</ul>` },
    { title: `Load shedding vs slowing down`, body: `<p>When you truly cannot slow the source (an external client, a market data feed), backpressure has to become <b>load shedding</b>: bound the buffer and, on overflow, apply a policy — drop oldest, drop newest, sample, or reject with <code>429 Too Many Requests</code> / <code>503</code> so the caller backs off. This is a deliberate, bounded loss instead of an uncontrolled crash.</p>
<p>Rate limiting and circuit breakers are the request-path cousins of backpressure: they protect a slow downstream by refusing or delaying inbound work rather than queueing it indefinitely.</p>` },
    { title: `Implementing and tuning it`, body: `<p>Practical rules: make every buffer <b>bounded</b> (an unbounded queue is a latent outage); decide overflow policy explicitly; and propagate the signal end-to-end — backpressure that stops at the first hop just relocates the unbounded buffer. In a chain, the slowest stage should throttle everything upstream of it.</p>
<p>Watch the trade-off: too little buffering wastes throughput and can't absorb bursts; too much hides the problem and inflates tail latency. Monitor queue depth, in-flight count, and the rate of shed/rejected work. Use backpressure whenever producers and consumers run at independent, variable speeds — which is nearly every async pipeline.</p>
<pre>// --- Bounded buffer: block producer when full (Reactor) ---
@Service
public class PaymentIngestService {
    private final Sinks.Many&lt;PaymentEvent&gt; sink = Sinks.many()
        .multicast()
        .onBackpressureBuffer(1000, BufferOverflowStrategy.ERROR);

    public Mono&lt;Void&gt; ingest(PaymentEvent event) {
        return Mono.fromRunnable(() -&gt; sink.tryEmitNext(event).orThrow());
    }

    @PostConstruct
    void subscribe() {
        sink.asFlux()
            .flatMap(this::process, 10) // max 10 concurrent
            .onErrorContinue((e, ev) -&gt; log.warn("dropped {}", ev, e))
            .subscribe();
    }
}</pre>
<pre>// --- Pull-based backpressure: consumer controls fetch rate ---
@KafkaListener(topics = "payment.events", groupId = "analytics")
public void consume(
        List&lt;ConsumerRecord&lt;String, String&gt;&gt; batch,
        Acknowledgment ack) {
    if (downstreamDb.isOverloaded()) {
        return; // do not ack — broker redelivers when ready
    }
    batch.forEach(this::project);
    ack.acknowledge();
}</pre>` },
  ],
  related: ["backpressure", "work-queue", "delayed-scheduled-messages", "point-to-point", "fire-and-forget"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("backpressure-pattern", stage, panel, stageEl);
}
