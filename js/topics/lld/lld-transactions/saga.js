// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "saga", title: "Saga Pattern", category: "transactions" };

const FLOW_SVG = `<svg viewBox="0 0 660 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Saga forward steps and compensations">
  <defs><marker id="fig-saga-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3ddc97"/></marker>
  <marker id="fig-saga-carr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ff6b6b"/></marker></defs>
  <rect x="20" y="30" width="120" height="42" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="80" y="55" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">T1 reserve stock</text>
  <rect x="200" y="30" width="120" height="42" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="260" y="55" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">T2 charge wallet</text>
  <rect x="380" y="30" width="120" height="42" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.6"/>
  <text x="440" y="50" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">T3 ship</text>
  <text x="440" y="64" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">FAILS</text>
  <line x1="140" y1="51" x2="198" y2="51" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-saga-arr)"/>
  <line x1="320" y1="51" x2="378" y2="51" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-saga-arr)"/>
  <rect x="200" y="120" width="120" height="42" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="260" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C2 refund wallet</text>
  <rect x="20" y="120" width="120" height="42" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="80" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">C1 release stock</text>
  <line x1="420" y1="72" x2="320" y2="120" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-saga-carr)"/>
  <line x1="200" y1="141" x2="142" y2="141" stroke="#ff6b6b" stroke-width="1.4" marker-end="url(#fig-saga-carr)"/>
  <text x="330" y="182" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">on failure, run compensations in reverse order</text>
</svg>`;

