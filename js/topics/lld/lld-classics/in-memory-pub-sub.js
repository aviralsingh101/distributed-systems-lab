// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const FANOUT_SVG = `<svg viewBox="0 0 620 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pub-sub topic fan-out">
  <defs><marker id="fig-in-memory-pub-sub-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="80" width="120" height="46" rx="8" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="80" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Publisher</text>
  <text x="80" y="116" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">publish(msg)</text>
  <rect x="230" y="70" width="140" height="66" rx="8" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/>
  <text x="300" y="94" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Topic "payments"</text>
  <text x="300" y="112" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">subscriber list</text>
  <rect x="470" y="20" width="130" height="40" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="535" y="45" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Ledger sub</text>
  <rect x="470" y="80" width="130" height="40" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="535" y="105" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Email sub</text>
  <rect x="470" y="140" width="130" height="40" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="535" y="165" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Analytics sub</text>
  <line x1="140" y1="103" x2="228" y2="103" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-in-memory-pub-sub-arr)"/>
  <line x1="370" y1="95" x2="468" y2="45" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-in-memory-pub-sub-arr)"/>
  <line x1="370" y1="103" x2="468" y2="100" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-in-memory-pub-sub-arr)"/>
  <line x1="370" y1="112" x2="468" y2="158" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-in-memory-pub-sub-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "in-memory-pub-sub",
  title: "In-Memory Pub-Sub",
  category: "lld-classics",
  track: "lld",
  tier: "essential",
  archetype: "classic",
  oneliner: `A single-process message bus: publishers post to named topics and every subscriber to that topic receives a copy — decoupling producers from consumers.`,
  figures: [
    { id: "pubsub-fanout", svg: FANOUT_SVG, caption: "A publish to a topic fans out to every current subscriber; publishers never reference subscribers directly." },
  ],
  sections: [
    { title: `Requirements`, body: `<p>Build an in-process publish/subscribe bus: <code>subscribe(topic, handler)</code>, <code>unsubscribe(topic, handler)</code>, and <code>publish(topic, message)</code> that delivers the message to every current subscriber of that topic. The point of the pattern is <b>decoupling</b> — a publisher knows the topic name, never the subscribers, so consumers can be added or removed without touching producer code. Clarify the delivery contract: synchronous or asynchronous dispatch? at-least-once or best-effort? ordered per topic? bounded buffering when a subscriber is slow? These choices define the design.</p>` },
    { title: `The class model`, figureAfter: "pubsub-fanout", body: `<p>The core is a <code>ConcurrentHashMap</code> from topic name to a set of subscribers, plus a small delivery mechanism. This is the <b>Observer</b> pattern scaled to named channels.</p>
<pre>@FunctionalInterface
public interface Subscriber&lt;T&gt; {
    void onMessage(T message);
}

public final class Topic&lt;T&gt; {
    private final String name;
    private final CopyOnWriteArrayList&lt;Subscriber&lt;T&gt;&gt; subscribers = new CopyOnWriteArrayList&lt;&gt;();

    public Topic(String name) { this.name = name; }

    public void subscribe(Subscriber&lt;T&gt; subscriber) {
        subscribers.addIfAbsent(subscriber);
    }

    public boolean unsubscribe(Subscriber&lt;T&gt; subscriber) {
        return subscribers.remove(subscriber);
    }

    public void publish(T message) {
        for (Subscriber&lt;T&gt; subscriber : subscribers) {
            try {
                subscriber.onMessage(message);
            } catch (Exception e) {
                // isolate failures — one bad handler must not abort fan-out
            }
        }
    }

    public int subscriberCount() { return subscribers.size(); }
    public String name() { return name; }
}</pre>
<p>A <code>CopyOnWriteArrayList</code> avoids <code>ConcurrentModificationException</code> when a handler subscribes or unsubscribes during delivery.</p>` },
    { title: `Broker with ConcurrentHashMap`, body: `<p>The broker owns topic lifecycle and routes publish calls to the right subscriber list:</p>
<pre>public final class InMemoryBroker {
    private final ConcurrentHashMap&lt;String, Topic&lt;?&gt;&gt; topics = new ConcurrentHashMap&lt;&gt;();

    public &lt;T&gt; void subscribe(String topicName, Subscriber&lt;T&gt; subscriber) {
        Topic&lt;T&gt; topic = getOrCreateTopic(topicName);
        topic.subscribe(subscriber);
    }

    public &lt;T&gt; boolean unsubscribe(String topicName, Subscriber&lt;T&gt; subscriber) {
        Topic&lt;T&gt; topic = getTopic(topicName);
        return topic != null &amp;&amp; topic.unsubscribe(subscriber);
    }

    @SuppressWarnings("unchecked")
    public &lt;T&gt; void publish(String topicName, T message) {
        Topic&lt;T&gt; topic = getTopic(topicName);
        if (topic != null) {
            topic.publish(message);
        }
    }

    @SuppressWarnings("unchecked")
    private &lt;T&gt; Topic&lt;T&gt; getOrCreateTopic(String name) {
        return (Topic&lt;T&gt;) topics.computeIfAbsent(name, Topic::new);
    }

    @SuppressWarnings("unchecked")
    private &lt;T&gt; Topic&lt;T&gt; getTopic(String name) {
        return (Topic&lt;T&gt;) topics.get(name);
    }
}</pre>
<pre>// Payment domain usage — decouple capture from side effects
public record PaymentCapturedEvent(
    String paymentId, String walletId, long amountCents, String currency) {}

InMemoryBroker broker = new InMemoryBroker();

broker.subscribe("payments.captured", (PaymentCapturedEvent evt) -&gt;
    ledgerService.recordDebit(evt.walletId(), evt.amountCents()));

broker.subscribe("payments.captured", (PaymentCapturedEvent evt) -&gt;
    emailService.sendReceipt(evt.paymentId()));

broker.publish("payments.captured",
    new PaymentCapturedEvent("pay-42", "wallet-7", 2500, "USD"));</pre>` },
    { title: `Synchronous vs asynchronous delivery`, body: `<p>The biggest design fork is <em>who runs the subscriber</em>. <b>Synchronous</b> delivery calls each handler on the publisher's thread inside <code>publish()</code>: simple and ordered, but one slow or throwing subscriber blocks the publisher and every later subscriber. <b>Asynchronous</b> delivery hands each subscriber its own <b>bounded queue</b> drained by a worker thread (or a thread pool), so a slow consumer cannot stall the publisher — at the cost of ordering guarantees and the need to decide what happens when a queue fills (block the publisher, drop oldest, or reject).</p>
<pre>public final class AsyncTopic&lt;T&gt; extends Topic&lt;T&gt; {
    private final ExecutorService executor;

    public AsyncTopic(String name, ExecutorService executor) {
        super(name);
        this.executor = executor;
    }

    @Override
    public void publish(T message) {
        for (Subscriber&lt;T&gt; subscriber : subscribers) {
            executor.submit(() -&gt; {
                try { subscriber.onMessage(message); }
                catch (Exception ignored) { }
            });
        }
    }
}</pre>
<p>Always isolate subscriber failures: wrap each <code>onMessage</code> in try/catch so one handler's exception does not abort fan-out to the rest. Be clear on the limits versus a real broker: this bus is <em>in-memory and single-process</em>, so messages are lost on crash, there is no durability, no cross-process delivery, and no consumer offsets. It is ideal for decoupling modules inside one service — but for durability across restarts you graduate to a persistent log like Kafka, or pair it with the transactional-outbox pattern.</p>` },
  ],
  related: ["pub-sub-pattern", "observer", "lru-cache"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("in-memory-pub-sub", stage, panel, stageEl);
}
