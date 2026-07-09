// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "missing-events", title: "Missing Events", category: "ordering" };

export const content = {
  oneliner: `An event that was produced never gets processed — a dropped or skipped message leaves downstream state permanently, silently wrong.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>Downstream state is missing something that upstream is certain happened. A payment succeeded in the gateway but the ledger never recorded it; an order was placed but the fulfillment service never saw it; a search index is missing documents that exist in the database. Unlike duplicates, missing events are <b>silent</b> — nothing errors, a count is just quietly too low. They often surface days later during reconciliation, when totals do not match and no log line explains the gap.</p>` },
    { title: `Root cause`, body: `<p>Events go missing whenever a system commits progress before the work is durably done, or drops data under pressure:</p>
<ul>
<li><b>Premature offset commit.</b> A Kafka consumer commits its offset <em>before</em> finishing processing (or uses auto-commit on a timer). It crashes mid-work; on restart it resumes past the uncommitted messages, which are never reprocessed — they are gone from that consumer's view.</li>
<li><b>Lost on the produce side.</b> A service does its local write, then tries to publish an event, but crashes before the publish (dual-write problem). The state changed; the event was never emitted.</li>
<li><b>Retention expiry.</b> A consumer is down or lagging longer than the topic's retention; the broker deletes messages before they are read.</li>
<li><b>Dropped under overload.</b> Fire-and-forget UDP-style pipelines, full queues with drop-on-overflow, or a dead-letter path nobody drains.</li>
<li><b>Filtered by a bug.</b> An over-eager dedup or an incorrect filter discards legitimate events.</li>
</ul>` },
    { title: `Fixes`, body: `<p>The theme is: only mark an event done after its effect is durable, and be able to detect and replay gaps.</p>
<ul>
<li><b>Commit offsets after processing</b>, not before — at-least-once semantics. Combine with idempotent handlers so the resulting reprocessing is safe.</li>
<li><b>Use the transactional outbox</b> to fix the produce side: write the business change and an outbox row in one local transaction, then a relay reliably publishes it. The event can never be lost without the state change also rolling back.</li>
<li><b>Track sequence numbers per entity</b> so a consumer can <em>detect</em> a gap (it expected version 8, got 10) and trigger a fetch/replay of the missing ones.</li>
<li><b>Size retention</b> to comfortably exceed worst-case consumer downtime, and alert on consumer lag approaching the retention edge.</li>
</ul>
<pre>// Gap detection: expected version 8, received 10 → fetch missing
public class SequenceGapDetector {
    private final Map&lt;String, Long&gt; highWater = new ConcurrentHashMap&lt;&gt;();
    private final GapReplayService replay;

    public void onEvent(LedgerEvent evt) {
        String walletId = evt.walletId();
        long expected = highWater.getOrDefault(walletId, 0L) + 1;
        long seq = evt.sequence();

        if (seq &gt; expected) {
            // Gap: versions expected..seq-1 never arrived
            replay.requestReplay(walletId, expected, seq - 1);
            highWater.put(walletId, seq);
            apply(evt);
        } else if (seq == expected) {
            highWater.put(walletId, seq);
            apply(evt);
        }
        // seq &lt; expected → duplicate, skip
    }

    private void apply(LedgerEvent evt) {
        ledger.post(evt.walletId(), evt.amount(), evt.paymentId());
    }
}</pre>` },
    { title: `Prevention`, body: `<p>Make lost events detectable rather than trusting they never happen. Run periodic <b>reconciliation</b> that compares source-of-truth totals with downstream projections (e.g. sum of gateway captures vs. ledger credits) and alerts on drift — this is the backstop that catches whatever slips through. Monitor consumer lag, dead-letter depth, and per-entity version gaps. On the produce side, prefer the outbox or change-data-capture over dual writes so the event and the state share a fate. In a payment system, a missing charge event is worse than a duplicate: pair gap detection with an idempotent replay so recovery re-emits the event without double-charging.</p>` },
  ],
  related: ["out-of-order", "duplicate-events", "event-reordering", "dead-letter-queue", "idempotency-key", "exactly-once"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("missing-events", stage, panel, stageEl);
}