export const content = {
  oneliner: `Run a long-lived business transaction as a sequence of local transactions, and undo committed steps with compensating actions instead of a global rollback.`,
  archetype: "pattern",
  figures: [
    { id: "saga-flow", svg: FLOW_SVG, caption: "Forward steps each commit locally; if a later step fails, previously-committed steps are undone by their compensations in reverse order." },
  ],
  sections: [
    { title: `The problem: no rollback across services`, body: `<p>A checkout must reserve stock, charge the wallet, and ship — each owned by a different service with its own database. There is no shared transaction and no global <code>ROLLBACK</code>: once the wallet service commits a debit, the inventory service cannot undo it. Holding a distributed lock across all three (2PC) would block and does not survive a service being down for minutes. The <b>saga</b> pattern accepts this reality: model the workflow as a series of <b>local</b> ACID transactions, and for each one define a <b>compensating transaction</b> that semantically undoes it.</p>` },
    { title: `Structure: steps and compensations`, figureAfter: "saga-flow", body: `<p>A saga is an ordered list of steps T1…Tn, each with a compensation C1…Cn. The happy path runs T1→T2→…→Tn, each committing locally. If step Tk fails, the saga runs the compensations for the already-committed steps <b>in reverse order</b>: C(k-1)…C1. Compensation is <em>semantic</em> undo, not a rollback — you cannot un-charge a wallet, so C for "charge" is "issue a refund"; C for "reserve stock" is "release the reservation."</p>
<pre>public interface SagaStep {
    String name();
    void execute(SagaContext ctx);
    void compensate(SagaContext ctx);
}

public final class ReserveStockStep implements SagaStep {
    private final InventoryClient inventory;

    @Override public String name() { return "RESERVE_STOCK"; }

    @Override
    public void execute(SagaContext ctx) {
        String reservationId = inventory.reserve(ctx.orderId(), ctx.sku(), ctx.quantity());
        ctx.put("reservationId", reservationId);
    }

    @Override
    public void compensate(SagaContext ctx) {
        inventory.release(ctx.getString("reservationId"));
    }
}

public final class ChargeWalletStep implements SagaStep {
    private final WalletClient wallet;

    @Override public String name() { return "CHARGE_WALLET"; }

    @Override
    public void execute(SagaContext ctx) {
        String chargeId = wallet.charge(ctx.walletId(), ctx.amountCents(), ctx.paymentId());
        ctx.put("chargeId", chargeId);
    }

    @Override
    public void compensate(SagaContext ctx) {
        wallet.refund(ctx.getString("chargeId"), ctx.amountCents());
    }
}</pre>
<p>Key consequence: a saga gives you <b>atomicity but not isolation</b>. Between T2 committing and a later failure, other transactions can observe the intermediate state (money already moved). Compensations must therefore be commutative/idempotent and tolerate that a compensated-for effect was briefly visible.</p>` },
    { title: `Saga orchestrator in Java`, body: `<p>An <b>orchestrator</b> drives the step sequence, persists state durably, and runs compensations on failure:</p>
<pre>public enum SagaStatus { RUNNING, COMPLETED, COMPENSATING, FAILED }

public final class CheckoutSagaOrchestrator {
    private final List&lt;SagaStep&gt; steps;
    private final SagaStateRepository stateRepo;

    public CheckoutSagaOrchestrator(List&lt;SagaStep&gt; steps, SagaStateRepository stateRepo) {
        this.steps = steps;
        this.stateRepo = stateRepo;
    }

    public void start(CheckoutSagaContext ctx) {
        SagaState state = SagaState.started(ctx.sagaId(), ctx.orderId());
        stateRepo.save(state);
        runForward(state, ctx, 0);
    }

    private void runForward(SagaState state, SagaContext ctx, int stepIndex) {
        for (int i = stepIndex; i &lt; steps.size(); i++) {
            SagaStep step = steps.get(i);
            try {
                step.execute(ctx);
                state.markStepCompleted(step.name());
                stateRepo.save(state);
            } catch (Exception e) {
                state.markFailed(step.name(), e.getMessage());
                stateRepo.save(state);
                compensate(state, ctx, i - 1);
                return;
            }
        }
        state.markCompleted();
        stateRepo.save(state);
    }

    private void compensate(SagaState state, SagaContext ctx, int lastCompletedIndex) {
        state.markCompensating();
        stateRepo.save(state);

        for (int i = lastCompletedIndex; i &gt;= 0; i--) {
            try {
                steps.get(i).compensate(ctx);
                state.markStepCompensated(steps.get(i).name());
                stateRepo.save(state);
            } catch (Exception e) {
                state.markCompensationFailed(steps.get(i).name(), e.getMessage());
                stateRepo.save(state);
                alertOps(state, e);
                return;
            }
        }
        state.markFailed();
        stateRepo.save(state);
    }
}</pre>
<pre>// Wiring the checkout saga
CheckoutSagaOrchestrator orchestrator = new CheckoutSagaOrchestrator(
    List.of(
        new ReserveStockStep(inventoryClient),
        new ChargeWalletStep(walletClient),
        new ShipOrderStep(shippingClient)
    ),
    sagaStateRepository
);

orchestrator.start(new CheckoutSagaContext(
    sagaId, orderId, walletId, paymentId, sku, quantity, amountCents));</pre>` },
    { title: `Choreography vs orchestration`, body: `<p>Two ways to drive the step sequence:</p>
<ul>
<li><b>Choreography</b> — no central controller. Each service reacts to events and emits the next event: Order emits <code>OrderCreated</code> → Inventory reserves and emits <code>StockReserved</code> → Payment charges and emits <code>PaymentCaptured</code> → Shipping ships. Compensations flow the same way (a failure event triggers upstream services to compensate). Simple and decoupled for short flows, but the overall workflow is implicit — spread across many services, hard to see or change, and prone to cyclic event dependencies.</li>
<li><b>Orchestration</b> — a central <b>saga orchestrator</b> (a process manager) explicitly invokes each step, tracks progress in a durable state machine, and issues compensations on failure. The workflow lives in one place, is easy to reason about and monitor, and handles complex branching — at the cost of one more component and the orchestrator being a focal point.</li>
</ul>` },
    { title: `Implementing it safely`, body: `<p>Whichever style, the mechanics that make sagas reliable: persist saga state durably (so a crash resumes mid-flight), make every step and compensation <b>idempotent</b> (steps get retried, compensations may run more than once), and pair each local transaction with the <b>transactional outbox</b> so the "I committed, here is my event" message is atomic with the DB write.</p>
<pre>@Transactional
public String charge(String walletId, long amountCents, String paymentId) {
    // idempotent on paymentId — safe to retry after orchestrator crash
    if (chargeRepo.existsByPaymentId(paymentId)) {
        return chargeRepo.findByPaymentId(paymentId).chargeId();
    }
    String chargeId = walletRepo.debit(walletId, amountCents);
    chargeRepo.save(new ChargeRecord(chargeId, paymentId, walletId, amountCents));
    outboxRepo.insert(new OutboxEvent("PaymentCaptured", paymentId));
    return chargeId;
}

@Transactional
public void refund(String chargeId, long amountCents) {
    if (refundRepo.existsByChargeId(chargeId)) return;  // idempotent compensation
    walletRepo.credit(chargeId, amountCents);
    refundRepo.save(new RefundRecord(chargeId, amountCents));
}</pre>
<p>Handle failures of the compensation itself with retry/alerting — a compensation that cannot complete needs human intervention. Use sagas when a business process spans services and can tolerate brief inconsistency; prefer 2PC/TCC only when you need stronger isolation and the participants are tightly coupled.</p>` },
  ],
  related: ["saga-orchestration", "saga-choreography", "tcc", "two-pc", "transactional-outbox"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("saga", stage, panel, stageEl);
}
