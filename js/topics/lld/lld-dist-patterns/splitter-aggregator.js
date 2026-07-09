// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const SA_SVG = `<svg viewBox="0 0 560 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Splitter and aggregator around parallel processing"><defs><marker id="fig-splitter-aggregator-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="12" y="60" width="86" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="55" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Order</text><text x="55" y="92" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">3 items</text><rect x="130" y="60" width="80" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="170" y="84" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Splitter</text><rect x="250" y="18" width="90" height="30" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.2"/><text x="295" y="38" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">item A</text><rect x="250" y="65" width="90" height="30" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.2"/><text x="295" y="85" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">item B</text><rect x="250" y="112" width="90" height="30" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.2"/><text x="295" y="132" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">item C</text><rect x="380" y="60" width="86" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="423" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Aggregator</text><text x="423" y="92" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">correlate</text><rect x="486" y="60" width="66" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="519" y="84" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">result</text><line x1="98" y1="80" x2="128" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="210" y1="74" x2="248" y2="34" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="210" y1="80" x2="248" y2="80" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="210" y1="86" x2="248" y2="126" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="340" y1="34" x2="378" y2="74" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="340" y1="80" x2="378" y2="80" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="340" y1="126" x2="378" y2="86" stroke="#3ddc97" stroke-width="1.2" marker-end="url(#fig-splitter-aggregator-arr)"/><line x1="466" y1="80" x2="484" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-splitter-aggregator-arr)"/></svg>`;

const topic = makeTopic({
  id: "splitter-aggregator",
  title: "Splitter / Aggregator",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Break a composite message into parts to process in parallel, then recombine the correlated results back into one.",
  sections: [
    {
      title: "The problem: one message, many independent parts",
      body: `<p>A single message often contains a batch of items that can be handled independently — an order with several line items, a bulk payout with many recipients, a document with many pages. Processing them one by one is slow, and downstream steps may want each item as its own message. Later you usually need a single answer back: "did the whole order succeed?".</p>
<p>Two complementary Enterprise Integration Patterns cover this: the <b>splitter</b> fans one message out into many, and the <b>aggregator</b> fans many back into one.</p>`,
    },
    {
      title: "Structure — the splitter",
      figureAfter: "sa-flow",
      body: `<p>The <b>splitter</b> takes a composite message and emits one message per element. Its critical job is to stamp each child with correlation metadata so the parts can be reunited later:</p>
<ul>
<li>A <b>correlation id</b> tying every child back to the parent (the order id).</li>
<li>Sequence info: this is item <em>k of N</em>, so the aggregator knows how many to expect.</li>
</ul>
<p>The children then flow independently and can be processed in parallel by <b>competing consumers</b>.</p>`,
    },
    {
      title: "Structure — the aggregator",
      body: `<p>The <b>aggregator</b> is a stateful endpoint that collects related messages and publishes a single combined result. It needs three policies:</p>
<ul>
<li><b>Correlation:</b> group incoming messages by correlation id.</li>
<li><b>Completeness condition:</b> when is a group done? All N received, or a quorum, or the first success.</li>
<li><b>Aggregation + timeout:</b> how to combine the parts, and what to do if some never arrive (emit partial, or fail after a deadline).</li>
</ul>
<p>Because it holds state between messages, the aggregator must persist in-flight groups so a restart does not lose partially collected results.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>Splitter receives the order, emits one message per line item tagged with <code>{ orderId, index, total }</code>.</li>
<li>Workers process items in parallel (reserve stock, price each).</li>
<li>Aggregator buffers results by <code>orderId</code> until all <code>total</code> arrive or the timeout fires.</li>
<li>It composes the final response (order confirmed / partially failed) and forwards it.</li>
</ol>
<pre>// --- Splitter: one order message becomes N line-item tasks ---
@Service
public class OrderSplitter {
    private final KafkaTemplate&lt;String, String&gt; kafka;

    public void split(OrderPlacedEvent order) {
        int total = order.lineItems().size();
        for (int i = 0; i &lt; total; i++) {
            LineItemTask task = new LineItemTask(
                order.orderId(), i, total, order.lineItems().get(i));
            kafka.send("order.line-items", order.orderId().toString(), Json.write(task));
        }
    }
}

public record LineItemTask(UUID orderId, int index, int total, LineItem item) {}</pre>
<pre>// --- Aggregator: buffer by orderId until all parts arrive ---
@Service
public class OrderAggregator {
    private final AggregationRepository buffer;

    @KafkaListener(topics = "order.line-items.results")
    @Transactional
    public void collect(LineItemResult result) {
        AggregationState state = buffer.loadOrCreate(result.orderId(), result.total());
        state.add(result);
        if (state.isComplete()) {
            kafka.send("order.confirmed", result.orderId().toString(),
                Json.write(state.toConfirmation()));
            buffer.delete(result.orderId());
        }
    }
}</pre>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> parallelism cuts latency for batch work; each part can be routed and scaled independently; naturally models scatter-gather request/response.</p>
<p><b>Cons:</b> the aggregator is stateful and must handle the hard cases — lost parts, duplicates (idempotent collection), late arrivals, and timeouts; correlation and completeness logic add complexity; a slow item delays the whole group. <b>Use when</b> a message decomposes into independently-processable parts that must be recombined; <b>avoid</b> when items are truly independent with no combined result needed (just split), or when the batch is small enough to process inline.</p>`,
    },
  ],
  figures: [
    { id: "sa-flow", svg: SA_SVG, caption: "Splitter/Aggregator: a composite message is split into correlated parts processed in parallel, then the aggregator recombines them into one result." },
  ],
  related: ["message-router", "competing-consumers", "content-enricher", "scatter-gather", "process-manager"],
});

export const meta = topic.meta;
export const content = topic.content;
