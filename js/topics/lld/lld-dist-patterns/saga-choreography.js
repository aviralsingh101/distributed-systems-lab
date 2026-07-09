// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const CHO_SVG = `<svg viewBox="0 0 580 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Choreographed saga event chain"><defs><marker id="fig-saga-choreography-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="48" width="96" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="62" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order Svc</text><text x="62" y="79" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">OrderPlaced</text><rect x="176" y="48" width="96" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="224" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Wallet</text><text x="224" y="79" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">PaymentDone</text><rect x="338" y="48" width="96" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="386" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text><text x="386" y="79" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Posted</text><rect x="486" y="48" width="88" height="40" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="530" y="64" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shipping</text><line x1="110" y1="68" x2="174" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-choreography-arr)"/><line x1="272" y1="68" x2="336" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-choreography-arr)"/><line x1="434" y1="68" x2="484" y2="68" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-choreography-arr)"/><text x="290" y="24" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">each service reacts to the previous event — no central coordinator</text><text x="224" y="112" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">failure &#8594; emit compensating event backwards</text></svg>`;

const topic = makeTopic({
  id: "saga-choreography",
  title: "Saga Choreography",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "A distributed transaction with no coordinator: each service reacts to the previous step's event and publishes its own, compensating on failure.",
  sections: [
    {
      title: "The problem a saga solves",
      body: `<p>A business operation like "place order" spans several services — Order, Wallet, Ledger, Shipping — each with its own database. You cannot wrap them in one ACID transaction, and <b>2PC</b> would block and couple them. A <b>saga</b> replaces the single transaction with a sequence of <em>local</em> transactions, one per service. If a later step fails, earlier steps are undone by explicit <b>compensating transactions</b> rather than a rollback.</p>
<p>The saga guarantees <em>eventual</em> consistency and atomicity-by-compensation, not isolation: intermediate states are visible to the outside world.</p>`,
    },
    {
      title: "Structure — events drive the flow",
      figureAfter: "cho-flow",
      body: `<p>In the <b>choreography</b> variant there is no central brain. Each service knows only two things: which event it reacts to, and which event it publishes next. The workflow is implicit in the chain of subscriptions:</p>
<ul>
<li>Order Service commits the order and publishes <code>OrderPlaced</code>.</li>
<li>Wallet subscribes to <code>OrderPlaced</code>, debits the balance, publishes <code>PaymentCompleted</code>.</li>
<li>Ledger subscribes to <code>PaymentCompleted</code>, posts the entry, publishes <code>LedgerPosted</code>.</li>
<li>Shipping subscribes to <code>LedgerPosted</code> and dispatches.</li>
</ul>
<p>Each service publishes its event reliably via a <b>transactional outbox</b> so the local commit and the event are atomic.</p>`,
    },
    {
      title: "Compensation flow",
      body: `<p>When a step fails, the saga runs backward. Suppose Ledger rejects the entry: it publishes <code>LedgerFailed</code>. Wallet subscribes to that and runs its compensation — <code>refund</code> the debit — then publishes <code>PaymentReversed</code>, which Order reacts to by cancelling the order.</p>
<ol>
<li>Forward events move the transaction toward completion.</li>
<li>A failure event triggers each prior service's compensating handler, in reverse.</li>
<li>Compensations must be idempotent and must always eventually succeed (retry), because there is no "abort" — only "undo".</li>
</ol>
<pre>// --- Order Service: local commit + outbox event in one transaction ---
@Service
public class OrderService {
    @Transactional
    public Order placeOrder(PlaceOrderCommand cmd) {
        Order order = orderRepo.save(Order.create(cmd));
        outbox.save(OutboxEntity.of("OrderPlaced", order.getId(), order.toPayload()));
        return order;
    }
}</pre>
<pre>// --- Wallet: react to OrderPlaced, publish PaymentCompleted ---
@Service
public class WalletChoreographyHandler {
    @KafkaListener(topics = "order.events")
    @Transactional
    public void onOrderPlaced(OrderPlacedEvent event) {
        inbox.dedup(event.eventId()); // skip duplicates
        wallet.debit(event.walletId(), event.amount());
        outbox.save(OutboxEntity.of("PaymentCompleted", event.orderId(), event.paymentPayload()));
    }

    @KafkaListener(topics = "ledger.events")
    @Transactional
    public void onLedgerFailed(LedgerFailedEvent event) {
        wallet.refund(event.walletId(), event.amount()); // compensation
        outbox.save(OutboxEntity.of("PaymentReversed", event.orderId(), Map.of()));
    }
}</pre>`,
    },
    {
      title: "Choreography vs orchestration",
      body: `<p>Choreography is peer-to-peer: control is distributed across event subscriptions, so no single service is a bottleneck or a coupling point. The cost is that <b>the workflow exists nowhere explicitly</b> — to understand "what happens after payment" you must trace who subscribes to which event across many repos. Add a fifth step and you edit several services. Cyclic event dependencies and debugging "why did this saga stall" get hard as the graph grows.</p>
<p>The alternative, <b>saga orchestration</b>, centralizes the flow in one coordinator that issues commands. Prefer choreography for short (2–4 step) flows with few teams; prefer orchestration when the workflow is long, branchy, or needs a single place to observe and change.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> no single point of coordination or failure; services stay loosely coupled and independently deployable; naturally scales with the broker.</p>
<p><b>Cons:</b> the end-to-end workflow is implicit and hard to visualize; compensation logic is spread across services; risk of event cycles and hard-to-trace stalls; every participant must be idempotent and publish reliably (outbox). <b>Use when</b> the flow is small and stable and teams own their own steps; <b>avoid when</b> the workflow is complex enough that you need one authoritative, observable definition.</p>`,
    },
  ],
  figures: [
    { id: "cho-flow", svg: CHO_SVG, caption: "Choreographed saga: each service reacts to the previous event and emits the next; a failure sends compensating events back up the chain." },
  ],
  related: ["saga-orchestration", "saga", "transactional-outbox", "process-manager", "domain-vs-integration-events"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("saga-choreography", stage, panel, stageEl);
}
