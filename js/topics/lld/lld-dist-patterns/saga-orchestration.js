// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const ORCH_SVG = `<svg viewBox="0 0 560 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orchestrated saga command flow"><defs><marker id="fig-saga-orchestration-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="210" y="10" width="140" height="38" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="280" y="27" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Saga Orchestrator</text><text x="280" y="41" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">owns state machine</text><rect x="30" y="100" width="120" height="38" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="90" y="123" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Wallet</text><rect x="220" y="100" width="120" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="280" y="123" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text><rect x="410" y="100" width="120" height="38" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="470" y="123" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Shipping</text><line x1="250" y1="48" x2="100" y2="98" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-orchestration-arr)"/><line x1="280" y1="48" x2="280" y2="98" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-orchestration-arr)"/><line x1="310" y1="48" x2="460" y2="98" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-saga-orchestration-arr)"/><text x="150" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">command / reply</text></svg>`;

const topic = makeTopic({
  id: "saga-orchestration",
  title: "Saga Orchestration",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "A distributed transaction driven by one coordinator that sends commands, tracks a persistent state machine, and issues compensations on failure.",
  sections: [
    {
      title: "The idea",
      body: `<p>Like every saga, an orchestrated saga replaces one impossible cross-service ACID transaction with a series of <em>local</em> transactions plus compensating actions. The difference from choreography is control flow: instead of services reacting to each other's events, a single <b>orchestrator</b> owns the workflow. It tells each participant what to do and reacts to the reply.</p>
<p>The orchestrator is a persistent state machine — one instance per saga (per order). Its state (current step, what has been done, what must be compensated) is stored durably so it survives restarts and can resume a half-finished transaction.</p>`,
    },
    {
      title: "Structure — commands and replies",
      figureAfter: "orch-flow",
      body: `<p>Communication is <b>command/reply</b>, not published domain events:</p>
<ul>
<li>The orchestrator sends a targeted command: <code>DebitWallet</code> to the Wallet service.</li>
<li>The participant executes its local transaction and returns a reply: <code>WalletDebited</code> or <code>WalletDebitFailed</code>.</li>
<li>The orchestrator records the outcome, advances its state machine, and sends the next command (<code>PostLedgerEntry</code>), and so on.</li>
</ul>
<p>Participants are dumb about the workflow — they only know how to execute a command and, crucially, how to <em>undo</em> it. The sequencing knowledge lives in exactly one place.</p>`,
    },
    {
      title: "Step-by-step flow with compensation",
      body: `<ol>
<li>Order request starts a saga instance; orchestrator persists state = STARTED.</li>
<li>Send <code>DebitWallet</code>; on reply, state = WALLET_DEBITED.</li>
<li>Send <code>PostLedgerEntry</code>; on reply, state = LEDGER_POSTED.</li>
<li>Send <code>ReserveShipping</code>. Suppose it fails.</li>
<li>The orchestrator switches to compensation mode and walks its recorded steps backward: <code>ReverseLedgerEntry</code>, then <code>RefundWallet</code>, updating state after each.</li>
<li>State = ABORTED once all compensations are acknowledged.</li>
</ol>
<p>Because state is persisted after every transition, a crash mid-saga resumes exactly where it left off. Commands and compensations are retried until acknowledged, so all participants must be idempotent.</p>
<pre>// --- Persistent saga state machine ---
@Entity
@Table(name = "saga_instance")
public class SagaInstance {
    @Id
    private UUID sagaId;
    @Enumerated(EnumType.STRING)
    private SagaState state; // STARTED, WALLET_DEBITED, LEDGER_POSTED, ...
    private UUID orderId;
}

public enum SagaCommand { DEBIT_WALLET, POST_LEDGER, RESERVE_SHIPPING }
public enum SagaReply  { WALLET_DEBITED, WALLET_FAILED, LEDGER_POSTED, SHIPPING_FAILED }</pre>
<pre>// --- Orchestrator: advance state, emit next command via outbox ---
@Service
public class PaymentSagaOrchestrator {
    private final SagaRepository sagas;
    private final OutboxRepository outbox;

    @Transactional
    public void onReply(SagaReply reply, UUID sagaId) {
        SagaInstance saga = sagas.findById(sagaId).orElseThrow();
        switch (reply) {
            case WALLET_DEBITED -&gt; {
                saga.setState(SagaState.WALLET_DEBITED);
                outbox.save(OutboxEntity.command(sagaId, SagaCommand.POST_LEDGER));
            }
            case SHIPPING_FAILED -&gt; compensate(saga);
            default -&gt; { /* advance or fail */ }
        }
    }

    private void compensate(SagaInstance saga) {
        saga.setState(SagaState.COMPENSATING);
        outbox.save(OutboxEntity.command(saga.getSagaId(), SagaCommand.REVERSE_LEDGER));
        outbox.save(OutboxEntity.command(saga.getSagaId(), SagaCommand.REFUND_WALLET));
    }
}</pre>
<pre>// --- Participant step handler: idempotent command execution ---
@Service
public class WalletSagaHandler {
    @KafkaListener(topics = "saga.commands.wallet")
    @Transactional
    public void handle(DebitWalletCommand cmd) {
        // inbox dedup on command_id, then debit and reply via outbox
    }
}</pre>`,
    },
    {
      title: "Where the orchestrator lives",
      body: `<p>The orchestrator can be a service you write (a state-machine table plus a message handler) or a workflow engine like Temporal, Camunda, or AWS Step Functions that persists execution state for you. Reliable messaging still matters: the orchestrator uses a <b>transactional outbox</b> to send commands atomically with its state update, and participants use the <b>inbox pattern</b> to dedup redelivered commands.</p>`,
    },
    {
      title: "Tradeoffs vs choreography",
      body: `<p><b>Pros:</b> the entire workflow is defined and observable in one place; adding or reordering steps is a local change; failure handling and timeouts are explicit; easy to answer "which sagas are stuck at step 3".</p>
<p><b>Cons:</b> the orchestrator is a component you must build, scale, and make highly available; risk of centralizing too much business logic into a "god service"; extra command/reply round trips. <b>Choose orchestration</b> for long, complex, or frequently-changing workflows that need central visibility; <b>choose choreography</b> for short flows where loose coupling matters more than a single definition.</p>`,
    },
  ],
  figures: [
    { id: "orch-flow", svg: ORCH_SVG, caption: "Orchestrated saga: a central coordinator holds the state machine and drives each participant via command/reply, issuing compensations in reverse on failure." },
  ],
  related: ["saga-choreography", "saga", "process-manager", "two-pc", "transactional-outbox"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("saga-orchestration", stage, panel, stageEl);
}
