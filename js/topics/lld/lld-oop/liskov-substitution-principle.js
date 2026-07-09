// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "liskov-substitution-principle",
  title: "Liskov Substitution",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Objects of a subtype must be usable anywhere the supertype is expected without breaking the program's correctness.`,
  sections: [
    { title: `The formal statement`, body: `<p>Barbara Liskov's <b>Substitution Principle (LSP)</b>, the "L" in SOLID, says: if <code>S</code> is a subtype of <code>T</code>, then objects of type <code>T</code> may be replaced with objects of type <code>S</code> <em>without altering any of the desirable properties of the program</em>. In short, a subtype must honor the <b>behavioral contract</b> of its supertype, not merely its method signatures.</p>
<p>A compiler only checks that the subclass has the right method shapes. LSP is about semantics: what those methods promise. Inheriting a type means committing to everything callers were allowed to assume about the base type.</p>` },
    { title: `How it works — the contract rules`, body: `<p>Substitutability works by preserving the contract along three dimensions. <b>Preconditions may not be strengthened:</b> a subtype cannot demand more of its inputs than the base did. <b>Postconditions may not be weakened:</b> the subtype must deliver at least what the base promised. <b>Invariants and history constraints must be preserved:</b> the subtype cannot allow states or transitions the base forbade.</p>
<p>Method parameters may be <em>contravariant</em> (accept wider types) and return values <em>covariant</em> (return narrower types); violating this variance breaks substitution.</p>` },
    { title: `The classic violation — Rectangle and Square`, body: `<p>The textbook counterexample is <b>Rectangle/Square</b>. A <code>Square</code> "is-a" <code>Rectangle</code> mathematically, so a naive design subclasses it. But <code>Rectangle</code> callers assume they can set width and height independently; a <code>Square</code> that keeps them equal breaks that assumption.</p>
<pre>// VIOLATION: Square breaks Rectangle's postcondition
public class Rectangle {
    protected int width, height;
    public void setWidth(int w)  { width = w; }
    public void setHeight(int h) { height = h; }
    public int area() { return width * height; }
}

public class Square extends Rectangle {
    @Override public void setWidth(int w)  { width = height = w; }
    @Override public void setHeight(int h) { width = height = h; }
}

// Caller expects area == 20 — gets 16 with a Square
void resize(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.area() == 20;  // FAILS when r is a Square
}</pre>
<p>A payment analog: a <code>ReadOnlyLedger</code> subclassing <code>Ledger</code> but throwing on <code>post()</code> strengthens preconditions to the point of failure — any code holding a <code>Ledger</code> can now crash unexpectedly.</p>
<pre>// VIOLATION: ReadOnlyLedger cannot substitute Ledger
public class Ledger {
    public void post(LedgerEntry entry) { /* append to log */ }
}

public class ReadOnlyLedger extends Ledger {
    @Override
    public void post(LedgerEntry entry) {
        throw new UnsupportedOperationException("read-only");
    }
}

void reconcile(Ledger ledger) {
    ledger.post(new LedgerEntry("adjustment", 100));  // crashes with ReadOnlyLedger
}</pre>` },
    { title: `How to fix violations`, body: `<p>When a subtype cannot honor the contract, the inheritance is wrong, not the caller. Options: make the base abstraction weaker so both types genuinely satisfy it, replace inheritance with composition, or split the hierarchy so the incompatible operation lives only where it is valid.</p>
<pre>// FIX: weaker abstraction both types satisfy
public interface Shape {
    int area();
}

public record Rectangle(int width, int height) implements Shape {
    public int area() { return width * height; }
}

public record Square(int side) implements Shape {
    public int area() { return side * side; }
}

// FIX: composition for read-only view
public final class ReadOnlyLedgerView {
    private final Ledger ledger;
    public ReadOnlyLedgerView(Ledger ledger) { this.ledger = ledger; }
    public List&lt;LedgerEntry&gt; entries() { return List.copyOf(ledger.getEntries()); }
    // no post() — callers that need write access use Ledger directly
}</pre>
<p>LSP is the principle that makes polymorphism and the Open/Closed Principle trustworthy — without it, "extending" a type quietly breaks its clients.</p>` },
  ],
  related: ["polymorphism", "open-closed-principle", "inheritance-pitfalls", "composition-over-inheritance"],
});

export const meta = topic.meta;
export const content = topic.content;
