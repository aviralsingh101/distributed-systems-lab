// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "lamport-clock", title: "Lamport Clock", category: "ordering" };

const LAMPORT_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lamport clock counters advancing across a message send">
  <defs><marker id="fig-lamport-clock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="60" y="45" text-anchor="middle" fill="#5b9dff" font-size="10" font-family="system-ui">P1</text>
  <text x="60" y="135" text-anchor="middle" fill="#7c5cff" font-size="10" font-family="system-ui">P2</text>
  <line x1="90" y1="40" x2="690" y2="40" stroke="#93a1bd" stroke-width="1"/>
  <line x1="90" y1="130" x2="690" y2="130" stroke="#93a1bd" stroke-width="1"/>
  <g font-family="system-ui" font-size="10">
    <circle cx="150" cy="40" r="6" fill="#3ddc97"/><text x="150" y="28" text-anchor="middle" fill="#cdd6e8">1</text>
    <circle cx="260" cy="40" r="6" fill="#3ddc97"/><text x="260" y="28" text-anchor="middle" fill="#cdd6e8">2</text>
    <circle cx="150" cy="130" r="6" fill="#3ddc97"/><text x="150" y="152" text-anchor="middle" fill="#cdd6e8">1</text>
    <circle cx="470" cy="130" r="6" fill="#ff6b6b"/><text x="470" y="152" text-anchor="middle" fill="#cdd6e8">max(1,2)+1 = 3</text>
    <circle cx="600" cy="130" r="6" fill="#3ddc97"/><text x="600" y="152" text-anchor="middle" fill="#cdd6e8">4</text>
  </g>
  <line x1="260" y1="46" x2="465" y2="124" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-lamport-clock-arr)"/>
  <text x="380" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">message carries ts=2</text>
  <text x="360" y="172" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">send happens-before receive → send's timestamp is smaller</text>
</svg>`;

export const content = {
  oneliner: `A single per-process counter that assigns timestamps respecting causality — if event A can influence B, then A's timestamp is smaller — giving a consistent total order without synchronized clocks.`,
  archetype: "concept",
  figures: [
    { id: "lamport-flow", svg: LAMPORT_SVG, caption: "Each process increments its counter per event; a message carries the sender's timestamp, and the receiver jumps to max(local, received) + 1, so a send always gets a smaller timestamp than its receive." },
  ],
  sections: [
    { title: `The happens-before relation`, body: `<p>Leslie Lamport's 1978 insight is that in a distributed system you rarely need to know the <em>real</em> time an event occurred — you need to know which events could have <b>caused</b> which. He defined the <b>happens-before</b> relation (written a → b): a → b if they are on the same process and a comes first, or a is a message send and b is its receive, or by transitivity through a chain of those. If neither a → b nor b → a, the events are <b>concurrent</b> — they could not have influenced each other. Physical clocks cannot capture this because of clock skew; happens-before is about causality, not wall time.</p>` },
    { title: `How it works`, body: `<p>A Lamport clock is one integer counter per process, and the algorithm is three small rules:</p>
<ol>
<li><b>Local event.</b> Before timestamping any event (including a send), increment your counter: <code>C = C + 1</code>.</li>
<li><b>Send.</b> Attach the current counter value to the outgoing message.</li>
<li><b>Receive.</b> Set <code>C = max(C, received_ts) + 1</code> before processing. Taking the max lets the receiver "catch up" to a sender that was ahead, so the receive is stamped later than the send.</li>
</ol>
<p>The guarantee this produces: <b>if a → b then C(a) &lt; C(b)</b>. Causally-related events always get increasing timestamps, so a smaller timestamp can never belong to an effect of a larger one.</p>
<pre>// LamportClock — one counter per process
public final class LamportClock {
    private final int processId;
    private int counter;

    public LamportClock(int processId) { this.processId = processId; }

    /** Local event or send: increment before stamping */
    public Timestamp tick() {
        counter++;
        return new Timestamp(counter, processId);
    }

    /** Receive: jump to max(local, received) + 1 */
    public Timestamp onReceive(Timestamp received) {
        counter = Math.max(counter, received.value()) + 1;
        return new Timestamp(counter, processId);
    }

    public record Timestamp(int value, int processId)
        implements Comparable&lt;Timestamp&gt; {
        @Override public int compareTo(Timestamp other) {
            int cmp = Integer.compare(value, other.value);
            return cmp != 0 ? cmp : Integer.compare(processId, other.processId);
        }
    }
}

// Payment service stamps outgoing order events
public class OrderEventPublisher {
    private final LamportClock clock;
    private final EventBus bus;

    public void publishPaid(String orderId) {
        LamportClock.Timestamp ts = clock.tick();
        bus.send(new OrderPaidEvent(orderId, ts));
    }

    public void onShippedReceived(OrderShippedEvent evt) {
        LamportClock.Timestamp ts = clock.onReceive(evt.lamportTs());
        applyShipped(evt.orderId(), ts);
    }
}</pre>` },
    { title: `Total order via a tie-break`, body: `<p>Lamport timestamps alone can collide — two concurrent events on different processes may share a value. To get a <b>total order</b> (a single line every process agrees on), break ties with a fixed rule, usually the process id: order by the pair <code>(timestamp, process_id)</code>. This yields a deterministic total order consistent with causality, which is exactly what algorithms like Lamport's mutual-exclusion and totally-ordered multicast need — every node processes requests in the same agreed sequence.</p>` },
    { title: `The key limitation`, body: `<p>The implication runs one way only. <b>a → b implies C(a) &lt; C(b)</b>, but the converse is false: <code>C(a) &lt; C(b)</code> does <em>not</em> mean a happened before b — they might be concurrent and merely got assigned different numbers. So a Lamport clock can impose an order, but it <b>cannot tell you whether two events were causally related or truly concurrent</b>. When you need to detect concurrency — for conflict detection in a replicated store, deciding whether two writes conflict — you need <b>vector clocks</b>, which track a counter per process and can distinguish "before," "after," and "concurrent."</p>` },
    { title: `Where it is used`, body: `<p>Lamport clocks are the workhorse behind totally-ordered broadcast, distributed mutual exclusion, and any protocol that needs all nodes to agree on a sequence without a global clock. They are cheap — one integer, one number per message — which is why they underpin more elaborate schemes (hybrid logical clocks combine a Lamport counter with physical time to get causal ordering plus roughly-real timestamps). Reach for a Lamport clock when you need a consistent ordering across nodes; reach for a vector clock when you also need to know what is concurrent.</p>` },
  ],
  related: ["vector-clock", "clock-skew", "event-reordering", "out-of-order", "eventual-consistency", "crdt"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("lamport-clock", stage, panel, stageEl);
}
