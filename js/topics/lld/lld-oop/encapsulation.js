// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const CLASS_SVG = `<svg viewBox="0 0 460 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Encapsulated Wallet class">
  <rect x="120" y="20" width="220" height="160" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="230" y="42" text-anchor="middle" fill="#cdd6e8" font-size="13" font-weight="600" font-family="system-ui">Wallet</text>
  <line x1="120" y1="54" x2="340" y2="54" stroke="#26324a"/>
  <text x="134" y="76" fill="#ff6b6b" font-size="11" font-family="ui-monospace,monospace">- balanceCents: long</text>
  <text x="134" y="94" fill="#93a1bd" font-size="10" font-family="system-ui">(private: no outside access)</text>
  <line x1="120" y1="106" x2="340" y2="106" stroke="#26324a"/>
  <text x="134" y="128" fill="#3ddc97" font-size="11" font-family="ui-monospace,monospace">+ credit(Money)</text>
  <text x="134" y="146" fill="#3ddc97" font-size="11" font-family="ui-monospace,monospace">+ debit(Money)</text>
  <text x="134" y="164" fill="#3ddc97" font-size="11" font-family="ui-monospace,monospace">+ balance(): Money</text>
  <text x="230" y="196" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">State is guarded; every change goes through a method that enforces invariants</text>
</svg>`;

const topic = makeTopic({
  id: "encapsulation",
  title: "Encapsulation",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Bundle data with the methods that guard it, and expose behavior instead of raw state so invariants can never be violated from outside.`,
  sections: [
    { title: `What encapsulation is`, body: `<p><b>Encapsulation</b> bundles a class's data together with the methods that operate on it, and restricts direct access to that data from outside the class. Callers interact through a public interface while the fields stay <code>private</code>. The class becomes the sole guardian of its own <em>invariants</em> — the rules that must always hold, such as "a wallet balance is never negative".</p>
<p>The goal is not merely hiding fields; it is <b>controlling change</b>. When state can only be mutated through methods, every mutation passes through code you own, so you can validate inputs, keep derived fields consistent, and enforce rules in exactly one place.</p>` },
    { title: `How it works`, body: `<p>Encapsulation works by combining two mechanisms. First, <b>access control</b> (<code>private</code> fields with <code>public</code> methods) stops outside code from touching the internal representation. Second, a <b>narrow, intent-revealing interface</b> exposes operations like <code>debit(Money)</code> rather than representation-leaking setters like <code>setBalanceCents(long)</code>.</p>
<p>Because the representation is hidden behind methods, you can change it later — store cents as a <code>long</code> instead of <code>BigDecimal</code>, add an audit log field, or split balance into available vs held — without breaking a single caller. That is the practical payoff: encapsulation decouples the public <em>contract</em> from the private <em>implementation</em>.</p>` },
    { title: `A concrete example — Wallet`, figureAfter: "wallet-class", body: `<p>In a payment Ledger service, the <code>Wallet</code> aggregate owns the balance invariant. External services never touch the field directly:</p>
<pre>public final class Wallet {
    private final String walletId;
    private long balanceCents;          // private — no getter that exposes mutation
    private long heldCents;             // TCC Try-phase reservation

    public Wallet(String walletId, long openingBalanceCents) {
        if (openingBalanceCents &lt; 0) throw new IllegalArgumentException("negative opening balance");
        this.walletId = walletId;
        this.balanceCents = openingBalanceCents;
        this.heldCents = 0;
    }

    /** Credit available balance. Rejects non-positive amounts. */
    public void credit(Money amount) {
        requirePositive(amount);
        balanceCents += amount.cents();
    }

    /** Debit available balance. Rejects overdraft. */
    public void debit(Money amount) {
        requirePositive(amount);
        long available = balanceCents - heldCents;
        if (amount.cents() &gt; available) {
            throw new InsufficientFundsException(walletId, amount, available);
        }
        balanceCents -= amount.cents();
    }

    /** TCC Try: move funds from available into held (not yet debited). */
    public void hold(Money amount) {
        requirePositive(amount);
        long available = balanceCents - heldCents;
        if (amount.cents() &gt; available) throw new InsufficientFundsException(walletId, amount, available);
        heldCents += amount.cents();
    }

    public Money balance() {
        return Money.ofCents(balanceCents - heldCents, Currency.USD);
    }

    private static void requirePositive(Money amount) {
        if (amount.cents() &lt;= 0) throw new IllegalArgumentException("amount must be positive");
    }
}</pre>
<p>No controller, saga step, or test can set <code>balanceCents = -500</code> because the field is private and there is no public setter. The overdraft check lives in exactly one place — inside <code>debit</code> and <code>hold</code>.</p>` },
    { title: `What breaks encapsulation — anemic models`, body: `<p>The opposite of encapsulation is an <b>anemic domain model</b>: a class with public getters and setters for every field, and all business logic in separate "service" classes.</p>
<pre>// ANEMIC — logic scattered, invariants unenforced
public class AnemicWallet {
    private long balanceCents;
    public long getBalanceCents() { return balanceCents; }
    public void setBalanceCents(long v) { this.balanceCents = v; }  // anyone can set anything
}

// Service layer must remember every rule — easy to forget one code path
public class WalletService {
    public void charge(String walletId, Money amount) {
        AnemicWallet w = repo.find(walletId);
        if (amount.cents() &gt; w.getBalanceCents()) throw new InsufficientFundsException(...);
        w.setBalanceCents(w.getBalanceCents() - amount.cents());  // duplicated invariant
        repo.save(w);
    }
}</pre>
<p>Every new code path that touches <code>setBalanceCents</code> must re-implement the overdraft check. A batch job, a migration script, or a new API endpoint can skip it. Encapsulation moves the invariant <em>into</em> the object that owns the data.</p>` },
    { title: `Defensive encapsulation — leaking mutable state`, body: `<p>Even with <code>private</code> fields, you can leak the representation by returning mutable internals:</p>
<pre>public class PaymentBatch {
    private final List&lt;String&gt; paymentIds = new ArrayList&lt;&gt;();

    // LEAK: caller can mutate our internal list
    public List&lt;String&gt; getPaymentIds() { return paymentIds; }

    // FIX: return an unmodifiable view
    public List&lt;String&gt; paymentIds() {
        return Collections.unmodifiableList(paymentIds);
    }

    public void addPayment(String id) {
        paymentIds.add(id);  // only we control mutation
    }
}</pre>
<p>Returning <code>Collections.unmodifiableList</code> or a copy preserves encapsulation: callers can read but cannot add or remove entries behind your back. The same rule applies to exposing internal <code>Map</code>s, arrays, and JPA-managed collections.</p>` },
    { title: `Pitfalls and limits`, body: `<p>Encapsulation is representation hiding for <em>maintainability</em>, not a security boundary. Java reflection (<code>setAccessible(true)</code>) or serialization frameworks can reach private fields — do not rely on encapsulation alone for security-sensitive data (use encryption at rest, access controls).</p>
<p>In distributed systems, encapsulation is <b>per JVM</b>. Two Order Service pods each hold their own in-memory state; wallet balance belongs in the Ledger database, not in a Singleton field. Encapsulation governs how one process structures its objects; persistence and consensus govern cross-process correctness.</p>` },
  ],
  figures: [
    { id: "wallet-class", svg: CLASS_SVG, caption: `Wallet exposes credit/debit/balance but hides balanceCents and heldCents. Every mutation is forced through a method that checks the invariant.` },
  ],
  related: ["abstraction", "single-responsibility-principle", "inheritance-pitfalls", "value-objects"],
});

export const meta = topic.meta;
export const content = topic.content;
