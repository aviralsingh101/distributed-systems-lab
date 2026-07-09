// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "dry-principle",
  title: "DRY",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Every piece of knowledge should have a single, authoritative representation in the system — duplicate knowledge, not just duplicate text, is the enemy.`,
  sections: [
    { title: `What DRY actually says`, body: `<p><b>DRY</b> — Don't Repeat Yourself, from Hunt and Thomas's <em>The Pragmatic Programmer</em> — states that <em>every piece of knowledge must have a single, unambiguous, authoritative representation within a system</em>. The important word is <b>knowledge</b>. DRY is about duplicated <em>decisions and rules</em>, not merely lines of text that happen to look alike.</p>
<p>When one business rule — say, how a settlement fee is computed — lives in three places, a change requires finding and editing all three. Miss one and the system becomes inconsistent. Centralizing that rule means the change is made once and applied everywhere.</p>` },
    { title: `How it works — violation vs fix`, body: `<p>You apply DRY by locating each piece of knowledge and giving it one home: a function for a shared algorithm, a constant for a magic value, a single schema or type as the source of truth. Then every consumer references that one definition rather than restating it.</p>
<pre>// VIOLATION: fee formula duplicated in three places
public class CheckoutHandler {
    public int totalWithFee(Order order) {
        int fee = (int) (order.totalCents() * 0.029);  // duplicated knowledge
        return order.totalCents() + fee;
    }
}

public class RefundService {
    public int feeOnRefund(Order order) {
        return (int) (order.totalCents() * 0.029);  // same formula, copy-pasted
    }
}

public class NightlyReport {
    public int settlementFee(Order order) {
        return (int) (order.totalCents() * 0.029);  // third copy — drift risk
    }
}</pre>
<p>Centralize the knowledge in one authoritative place:</p>
<pre>public final class SettlementFeeCalculator {
    private static final double CARD_FEE_RATE = 0.029;

    public int computeFee(int totalCents) {
        return (int) (totalCents * CARD_FEE_RATE);
    }
}

// All three callers reference the single source of truth
public class CheckoutHandler {
    private final SettlementFeeCalculator feeCalc;
    public int totalWithFee(Order order) {
        return order.totalCents() + feeCalc.computeFee(order.totalCents());
    }
}</pre>
<p>Now a regulatory change to the fee formula is a one-line edit in <code>SettlementFeeCalculator</code> with no risk of drift between checkout, refund, and reporting paths.</p>` },
    { title: `The false-positive trap`, body: `<p>The subtle failure of DRY is <b>coincidental duplication</b> — two snippets that look identical today but represent <em>different</em> knowledge that will evolve independently. Merging them couples unrelated concepts: a change demanded by one caller is forced onto the other.</p>
<pre>// These LOOK identical but encode DIFFERENT knowledge
public int maxRetriesForPayment() { return 3; }   // gateway SLA policy
public int maxRetriesForEmail()    { return 3; }   // email provider policy

// WRONG: merge because "both return 3"
public int maxRetries() { return 3; }  // now payment and email MUST change together

// RIGHT: keep separate — they will diverge when policies differ
public int maxPaymentRetries() { return 3; }
public int maxEmailRetries()    { return 3; }</pre>
<p>The test is not textual similarity but whether the two places encode the <em>same decision</em>. If they would always change together, unify them; if they merely resemble each other now, leave them apart.</p>` },
    { title: `Balance and related ideas`, body: `<p>DRY trades a little indirection for consistency, and it pairs with the "Rule of Three": tolerate a duplication once or twice, and abstract when the third occurrence confirms the pattern is real. Over-eager DRY collides with KISS and YAGNI by inventing abstractions before the knowledge has stabilized. Applied to genuine shared knowledge, though, DRY is one of the highest-leverage habits for keeping a system correct as it changes.</p>` },
  ],
  related: ["single-responsibility-principle", "kiss-yagni-principles", "open-closed-principle", "abstraction"],
});

export const meta = topic.meta;
export const content = topic.content;
