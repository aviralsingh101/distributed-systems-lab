// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "vector-clock", title: "Vector Clock", category: "ordering" };

const VECTOR_SVG = `<svg viewBox="0 0 720 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vector clocks detecting concurrent versus causal events">
  <defs><marker id="fig-vector-clock-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="55" y="45" text-anchor="middle" fill="#5b9dff" font-size="10" font-family="system-ui">A</text>
  <text x="55" y="145" text-anchor="middle" fill="#7c5cff" font-size="10" font-family="system-ui">B</text>
  <line x1="80" y1="40" x2="690" y2="40" stroke="#93a1bd" stroke-width="1"/>
  <line x1="80" y1="140" x2="690" y2="140" stroke="#93a1bd" stroke-width="1"/>
  <g font-family="system-ui" font-size="9">
    <circle cx="150" cy="40" r="5" fill="#3ddc97"/><text x="150" y="28" text-anchor="middle" fill="#cdd6e8">[1,0]</text>
    <circle cx="300" cy="40" r="5" fill="#3ddc97"/><text x="300" y="28" text-anchor="middle" fill="#cdd6e8">[2,0]</text>
    <circle cx="150" cy="140" r="5" fill="#ff6b6b"/><text x="150" y="160" text-anchor="middle" fill="#cdd6e8">[0,1]</text>
    <circle cx="470" cy="140" r="5" fill="#3ddc97"/><text x="470" y="160" text-anchor="middle" fill="#cdd6e8">[2,2]</text>
  </g>
  <line x1="300" y1="46" x2="465" y2="134" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-vector-clock-arr)"/>
  <text x="235" y="95" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">[2,0] → [0,1] concurrent</text>
  <text x="420" y="105" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">[2,0] → [2,2] causal (A ≤ B)</text>
</svg>`;

export const content = {
  oneliner: `A vector of per-process counters that captures full causal history, so you can tell whether two events are causally ordered or genuinely concurrent — the thing a Lamport clock cannot do.`,
  archetype: "concept",
  figures: [
    { id: "vector-flow", svg: VECTOR_SVG, caption: "Each event carries a counter per process. [2,0] and [0,1] are incomparable, so they are concurrent; [2,0] is componentwise ≤ [2,2], so it causally precedes it." },
  ],
  sections: [
    { title: `Why a scalar clock is not enough`, body: `<p>A Lamport clock guarantees that if a happens-before b then <code>C(a) &lt; C(b)</code> — but the reverse does not hold, so a smaller timestamp cannot prove causal order and cannot reveal concurrency. That gap matters when two replicas accept writes independently: you must know whether one write <em>saw</em> the other (keep the newer) or they were made <b>concurrently</b> in ignorance of each other (a genuine conflict to reconcile). A single counter throws away the information needed to answer this. A <b>vector clock</b> keeps it.</p>` },
    { title: `How it works`, body: `<p>With N processes, each event carries a <b>vector</b> of N counters — one slot per process — representing "how many events from each process this event causally depends on." The rules generalize the Lamport ones:</p>
<ol>
<li><b>Local event on process i.</b> Increment your own slot: <code>V[i] = V[i] + 1</code>.</li>
<li><b>Send.</b> Attach the whole vector to the message.</li>
<li><b>Receive on process i.</b> Take the elementwise maximum with the received vector, then increment your own slot: <code>V[k] = max(V[k], recv[k])</code> for all k, then <code>V[i] += 1</code>.</li>
</ol>
<p>Each slot thus records the latest event from that process which the current event knows about. The vector is a compact summary of the event's entire causal history.</p>
<pre>// VectorClock — N counters, one per process
public final class VectorClock {
    private final int[] vector;

    public VectorClock(int numProcesses) {
        this.vector = new int[numProcesses];
    }

    public VectorClock tick(int processIndex) {
        vector[processIndex]++;
        return this;
    }

    public VectorClock merge(int processIndex, VectorClock received) {
        for (int i = 0; i &lt; vector.length; i++) {
            vector[i] = Math.max(vector[i], received.vector[i]);
        }
        vector[processIndex]++;
        return this;
    }

    public Ordering compare(VectorClock other) {
        boolean thisLeOther = true, otherLeThis = true;
        for (int i = 0; i &lt; vector.length; i++) {
            if (vector[i] &gt; other.vector[i]) otherLeThis = false;
            if (vector[i] &lt; other.vector[i]) thisLeOther = false;
        }
        if (thisLeOther &amp;&amp; otherLeThis) return Ordering.EQUAL;
        if (thisLeOther) return Ordering.BEFORE;
        if (otherLeThis) return Ordering.AFTER;
        return Ordering.CONCURRENT; // genuine conflict
    }

    public int[] snapshot() { return vector.clone(); }
    public enum Ordering { BEFORE, AFTER, CONCURRENT, EQUAL }
}</pre>` },
    { title: `Comparing vectors: before, after, or concurrent`, body: `<p>Order is determined by componentwise comparison of two vectors V and W:</p>
<ul>
<li><b>V → W (V causally precedes W)</b> if <code>V[k] ≤ W[k]</code> for every k and they are not equal. Everything V knew, W also knew.</li>
<li><b>W → V</b> by the symmetric condition.</li>
<li><b>V ∥ W (concurrent)</b> if neither is componentwise ≤ the other — each has at least one slot the other lacks. This is the case Lamport clocks cannot detect, and it means the two events happened without knowledge of each other.</li>
</ul>
<p>So vector clocks give you a partial order that exactly captures happens-before, plus explicit detection of concurrency.</p>
<pre>// Wallet replica: detect concurrent debits, surface siblings
public class WalletReplica {
    private final VectorClock clock;
    private final int myProcessIndex;
    private WalletState state = WalletState.empty();

    public MergeResult applyDebit(WalletDebitEvent evt) {
        VectorClock evtClock = evt.vectorClock();
        Ordering ord = state.clock().compare(evtClock);

        if (ord == VectorClock.Ordering.BEFORE
            || ord == VectorClock.Ordering.EQUAL) {
            // evt causally follows current state — apply
            state = state.debit(evt.amount())
                .withClock(clock.merge(myProcessIndex, evtClock));
            return MergeResult.APPLIED;
        }
        if (ord == VectorClock.Ordering.AFTER) {
            return MergeResult.STALE; // already superseded
        }
        // Concurrent — two debits in ignorance of each other
        return MergeResult.CONFLICT(
            state, evt); // application merges or picks winner
    }
}</pre>` },
    { title: `Where they are used`, body: `<p>Vector clocks are the classic tool for <b>conflict detection in eventually-consistent stores</b>. Amazon Dynamo and its descendants (Riak, early Voldemort) tag each object version with a vector clock; on read, if two versions are concurrent, the store surfaces both <b>siblings</b> and lets the application (or a CRDT merge) resolve them, rather than silently losing a write via last-writer-wins. They also underpin causal-consistency protocols and collaborative-editing systems that must merge independent edits.</p>` },
    { title: `The cost`, body: `<p>The price of that precision is size: a vector grows with the number of participating processes, so in systems with many transient clients the vectors can bloat. Real systems bound this with <b>dotted version vectors</b>, per-server (not per-client) entries, and pruning of entries for departed nodes. The trade-off is the guide: use a <b>Lamport clock</b> when you only need a consistent total order cheaply; use a <b>vector clock</b> when you must distinguish causal from concurrent — typically for multi-writer conflict resolution.</p>` },
  ],
  related: ["lamport-clock", "clock-skew", "eventual-consistency", "crdt", "out-of-order", "quorum"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("vector-clock", stage, panel, stageEl);
}
