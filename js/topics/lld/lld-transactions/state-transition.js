// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "state-transition", title: "A→B→C State Transition", category: "transactions" };

const SM_SVG = `<svg viewBox="0 0 640 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ordered state transitions">
  <defs><marker id="fig-state-transition-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <ellipse cx="70" cy="70" rx="52" ry="30" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/>
  <text x="70" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">PENDING</text>
  <ellipse cx="250" cy="70" rx="52" ry="30" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/>
  <text x="250" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">PAID</text>
  <ellipse cx="430" cy="70" rx="52" ry="30" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="430" y="74" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">SHIPPED</text>
  <ellipse cx="600" cy="70" rx="40" ry="30" fill="#1a2236" stroke="#3ddc97" stroke-width="1.6"/>
  <text x="600" y="74" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">DELIVERED</text>
  <line x1="122" y1="70" x2="196" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-state-transition-arr)"/>
  <line x1="302" y1="70" x2="376" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-state-transition-arr)"/>
  <line x1="482" y1="70" x2="558" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-state-transition-arr)"/>
  <path d="M250,100 C250,135 70,135 70,102" fill="none" stroke="#ff6b6b" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-state-transition-arr)"/>
  <text x="160" y="132" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">skipping/reversing is rejected</text>
</svg>`;

export const content = {
  oneliner: `Force an entity through its states in order (A→B→C) so concurrent or out-of-order updates can never skip, reverse, or lose an intermediate state.`,
  archetype: "pattern",
  figures: [
    { id: "state-machine", svg: SM_SVG, caption: "Only forward edges are legal; an update that would skip a state or move backward is rejected, not silently applied." },
  ],
  sections: [
    { title: `The problem: last-writer-wins loses states`, body: `<p>An order moves <code>PENDING → PAID → SHIPPED → DELIVERED</code>. Now imagine two events arrive concurrently or out of order: a slow "PAID" webhook and a fast "SHIPPED" event. If each handler blindly does <code>UPDATE orders SET status = ?</code>, the final value depends on which write lands last — the order can end up back in PAID after being SHIPPED, or a state can be lost entirely. Worse, side effects tied to a transition (capture the payment, decrement stock) may fire twice or in the wrong order. The fix is to treat status as a <b>state machine</b> and make each transition a <b>guarded, serialized</b> operation.</p>` },
    { title: `Structure: an explicit transition table`, figureAfter: "state-machine", body: `<p>Model the allowed edges explicitly with an enum and a transition map rather than scattering <code>if (status == ...)</code> checks:</p>
<pre>public enum PaymentStatus {
    PENDING,
    AUTHORIZED,
    CAPTURED,
    SHIPPED,
    DELIVERED,
    REFUNDED,
    CANCELLED;

    private static final Map&lt;PaymentStatus, Set&lt;PaymentStatus&gt;&gt; ALLOWED = Map.of(
        PENDING,    Set.of(AUTHORIZED, CANCELLED),
        AUTHORIZED, Set.of(CAPTURED, CANCELLED),
        CAPTURED,   Set.of(SHIPPED, REFUNDED),
        SHIPPED,    Set.of(DELIVERED),
        DELIVERED,  Set.of(),
        REFUNDED,   Set.of(),
        CANCELLED,  Set.of()
    );

    public boolean canTransitionTo(PaymentStatus next) {
        return ALLOWED.getOrDefault(this, Set.of()).contains(next);
    }
}</pre>
<pre>public final class PaymentStateMachine {

    public void transition(Payment payment, PaymentStatus next) {
        PaymentStatus current = payment.status();
        if (!current.canTransitionTo(next)) {
            throw new IllegalTransitionException(
                "Cannot move payment " + payment.id() + " from " + current + " to " + next);
        }
        payment.setStatus(next);
        fireSideEffect(payment, current, next);
    }

    private void fireSideEffect(Payment payment, PaymentStatus from, PaymentStatus to) {
        if (from == PaymentStatus.AUTHORIZED &amp;&amp; to == PaymentStatus.CAPTURED) {
            ledgerService.recordCapture(payment.id(), payment.amountCents());
        }
        if (from == PaymentStatus.CAPTURED &amp;&amp; to == PaymentStatus.REFUNDED) {
            ledgerService.recordRefund(payment.id(), payment.amountCents());
        }
    }
}</pre>
<p>This is the <b>State</b> pattern applied to persistence: illegal jumps (PENDING→SHIPPED, or any backward move) are rejected at the boundary, so an out-of-order or duplicate event becomes a safe no-op/error instead of corrupting the record.</p>` },
    { title: `Serializing the read-modify-write`, body: `<p>The transition check is a classic read-modify-write, so it must be atomic against concurrent writers. Two standard implementations:</p>
<pre>// Conditional (compare-and-set) update — guard encoded in SQL
@Repository
public interface PaymentRepository extends JpaRepository&lt;Payment, String&gt; {

    @Modifying
    @Query("UPDATE Payment p SET p.status = :next WHERE p.id = :id AND p.status = :current")
    int transitionIfCurrent(
        @Param("id") String id,
        @Param("current") PaymentStatus current,
        @Param("next") PaymentStatus next);
}

@Service
public class PaymentTransitionService {
    public void markCaptured(String paymentId) {
        int updated = paymentRepo.transitionIfCurrent(
            paymentId, PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED);
        if (updated == 0) {
            throw new TransitionRejectedException(paymentId, PaymentStatus.CAPTURED);
        }
        ledgerService.recordCapture(paymentId);
    }
}</pre>
<pre>// Optimistic locking — version column prevents stale overwrites
@Entity
public class Payment {
    @Id private String id;
    @Enumerated(EnumType.STRING) private PaymentStatus status;
    @Version private long version;
}

@Transactional
public void markShipped(String paymentId) {
    Payment payment = paymentRepo.findById(paymentId).orElseThrow();
    stateMachine.transition(payment, PaymentStatus.SHIPPED);
    paymentRepo.save(payment);  // fails if version bumped by concurrent writer
}</pre>
<p>All three approaches (conditional update, optimistic locking, pessimistic <code>SELECT ... FOR UPDATE</code>) ensure the machine advances one legal edge at a time rather than clobbering.</p>` },
    { title: `Ordering and idempotency at the edges`, body: `<p>Guarded transitions handle <em>concurrency</em>; you also need to handle <em>out-of-order delivery</em>. Attach a monotonically increasing sequence or timestamp to events and ignore any event older than the current state.</p>
<pre>public final class PaymentEventHandler {
    private final PaymentStateMachine stateMachine;
    private final PaymentRepository paymentRepo;

    public void onPaymentEvent(PaymentEvent event) {
        Payment payment = paymentRepo.findById(event.paymentId()).orElseThrow();

        if (event.sequence() &lt;= payment.lastProcessedSequence()) {
            return;  // duplicate or stale — idempotent no-op
        }

        PaymentStatus target = mapEventToStatus(event.type());
        if (!payment.status().canTransitionTo(target)) {
            if (isOutOfOrder(event, payment)) {
                return;  // SHIPPED arrived before PAID — wait for PAID
            }
            throw new IllegalTransitionException(payment.status(), target);
        }

        stateMachine.transition(payment, target);
        payment.setLastProcessedSequence(event.sequence());
        paymentRepo.save(payment);
    }

    private boolean isOutOfOrder(PaymentEvent event, Payment payment) {
        return event.type() == EventType.SHIPPED
            &amp;&amp; payment.status() == PaymentStatus.AUTHORIZED;
    }
}</pre>
<p>Combined with the transition table, this makes handlers <b>idempotent</b>: replaying the same event, or receiving events shuffled by the network, converges to the correct final state and each side effect fires exactly once. For a payment order this guarantees the money is captured on the CAPTURED edge precisely once, and a late duplicate cannot re-trigger it — the intermediate states are neither skipped nor lost.</p>` },
  ],
  related: ["state", "optimistic", "isolation-levels", "out-of-order"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("state-transition", stage, panel, stageEl);
}
