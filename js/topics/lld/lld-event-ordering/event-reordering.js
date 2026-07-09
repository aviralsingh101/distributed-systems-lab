// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "event-reordering", title: "Event Reordering", category: "ordering" };

export const content = {
  oneliner: `Variable network and queue delays let a later event overtake an earlier one in transit — the reordering mechanism behind most out-of-order bugs, and how buffering fixes it.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Two events for the same entity, sent in a clear order, are observed swapped. A stream processor computing a running balance applies a withdrawal before the deposit that funded it and briefly reports a negative balance; a state machine receives <code>closed</code> then <code>opened</code>; a "latest value" cache flickers back to an old value because a stale update arrived after a fresh one. The producer's logs prove the send order; the consumer's prove a different receive order. This is <b>event reordering</b> — the transport delivered them in the wrong sequence.</p>` },
    { title: `Root cause`, body: `<p>Where out-of-order is the observed <em>outcome</em>, reordering is the <em>mechanism</em>: independent messages take independent, variable-latency paths, so a later one can overtake an earlier one.</p>
<ul>
<li><b>Variable path latency.</b> Two messages routed over different partitions, brokers, connections, or network paths experience different delays; message B (sent second, fast path) arrives before A (sent first, slow path).</li>
<li><b>Retries.</b> A retransmitted message re-enters the pipeline behind messages that were originally after it.</li>
<li><b>Parallelism and batching.</b> Load balancers spread messages across workers; batch flushes and buffer drains complete in nondeterministic order.</li>
<li><b>Multiple sources without a shared clock.</b> Events from different producers have no ground-truth order to preserve in the first place (clock skew makes timestamps unreliable tiebreakers).</li>
</ul>
<p>TCP preserves order only within a single connection; the moment messages span partitions, connections, or hosts, that guarantee is gone.</p>` },
    { title: `Fixes`, body: `<p>Give messages an explicit order and let the consumer restore it, or reduce the scope in which order can be broken:</p>
<ul>
<li><b>Attach a sequence number or logical timestamp</b> per entity at the source. The consumer reorders by it instead of trusting arrival order.</li>
<li><b>Reorder buffer.</b> Hold arrived events in a small buffer keyed by sequence; release them in order once the expected next one is present. Bound the wait so a genuinely missing event does not stall forever.</li>
<li><b>Watermarks.</b> In stream processing, track a watermark ("no event older than T will still arrive") and only finalize a window once the watermark passes it, tolerating bounded lateness and dropping or side-outputting the rest.</li>
<li><b>Shrink the ordering domain.</b> Partition by entity key so all of one entity's events travel one ordered path (single Kafka partition), eliminating cross-path overtaking where it matters.</li>
<li><b>Make handlers order-tolerant</b> — last-writer-wins on a version, or commutative updates — so mild reordering needs no buffering at all.</li>
</ul>
<pre>// Reorder buffer with bounded wait for payment stream
public class PaymentReorderBuffer {
    private final Map&lt;String, TreeMap&lt;Long, PaymentEvent&gt;&gt; pending
        = new ConcurrentHashMap&lt;&gt;();
    private final Map&lt;String, Long&gt; nextSeq = new ConcurrentHashMap&lt;&gt;();
    private final Duration maxWait;

    public List&lt;PaymentEvent&gt; ingest(PaymentEvent evt) {
        String walletId = evt.walletId();
        long expected = nextSeq.getOrDefault(walletId, 1L);
        List&lt;PaymentEvent&gt; ready = new ArrayList&lt;&gt;();

        if (evt.sequence() &gt; expected) {
            pending.computeIfAbsent(walletId, k -&gt; new TreeMap&lt;&gt;())
                .put(evt.sequence(), evt);
            evictStale(walletId);
            return ready;
        }
        if (evt.sequence() &lt; expected) return ready; // stale

        ready.add(evt);
        nextSeq.put(walletId, expected + 1);
        drainInOrder(walletId, ready);
        return ready;
    }

    private void drainInOrder(String walletId, List&lt;PaymentEvent&gt; out) {
        TreeMap&lt;Long, PaymentEvent&gt; buf = pending.get(walletId);
        long seq = nextSeq.get(walletId);
        while (buf != null &amp;&amp; buf.containsKey(seq)) {
            out.add(buf.remove(seq));
            nextSeq.put(walletId, ++seq);
        }
    }
}</pre>` },
    { title: `Prevention`, body: `<p>Assume the transport can reorder anything not explicitly ordered, and encode order in the payload (per-entity monotonic version) rather than relying on delivery. Choose the cheapest sufficient tool: single-partition ordering for strict per-entity order, a bounded reorder buffer or watermark when you must merge streams. When events come from multiple nodes, use <b>Lamport clocks</b> for a deterministic total order or <b>vector clocks</b> to tell true concurrency from causal order. Add monitoring for sequence gaps and buffer wait times so reordering shows up as a metric, not a customer-reported anomaly.</p>` },
  ],
  related: ["out-of-order", "duplicate-events", "missing-events", "clock-skew", "lamport-clock", "watermarking"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("event-reordering", stage, panel, stageEl);
}
