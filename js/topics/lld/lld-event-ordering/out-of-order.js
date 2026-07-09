// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "out-of-order", title: "Out-of-order Events", category: "ordering" };

const OOO_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Events produced in order but consumed out of order">
  <defs><marker id="fig-out-of-order-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="60" y="30" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Produced</text>
  <rect x="120" y="16" width="120" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="180" y="35" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">1. Created</text>
  <rect x="260" y="16" width="120" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="320" y="35" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">2. Paid</text>
  <rect x="400" y="16" width="120" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="460" y="35" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">3. Shipped</text>
  <line x1="360" y1="70" x2="360" y2="95" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="360" y="88" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">partitions + retries reshuffle</text>
  <text x="60" y="130" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Consumed</text>
  <rect x="120" y="116" width="120" height="30" rx="5" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.4"/><text x="180" y="135" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">3. Shipped</text>
  <rect x="260" y="116" width="120" height="30" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="320" y="135" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">1. Created</text>
  <rect x="400" y="116" width="120" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/><text x="460" y="135" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">2. Paid</text>
  <text x="600" y="130" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">Shipped before Paid?!</text>
</svg>`;

export const content = {
  oneliner: `A consumer receives events in a different order than they logically happened — Shipped before Paid — and derives wrong state from the scrambled sequence.`,
  archetype: "failure",
  figures: [
    { id: "ooo-flow", svg: OOO_SVG, caption: "The producer emits Created → Paid → Shipped, but partitioning, parallel consumers, and retries let the consumer observe them in a different order." },
  ],
  sections: [
    { title: `Symptom`, body: `<p>A downstream service reacts to an event that logically should not have arrived yet. An order shows <b>Shipped</b> before it shows <b>Paid</b>; a projection applies an <code>updated</code> event for a row it has not seen <code>created</code>; a refund is processed before the charge it refunds. State machines throw "illegal transition" errors, materialized views hold impossible combinations, and support tickets describe events happening "in the wrong order." The producer swears it emitted them correctly — and it did.</p>` },
    { title: `Root cause`, body: `<p>Message systems only preserve order within a narrow scope, and almost everything about scaling breaks that scope:</p>
<ul>
<li><b>Partitioning.</b> Kafka guarantees order only <em>within a partition</em>. If events for one order are hashed to different partitions (or the producer uses round-robin), their relative order across partitions is undefined.</li>
<li><b>Parallel consumers.</b> Even from one partition, a consumer that dispatches messages to a thread pool processes them concurrently, so completion order is not arrival order.</li>
<li><b>Retries and redelivery.</b> A message that fails and is retried lands <em>after</em> messages that came behind it. At-least-once delivery reorders as a side effect.</li>
<li><b>Multiple producers / sources.</b> Two services writing to the same stream have no shared clock, so "which happened first" is genuinely ambiguous (see clock skew).</li>
</ul>
<p>The root issue is that "order events were produced" and "order events are observed" are different things across a network, and wall-clock timestamps cannot reliably reconstruct the first from the second.</p>` },
    { title: `Fixes`, body: `<p>Do not assume arrival order equals logical order. Instead make ordering explicit and let the consumer reconstruct or tolerate it:</p>
<ul>
<li><b>Partition by the ordering key.</b> Route all events for one entity (order id, wallet id) to the same partition so their relative order is preserved where it matters. This is the simplest, most common fix.</li>
<li><b>Carry a per-entity sequence number or version</b> on each event. The consumer applies an event only if its version is the expected next one; higher versions are buffered, lower/duplicate versions are dropped.</li>
<li><b>Make handlers order-insensitive.</b> Design state so a later event can be applied even if an earlier one is missing — e.g. store the max known status rather than blindly transitioning, or use last-writer-wins on a version field.</li>
<li><b>Use logical clocks</b> (Lamport for a total order, vector clocks to detect true concurrency) when events originate from several nodes and wall-clock ordering is meaningless.</li>
</ul>
<pre>// Out-of-order handler: per-entity sequence + reorder buffer
public class OrderProjectionHandler {
    private final Map&lt;String, Long&gt; lastApplied = new ConcurrentHashMap&lt;&gt;();
    private final Map&lt;String, PriorityQueue&lt;OrderEvent&gt;&gt; buffer
        = new ConcurrentHashMap&lt;&gt;();

    public void onEvent(OrderEvent evt) {
        String orderId = evt.orderId();
        long expected = lastApplied.getOrDefault(orderId, 0L) + 1;

        if (evt.sequence() == expected) {
            applyAndDrain(orderId, evt);
        } else if (evt.sequence() &gt; expected) {
            buffer.computeIfAbsent(orderId, k -&gt;
                new PriorityQueue&lt;&gt;(Comparator.comparingLong(OrderEvent::sequence)))
                .add(evt);
        }
        // sequence &lt; expected → duplicate or stale, drop
    }

    private void applyAndDrain(String orderId, OrderEvent evt) {
        apply(evt); // Created → Paid → Shipped in order
        lastApplied.put(orderId, evt.sequence());
        PriorityQueue&lt;OrderEvent&gt; q = buffer.get(orderId);
        while (q != null &amp;&amp; !q.isEmpty()
               &amp;&amp; q.peek().sequence() == lastApplied.get(orderId) + 1) {
            applyAndDrain(orderId, q.poll());
        }
    }

    private void apply(OrderEvent evt) {
        switch (evt.type()) {
            case CREATED -&gt; repo.insert(evt.orderId());
            case PAID    -&gt; repo.markPaid(evt.orderId());
            case SHIPPED -&gt; repo.markShipped(evt.orderId());
        }
    }
}</pre>` },
    { title: `Prevention`, body: `<p>Design for reordering from day one: treat every consumer as if messages can arrive in any order, and version your events. In a payment pipeline, tag each lifecycle event with an <code>order_id</code> partition key and a monotonically increasing <code>version</code>; the projection ignores anything it has already surpassed and buffers anything from the future. Add a monitor that alerts when a consumer sees a version gap or an out-of-sequence transition, so silent reordering surfaces before it corrupts a report. Prefer idempotent, commutative updates where you can — they make ordering a non-issue rather than a bug to chase.</p>` },
  ],
  related: ["event-reordering", "duplicate-events", "missing-events", "lamport-clock", "vector-clock", "idempotency-key"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("out-of-order", stage, panel, stageEl);
}
