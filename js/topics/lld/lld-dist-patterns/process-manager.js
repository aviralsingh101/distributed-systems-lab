// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const PM_SVG = `<svg viewBox="0 0 560 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Process manager state machine"><defs><marker id="fig-process-manager-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="55" width="96" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/><text x="62" y="79" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">AWAIT_PAYMENT</text><rect x="150" y="55" width="96" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="198" y="79" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">AWAIT_STOCK</text><rect x="286" y="55" width="96" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="334" y="79" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">SHIPPING</text><rect x="422" y="20" width="120" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="482" y="43" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">COMPLETED</text><rect x="422" y="92" width="120" height="38" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/><text x="482" y="115" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">CANCELLED (timeout)</text><line x1="110" y1="75" x2="148" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-process-manager-arr)"/><line x1="246" y1="75" x2="284" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-process-manager-arr)"/><line x1="382" y1="68" x2="420" y2="45" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-process-manager-arr)"/><line x1="382" y1="82" x2="420" y2="108" stroke="#ff6b6b" stroke-width="1.5" marker-end="url(#fig-process-manager-arr)"/><text x="280" y="20" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">persistent state + timers advance on each incoming event</text></svg>`;

const topic = makeTopic({
  id: "process-manager",
  title: "Process Manager",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "A persistent state machine that coordinates a long-running, multi-message workflow — deciding the next step from accumulated events and timeouts.",
  sections: [
    {
      title: "When one request spans minutes or days",
      body: `<p>Some workflows are not a quick request/response. "Fulfil an order" might wait for a payment webhook, then a warehouse stock confirmation, then a carrier pickup — each arriving asynchronously, out of order, possibly hours apart, some never arriving. A stateless handler cannot manage this: it needs to <b>remember where it is</b> between messages.</p>
<p>A <b>process manager</b> is a component whose entire job is to hold that state and drive the workflow forward. It is a persistent state machine, one instance per business transaction.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "pm-flow",
      body: `<p>Each process-manager instance stores: its <b>current state</b>, correlation ids linking it to the messages it cares about, and any data gathered so far. It defines, for each state, which incoming events are expected and what to do on each:</p>
<ul>
<li>Receive an event &#8594; look up the instance by correlation id.</li>
<li>Consult the state machine: given (current state, event), compute the next state and the commands to send.</li>
<li>Persist the new state, then dispatch the commands.</li>
</ul>
<p>Crucially it also owns <b>timers</b>: "if stock is not confirmed within 30 minutes, cancel and refund". Timeouts are first-class transitions, not afterthoughts.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>An initiating event (<code>OrderPlaced</code>) creates a new instance in state <code>AWAIT_PAYMENT</code> and schedules a timeout.</li>
<li><code>PaymentCaptured</code> arrives &#8594; transition to <code>AWAIT_STOCK</code>, send <code>ReserveStock</code>, reset the timer.</li>
<li><code>StockReserved</code> arrives &#8594; transition to <code>SHIPPING</code>, send <code>DispatchShipment</code>.</li>
<li>If a timer fires before the expected event, transition to a compensating path (<code>CANCELLED</code>, issue refund).</li>
</ol>
<p>Because state is persisted after every transition, the workflow survives restarts and can run for arbitrarily long.</p>
<pre>// --- Persistent process instance ---
@Entity
@Table(name = "order_process")
public class OrderProcess {
    @Id private UUID processId;
    @Enumerated(EnumType.STRING)
    private ProcessState state; // AWAIT_PAYMENT, AWAIT_STOCK, SHIPPING, ...
    private UUID orderId;
    private Instant timeoutAt;
}

public enum ProcessState {
    AWAIT_PAYMENT, AWAIT_STOCK, SHIPPING, COMPLETED, CANCELLED
}</pre>
<pre>// --- Process manager: correlate events, advance state machine ---
@Service
public class OrderProcessManager {
    private final OrderProcessRepository processes;
    private final OutboxRepository outbox;

    @KafkaListener(topics = "order.events")
    @Transactional
    public void onEvent(DomainEvent event) {
        OrderProcess proc = processes.findByOrderId(event.orderId()).orElseThrow();
        switch (proc.getState()) {
            case AWAIT_PAYMENT when event instanceof PaymentCaptured e -&gt; {
                proc.setState(ProcessState.AWAIT_STOCK);
                proc.setTimeoutAt(Instant.now().plus(30, ChronoUnit.MINUTES));
                outbox.save(OutboxEntity.command(proc.getProcessId(), "ReserveStock"));
            }
            case AWAIT_STOCK when event instanceof StockReserved -&gt; {
                proc.setState(ProcessState.SHIPPING);
                outbox.save(OutboxEntity.command(proc.getProcessId(), "DispatchShipment"));
            }
            default -&gt; { /* ignore or log unexpected */ }
        }
    }

    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void fireTimeouts() {
        processes.findExpired(Instant.now()).forEach(proc -&gt; {
            proc.setState(ProcessState.CANCELLED);
            outbox.save(OutboxEntity.command(proc.getProcessId(), "RefundPayment"));
        });
    }
}</pre>`,
    },
    {
      title: "Process manager vs saga orchestrator",
      body: `<p>The two overlap heavily and the terms are often used interchangeably. The useful distinction: a <b>saga orchestrator</b> is specifically about running a distributed transaction with forward steps and compensations. A <b>process manager</b> is the more general routing pattern — it maintains state and decides the next action across any multi-message flow, including ones that branch, wait on external actors, and are not strictly transactional. Both are stateful, correlated, and timer-aware; a saga orchestrator is essentially a process manager specialized for compensation.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> makes complex, long-lived, event-driven workflows explicit, observable, and recoverable; centralizes timeout and error handling; correlation and state are managed in one place.</p>
<p><b>Cons:</b> it is a stateful service you must persist, scale, and make idempotent (events are redelivered); risk of concentrating too much logic; correlation-id design and out-of-order/duplicate event handling are fiddly. <b>Use when</b> a workflow waits on multiple asynchronous events with timeouts; for simple linear flows, plain <b>choreography</b> is lighter. Workflow engines (Temporal, Camunda) implement this pattern for you.</p>`,
    },
  ],
  figures: [
    { id: "pm-flow", svg: PM_SVG, caption: "A process manager persists workflow state and advances a state machine as correlated events (and timeouts) arrive, branching to completion or compensation." },
  ],
  related: ["saga-orchestration", "saga-choreography", "correlation-trace-ids", "transactional-outbox", "delayed-scheduled-messages"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("process-manager", stage, panel, stageEl);
}
