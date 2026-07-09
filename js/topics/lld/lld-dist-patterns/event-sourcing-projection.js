// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const ES_SVG = `<svg viewBox="0 0 580 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Event sourcing projection"><defs><marker id="fig-event-sourcing-projection-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="50" width="150" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="89" y="66" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Event log (append-only)</text><text x="89" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Opened&#183;Debited&#183;Credited</text><rect x="210" y="52" width="110" height="42" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="265" y="69" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Projector</text><text x="265" y="83" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">fold events</text><rect x="366" y="20" width="120" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="426" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">balance view</text><rect x="366" y="90" width="120" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="426" y="112" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">statement view</text><line x1="164" y1="73" x2="208" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-sourcing-projection-arr)"/><line x1="320" y1="66" x2="364" y2="42" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-sourcing-projection-arr)"/><line x1="320" y1="80" x2="364" y2="104" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-sourcing-projection-arr)"/><text x="510" y="73" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">rebuildable</text></svg>`;

const topic = makeTopic({
  id: "event-sourcing-projection",
  title: "Event Sourcing Projection",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Store state as an append-only log of events; derive every queryable view by folding those events into a projection.",
  sections: [
    {
      title: "State as events, not rows",
      body: `<p>In classic CRUD you store <em>current state</em> — a Wallet row with <code>balance = 40</code>, overwritten on every change, so history is lost. In <b>event sourcing</b> you instead store the <em>facts that happened</em> as an ordered, immutable log: <code>WalletOpened</code>, <code>Deposited(100)</code>, <code>PaymentDebited(60)</code>. The current balance (40) is not stored; it is <b>computed</b> by replaying the events.</p>
<p>A <b>projection</b> is the derived, query-optimized view built from that log. This page is about the projection half: how you turn an event stream into readable state.</p>`,
    },
    {
      title: "Structure — the fold",
      figureAfter: "es-flow",
      body: `<p>A projection is a left-fold over events. It starts from an initial state and applies one <em>apply</em> function per event type:</p>
<p><code>apply(state, PaymentDebited) =&gt; { ...state, balance: state.balance - e.amount }</code></p>
<p>One event log can feed <em>many</em> projections, each shaped for a different reader: a <code>balance</code> table, a flattened <code>statement</code> view, a fraud-analytics aggregate. This is exactly the read side of <b>CQRS</b> — the event log is the write model, projections are the read models.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>A command validates against the current (rebuilt) aggregate state and appends new events to the log in one atomic write.</li>
<li>Each projector tracks its position (the last event offset/sequence it processed).</li>
<li>The projector reads new events in order, applies its fold, and upserts its read table, then advances its stored position.</li>
<li>Queries hit the projection tables, never the raw log.</li>
</ol>
<p>Because a projector is a pure function of the log plus its position, you can <b>rebuild it from scratch</b>: drop the read table, reset the position to zero, and replay. This is the superpower of event sourcing — you can add a brand-new view over historical data, or fix a projection bug and reprocess.</p>
<pre>// --- Append-only event store ---
@Entity
@Table(name = "wallet_events")
public class WalletEvent {
    @Id private UUID eventId;
    private UUID walletId;
    private long sequence;          // monotonic per aggregate
    private String eventType;
    private String payload;
}

public interface WalletEventRepository extends JpaRepository&lt;WalletEvent, UUID&gt; {
    List&lt;WalletEvent&gt; findByWalletIdOrderBySequenceAsc(UUID walletId);
}</pre>
<pre>// --- Projector: fold events into balance view ---
@Service
public class WalletBalanceProjector {
    @KafkaListener(topics = "wallet.events", groupId = "balance-projection")
    @Transactional
    public void apply(WalletEventRecord record) {
        inbox.dedup(record.eventId());
        WalletBalanceView view = balanceRepo.findById(record.walletId())
            .orElse(new WalletBalanceView(record.walletId()));
        view = switch (record.eventType()) {
            case "WalletOpened" -&gt; view.withBalance(0);
            case "PaymentDebited" -&gt; view.withBalance(view.balance() - record.amount());
            case "DepositReceived" -&gt; view.withBalance(view.balance() + record.amount());
            default -&gt; view;
        };
        view.setLastSequence(record.sequence());
        balanceRepo.save(view);
    }
}</pre>`,
    },
    {
      title: "Getting projections right",
      body: `<p>Projectors must apply events in order and be <b>idempotent</b> (replays and at-least-once delivery re-send events), so key upserts on the aggregate id and guard with the event sequence. Rebuilding a huge log is slow, so long-lived aggregates use <b>snapshots</b>: periodically persist the folded state at offset N so replay starts from the snapshot instead of event zero.</p>
<p>Schema evolution needs care: old events are immutable, so you must handle multiple event versions in the apply functions (upcasting) forever.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> complete audit trail and time-travel by construction; new read views added anytime by replay; natural fit for domains where history is the truth (ledgers, banking); decouples write shape from read shapes.</p>
<p><b>Cons:</b> significant complexity — event versioning, snapshots, rebuild tooling, eventual consistency of projections; no trivial ad-hoc queries against current state; deletes/GDPR are hard against an immutable log. <b>Use when</b> auditability, temporal queries, or multiple divergent read models justify it; <b>avoid</b> for simple CRUD where a table and an audit column suffice.</p>`,
    },
  ],
  figures: [
    { id: "es-flow", svg: ES_SVG, caption: "Event sourcing: an append-only log of events is folded by projectors into multiple read views, each rebuildable by replaying the log." },
  ],
  related: ["cqrs-read-write-models", "cdc-relay", "transactional-outbox", "aggregate-root", "domain-vs-integration-events"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("event-sourcing-projection", stage, panel, stageEl);
}
