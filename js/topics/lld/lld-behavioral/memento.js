// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const MEM_SVG = `<svg viewBox="0 0 580 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Memento roles">
  <defs><marker id="fig-memento-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="60" width="150" height="60" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="95" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">OrderDraft</text>
  <text x="95" y="98" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">(originator)</text>
  <text x="95" y="112" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">save() / restore(m)</text>
  <rect x="230" y="66" width="120" height="48" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="290" y="86" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Memento</text>
  <text x="290" y="101" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">opaque snapshot</text>
  <rect x="410" y="40" width="150" height="100" rx="6" fill="#141b2c" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="485" y="60" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">History (caretaker)</text>
  <rect x="425" y="70" width="120" height="18" rx="3" fill="#1a2236" stroke="#26324a"/>
  <text x="485" y="83" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">memento #1</text>
  <rect x="425" y="92" width="120" height="18" rx="3" fill="#1a2236" stroke="#26324a"/>
  <text x="485" y="105" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">memento #2</text>
  <rect x="425" y="114" width="120" height="18" rx="3" fill="#1a2236" stroke="#26324a"/>
  <text x="485" y="127" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">memento #3 (top)</text>
  <line x1="170" y1="90" x2="228" y2="90" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-memento-arr)"/>
  <text x="199" y="82" fill="#93a1bd" font-size="8" font-family="system-ui">save</text>
  <line x1="350" y1="90" x2="408" y2="90" stroke="#7c5cff" stroke-width="1.4" marker-end="url(#fig-memento-arr)"/>
  <text x="379" y="82" fill="#93a1bd" font-size="8" font-family="system-ui">push</text>
  <text x="290" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">caretaker stores mementos but never reads their contents</text>
</svg>`;

const topic = makeTopic({
  id: "memento",
  title: "Memento",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Snapshot an object's internal state into an opaque token so it can be restored later — without exposing that state to anyone else.`,
  sections: [
    { title: `Intent`, body: `<p><b>Memento</b> captures and externalizes an object's internal state so it can be restored later, <b>without violating encapsulation</b>. The snapshot is handed out as an opaque token: whoever holds it can give it back to restore, but cannot read or tamper with what is inside.</p>
<p>The everyday face of this is <b>undo</b>. A multi-step order draft — add items, apply a promo, change the address — should let the user step backwards. Memento lets the draft snapshot itself before each change and roll back on demand, without leaking its private fields.</p>
<pre>// --- Originator: creates and restores from mementos ---
public class OrderDraft {
    private List&lt;LineItem&gt; items = new ArrayList&lt;&gt;();
    private String promoCode;
    private String shippingAddress;

    public Memento save() {
        return new Memento(
            new ArrayList&lt;&gt;(items),
            promoCode,
            shippingAddress
        );
    }

    public void restore(Memento memento) {
        this.items = new ArrayList&lt;&gt;(memento.items());
        this.promoCode = memento.promoCode();
        this.shippingAddress = memento.shippingAddress();
    }
}</pre>` },
    { title: `Participants and structure`, figureAfter: "memento-roles", body: `<p>Three roles, and the encapsulation trick lives in their interfaces:</p>
<ul>
<li><b>Originator</b> — <code>OrderDraft</code>. It creates a memento capturing its current state and can restore itself from one.</li>
<li><b>Memento</b> — the opaque snapshot. It offers a <em>wide</em> interface to the originator (which reads/writes the full state) but only a <em>narrow</em>, opaque interface to everyone else.</li>
<li><b>Caretaker</b> — the undo history. It stores mementos and decides when to restore, but never inspects their contents.</li>
</ul>
<pre>// --- Memento: opaque to outsiders, readable by originator (nested class) ---
public class OrderDraft {
    // … fields and save/restore as above …

    // Nested memento — package-private fields, no public getters
    public static final class Memento {
        private final List&lt;LineItem&gt; items;
        private final String promoCode;
        private final String shippingAddress;

        private Memento(List&lt;LineItem&gt; items, String promoCode, String shippingAddress) {
            this.items = items;
            this.promoCode = promoCode;
            this.shippingAddress = shippingAddress;
        }
    }
}</pre>
<p>Because only the originator can interpret a memento, the pattern preserves the very encapsulation a naive "expose the state so someone can save it" approach would break.</p>` },
    { title: `Implementation flow`, body: `<p>Save-before-change, restore-on-undo:</p>
<ol>
<li>Before a mutation, the caretaker asks the originator to snapshot: <code>history.push(draft.save())</code>.</li>
<li>The draft mutates normally.</li>
<li>On undo, the caretaker pops the last memento and calls <code>draft.restore(memento)</code>, which copies the saved fields back.</li>
</ol>
<pre>// --- Caretaker: stores mementos, never reads their contents ---
public final class DraftHistory {
    private final Deque&lt;OrderDraft.Memento&gt; stack = new ArrayDeque&lt;&gt;();
    private final OrderDraft draft;

    public DraftHistory(OrderDraft draft) { this.draft = draft; }

    public void checkpoint() {
        stack.push(draft.save());
    }

    public void undo() {
        if (!stack.isEmpty()) {
            draft.restore(stack.pop());
        }
    }
}

// Usage with Command pattern for undoable edits
history.checkpoint();
draft.applyPromo("SAVE10");
// user clicks undo:
history.undo();  // restores pre-promo state</pre>
<p>Undo is frequently implemented by combining Memento with <b>Command</b>: each command captures a memento so its <code>undo()</code> can restore the prior state cleanly.</p>` },
    { title: `Trade-offs and alternatives`, body: `<p>Memento gives clean rollback while keeping state private, but each snapshot copies (potentially deep-copies) the originator's state, so a long history of large objects is expensive in memory — and getting the deep copy right is a common bug. Consider trimming history, or using an incremental approach: instead of full snapshots, record the <em>changes</em> (command-based undo) or the sequence of events (<b>event sourcing</b>), rebuilding state by replay. Reach for full mementos when state is small or restoration must be instant.</p>` },
  ],
  figures: [
    { id: "memento-roles", svg: MEM_SVG, caption: "The originator snapshots itself into an opaque memento; the caretaker keeps a history it can restore but never reads." },
  ],
  related: ["command", "state", "temporal-tables", "optimistic-locking-schema"],
});

export const meta = topic.meta;
export const content = topic.content;
