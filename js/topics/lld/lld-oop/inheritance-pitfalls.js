// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "inheritance-pitfalls",
  title: "Inheritance Pitfalls",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Implementation inheritance is the tightest coupling in OOP; used for reuse rather than true subtyping, it produces fragile, rigid hierarchies.`,
  sections: [
    { title: `Why inheritance is risky`, body: `<p>Class inheritance is powerful but it is the <b>strongest form of coupling</b> a language offers. A subclass sees the base class's protected fields and methods, overrides its behavior, and depends on the order in which the base calls its own methods. That means the base and its subclasses are one tightly bound unit — a change to the base can break subclasses that were written and tested long ago.</p>
<p>Most abuse comes from using inheritance for <em>code reuse</em> ("I want those methods") rather than for a real <b>is-a</b> subtype relationship. Reuse is a has-a concern, better served by composition.</p>` },
    { title: `The fragile base class problem — how it works`, body: `<p>This is the canonical pitfall. Suppose a base <code>Ledger.recordAll(entries)</code> loops calling its own <code>record(e)</code>. A subclass overrides <code>record</code> to add validation. Later someone "optimizes" the base so <code>recordAll</code> writes entries directly instead of calling <code>record</code> — a change that looks internal and safe. The subclass's validation is now silently bypassed. The base changed its <em>self-call pattern</em>, an implementation detail the subclass unknowingly depended on, and correctness broke without any compile error.</p>
<pre>// Base class — looks innocent
public class Ledger {
    protected final List&lt;LedgerEntry&gt; entries = new ArrayList&lt;&gt;();

    public void record(LedgerEntry entry) {
        entries.add(entry);
    }

    public void recordAll(List&lt;LedgerEntry&gt; batch) {
        for (LedgerEntry e : batch) {
            record(e);  // self-call — subclass hooks in here
        }
    }
}

// Subclass adds compliance validation by overriding record()
public class ValidatedLedger extends Ledger {
    @Override
    public void record(LedgerEntry entry) {
        if (entry.amountCents() &lt; 0) {
            throw new IllegalArgumentException("negative amounts require approval");
        }
        super.record(entry);
    }
}</pre>
<p>Now a well-meaning "optimization" in the base class bypasses the subclass entirely:</p>
<pre>// "Optimized" base — BREAKS ValidatedLedger silently
public void recordAll(List&lt;LedgerEntry&gt; batch) {
    entries.addAll(batch);  // never calls record() — validation skipped!
}</pre>
<p>No compile error, no test failure if nobody exercises <code>ValidatedLedger</code> through <code>recordAll</code>. The subclass assumed a self-call contract the base never documented.</p>` },
    { title: `Deep and wide hierarchies`, body: `<p>Two more failure modes appear as hierarchies grow. <b>Deep trees</b> make behavior hard to trace: to understand one method you must read every ancestor, and a field's meaning may be set five levels up. <b>The subclass explosion</b> arises when objects vary along several independent axes at once — payment method × currency × channel — and a single inheritance tree can only encode one axis, forcing a class per combination.</p>
<pre>// Subclass explosion: one class per (method × region) pair
public abstract class PaymentProcessor { /* ... */ }
public class StripeUsProcessor extends PaymentProcessor { /* ... */ }
public class StripeEuProcessor extends PaymentProcessor { /* ... */ }
public class AdyenUsProcessor extends PaymentProcessor { /* ... */ }
public class AdyenEuProcessor extends PaymentProcessor { /* ... */ }
// Adding PayPal × APAC = yet another subclass...</pre>
<p>Composition (or the Bridge/Strategy patterns) collapses these back into small, combinable parts: a <code>PaymentGateway</code> strategy plus a <code>TaxRules</code> strategy, composed at runtime rather than multiplied into subclasses.</p>` },
    { title: `Fixing and preventing`, body: `<p>Prevention and remedies: prefer <b>composition and delegation</b> for reuse; keep any inheritance shallow and rooted in a genuine, Liskov-safe is-a relationship. If you design a class for inheritance, document its self-call contract and which methods are safe to override; otherwise mark the class <code>final</code> or sealed so no one subclasses an unprepared base.</p>
<pre>// FIX: use composition — validation is explicit, not hidden in override
public final class ValidatedLedger {
    private final Ledger ledger = new Ledger();

    public void record(LedgerEntry entry) {
        if (entry.amountCents() &lt; 0) {
            throw new IllegalArgumentException("negative amounts require approval");
        }
        ledger.record(entry);
    }

    public void recordAll(List&lt;LedgerEntry&gt; batch) {
        for (LedgerEntry e : batch) {
            record(e);  // validation always runs — we own the loop
        }
    }
}</pre>
<p>Favor interfaces (behavioral contracts) over concrete base classes, and never override a method to weaken or disable behavior callers rely on — that is an LSP violation dressed up as reuse.</p>` },
  ],
  related: ["composition-over-inheritance", "liskov-substitution-principle", "polymorphism", "encapsulation"],
});

export const meta = topic.meta;
export const content = topic.content;
