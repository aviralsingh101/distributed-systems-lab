// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const RS_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reactive streams backpressure">
  <defs><marker id="fig-reactive-streams-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="40" y="60" width="150" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="115" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Publisher</text>
  <text x="115" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">source of items</text>
  <rect x="520" y="60" width="150" height="50" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="595" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Subscriber</text>
  <text x="595" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">bounded capacity</text>
  <line x1="190" y1="75" x2="518" y2="75" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-reactive-streams-arr)"/>
  <text x="354" y="68" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">onNext(item) — at most N in flight</text>
  <line x1="518" y1="100" x2="192" y2="100" stroke="#7c5cff" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#fig-reactive-streams-arr)"/>
  <text x="354" y="120" text-anchor="middle" fill="#7c5cff" font-size="10" font-family="system-ui">request(n) — demand signal (pull)</text>
  <text x="354" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">consumer controls the rate — no unbounded buffering</text>
</svg>`;

const topic = makeTopic({
  id: "reactive-streams",
  title: "Reactive Streams",
  category: "lld-concurrency",
  track: "lld",
  tier: "advanced",
  archetype: "concept",
  oneliner: `An async data-flow protocol where the consumer signals demand, so a fast producer can never overwhelm a slow consumer.`,
  sections: [
    { title: `The problem: fast producer, slow consumer`, body: `<p>Streaming data asynchronously is easy until the producer is faster than the consumer. A pure <b>push</b> model (producer calls <code>onNext</code> whenever it likes) forces the consumer to buffer the overflow — and an unbounded buffer eventually exhausts memory. A pure <b>pull</b> model wastes time polling. <b>Reactive Streams</b> is a small standard protocol that solves this with demand-driven flow control called <b>backpressure</b>.</p>` },
    { title: `How the protocol works`, figureAfter: "rs", body: `<p>The contract has four interfaces. A <b>Publisher</b> produces items. A <b>Subscriber</b> consumes them via callbacks <code>onSubscribe</code>, <code>onNext</code>, <code>onError</code>, <code>onComplete</code>. A <b>Subscription</b> connects them and carries the crucial method <code>request(n)</code>. A <b>Processor</b> is both.</p>
<p>The flow is <b>push with pull-based demand</b>: the subscriber calls <code>request(n)</code> to say "I can handle n more items"; the publisher may then emit <em>at most</em> n <code>onNext</code> calls before waiting for more demand. The consumer, not the producer, sets the pace. Items in flight are bounded by outstanding demand, so no component is forced to buffer without limit.</p>
<pre>// JDK Flow.Publisher: stream settled payments to a reconciliation subscriber
public final class SettledPaymentPublisher implements Flow.Publisher&lt;PaymentSettlement&gt; {
    private final List&lt;PaymentSettlement&gt; settlements;

    @Override
    public void subscribe(Flow.Subscriber&lt;? super PaymentSettlement&gt; subscriber) {
        subscriber.onSubscribe(new SettlementSubscription(settlements, subscriber));
    }
}

static class SettlementSubscription implements Flow.Subscription {
    private final Iterator&lt;PaymentSettlement&gt; source;
    private final Flow.Subscriber&lt;? super PaymentSettlement&gt; subscriber;
    private long demand = 0;
    private boolean done = false;

    @Override
    public synchronized void request(long n) {
        demand += n;
        while (demand &gt; 0 &amp;&amp; source.hasNext()) {
            subscriber.onNext(source.next());
            demand--;
        }
        if (!source.hasNext() &amp;&amp; !done) {
            done = true;
            subscriber.onComplete();
        }
    }

    @Override public void cancel() { done = true; }
}</pre>` },
    { title: `Backpressure strategies`, body: `<p>When a source is inherently faster than demand allows (sensor readings, a firehose topic), the pipeline needs a strategy for the excess:</p>
<ul>
<li><b>Buffer</b> — hold overflow up to a bound, then fail or block.</li>
<li><b>Drop / latest</b> — discard the oldest or keep only the most recent value (fine for gauges and live prices).</li>
<li><b>Throttle / sample / conflate</b> — reduce the rate by time or by merging.</li>
<li><b>Block the source</b> — only possible when the source itself is pull-based (e.g. reading a file or a database cursor).</li>
</ul>` },
    { title: `Where it fits`, body: `<p>Libraries such as Project Reactor, RxJava, and Akka Streams implement the standard; it also underlies the JDK <code>Flow</code> API. It shines for composable async pipelines — streaming query results, event processing, service-to-service streaming over HTTP/2 or gRPC — where operators (<code>map</code>, <code>filter</code>, <code>flatMap</code>, <code>buffer</code>) express the dataflow declaratively while backpressure is threaded through automatically. It is overkill for simple request/response work. Note the distinction between <b>hot</b> sources (emit regardless of subscribers, e.g. live events) and <b>cold</b> sources (produce per-subscription, e.g. a database read) — hot sources need an explicit backpressure strategy because they cannot simply slow down.</p>
<pre>// Reactor pipeline: charge events → filter → batch → ledger write
Flux.from(settledPaymentPublisher)
    .filter(s -&gt; s.amount().currency().equals("USD"))
    .bufferTimeout(100, Duration.ofSeconds(1))  // backpressure via buffer bound
    .flatMap(batch -&gt; ledgerService.recordBatch(batch), 4) // max 4 in-flight batches
    .doOnError(ex -&gt; metrics.increment("ledger.write.failures"))
    .subscribe();

public record PaymentSettlement(String paymentId, Money amount, Instant settledAt) {}</pre>` },
  ],
  figures: [
    { id: "rs", svg: RS_SVG, caption: "The subscriber signals demand with request(n); the publisher emits at most that many items, so the consumer sets the rate." },
  ],
  related: ["producer-consumer", "actor-model", "threads-vs-async"],
});

export const meta = topic.meta;
export const content = topic.content;
