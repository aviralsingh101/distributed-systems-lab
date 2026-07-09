// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "duplicate-events", title: "Duplicate Events", category: "ordering" };

export const content = {
  oneliner: `At-least-once delivery means the same event can arrive more than once — and a non-idempotent consumer double-applies it, charging a card twice.`,
  archetype: "failure",
  sections: [
    { title: `Symptom`, body: `<p>An effect happens twice from a single logical cause. A customer is <b>charged twice</b> for one order; an inventory count drops by two when one item sold; a "welcome" email is sent three times; a ledger shows two identical debits seconds apart with the same amount and merchant. Nothing in the business logic asked for a second action — the same event was simply delivered and processed more than once.</p>` },
    { title: `Root cause`, body: `<p>Duplicates are not a bug you can eliminate; they are an intrinsic property of reliable messaging. Almost every broker and RPC layer offers <b>at-least-once</b> delivery, and duplicates are the price of that guarantee:</p>
<ul>
<li><b>Producer retries.</b> A producer sends a message, the broker persists it, but the acknowledgment is lost to a network blip. The producer times out and resends — the broker now holds two copies.</li>
<li><b>Consumer redelivery.</b> A consumer processes a message but crashes (or is slow) before committing its offset / ack. The broker, seeing no ack, redelivers. The side effect ran once, but it runs again on redelivery.</li>
<li><b>Rebalancing.</b> When a consumer group rebalances, partitions move between consumers and messages after the last committed offset are reprocessed.</li>
</ul>
<p>Because "the broker delivered it" and "the consumer finished its side effects and durably recorded that fact" cannot be made a single atomic step across the network, the safe default is to deliver again on any doubt — producing duplicates.</p>` },
    { title: `Fixes`, body: `<p>You cannot stop duplicates from arriving, so make processing a duplicate <b>harmless</b> — an idempotent consumer:</p>
<ul>
<li><b>Deduplicate on a stable id.</b> Give every event a unique id at production time (not at delivery). The consumer records processed ids and skips any it has already seen. The dedup record and the side effect must commit in the <em>same</em> transaction, or a crash between them reintroduces the duplicate.</li>
<li><b>Use a natural idempotency key.</b> For a payment, key the charge by <code>(order_id, attempt)</code> or a client idempotency key; a repeat with the same key returns the original result instead of charging again.</li>
<li><b>Make the write conditional / idempotent.</b> <code>INSERT ... ON CONFLICT DO NOTHING</code>, a unique constraint on the business key, or a state transition that is a no-op if already applied.</li>
<li><b>Prefer commutative, absolute updates</b> (set balance to X) over relative ones (add to balance) where the domain allows it.</li>
</ul>
<pre>// Duplicate event inbox — dedup before side effect
@Entity
@Table(name = "processed_events",
       uniqueConstraints = @UniqueConstraint(columnNames = "event_id"))
public class ProcessedEvent {
    @Id @GeneratedValue private Long id;
    @Column(name = "event_id", nullable = false) private String eventId;
    private Instant processedAt;
}

@Transactional
public class ChargeEventConsumer {
    private final ProcessedEventRepository inbox;
    private final LedgerService ledger;

    public void onChargeEvent(ChargeEvent evt) {
        try {
            inbox.save(new ProcessedEvent(evt.eventId(), Instant.now()));
        } catch (DataIntegrityViolationException dup) {
            return; // already charged — harmless duplicate
        }
        ledger.credit(evt.walletId(), evt.amount(), evt.paymentId());
    }
}</pre>` },
    { title: `Prevention`, body: `<p>Assume at-least-once everywhere and design consumers to be idempotent by default rather than bolting on dedup after an incident. Attach a unique <code>event_id</code> at the source and thread it through the whole pipeline so any stage can dedup. Store processed keys with a TTL long enough to outlast the broker's maximum redelivery window. Add a metric for duplicate-hit rate on the dedup table — a sudden rise flags a misbehaving producer or a rebalancing storm. The mental model to internalize: <b>exactly-once processing = at-least-once delivery + idempotent consumer</b>; there is no exactly-once delivery to rely on.</p>` },
  ],
  related: ["deduplication", "idempotency-key", "exactly-once", "out-of-order", "missing-events", "consumer-rebalancing"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("duplicate-events", stage, panel, stageEl);
}
