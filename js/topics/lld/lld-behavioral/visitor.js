// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const DD_SVG = `<svg viewBox="0 0 580 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visitor double dispatch">
  <defs><marker id="fig-visitor-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="120" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.4"/>
  <text x="80" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">caller</text>
  <text x="80" y="105" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">accept(visitor)</text>
  <rect x="200" y="60" width="160" height="60" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="280" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">CardTransaction</text>
  <text x="280" y="100" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">accept(v){ v.visitCard(this) }</text>
  <rect x="420" y="60" width="150" height="60" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="495" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">TaxReportVisitor</text>
  <text x="495" y="100" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">visitCard(txn){ … }</text>
  <line x1="140" y1="90" x2="198" y2="90" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-visitor-arr)"/>
  <text x="168" y="82" fill="#93a1bd" font-size="8" font-family="system-ui">1</text>
  <line x1="360" y1="90" x2="418" y2="90" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-visitor-arr)"/>
  <text x="388" y="82" fill="#93a1bd" font-size="8" font-family="system-ui">2</text>
  <text x="300" y="150" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">double dispatch: element picks the type, visitor picks the operation</text>
</svg>`;

const topic = makeTopic({
  id: "visitor",
  title: "Visitor",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Add new operations over a fixed set of element types without editing those types — by moving the operation into a visitor and using double dispatch.`,
  sections: [
    { title: `Intent`, body: `<p><b>Visitor</b> represents an operation to be performed on the elements of an object structure, letting you define a new operation without changing the element classes. It concentrates a family of related behaviour in one visitor object rather than scattering it across the element types.</p>
<p>Say a ledger holds several transaction types — <code>CardTransaction</code>, <code>WalletTransfer</code>, <code>RefundEntry</code>, <code>FeeEntry</code>. You keep needing new cross-cutting reports over them: tax reporting, settlement export, fraud scoring. Adding each as a method on every transaction class bloats those classes with unrelated concerns. Visitor turns each report into its own object instead.</p>
<pre>// --- Element: each transaction type accepts visitors ---
public interface Transaction {
    void accept(TransactionVisitor visitor);
}

public final class CardTransaction implements Transaction {
    private final String merchantId;
    private final Money amount;
    private final String cardNetwork;

    @Override
    public void accept(TransactionVisitor visitor) {
        visitor.visitCard(this);  // double dispatch step 1
    }
    // getters…
}</pre>` },
    { title: `Participants and double dispatch`, figureAfter: "visitor-dd", body: `<p>Four roles collaborate through a two-step call:</p>
<ul>
<li><b>Visitor</b> — an interface with one method per element type: <code>visitCard()</code>, <code>visitWalletTransfer()</code>, etc.</li>
<li><b>Concrete Visitors</b> — <code>TaxReportVisitor</code>, <code>SettlementExportVisitor</code>.</li>
<li><b>Element</b> — an interface with <code>accept(visitor)</code>.</li>
<li><b>Concrete Elements</b> — each implements <code>accept(v)</code> as <code>v.visitCard(this)</code>.</li>
</ul>
<pre>// --- Visitor: one method per element type ---
public interface TransactionVisitor {
    void visitCard(CardTransaction txn);
    void visitWalletTransfer(WalletTransfer txn);
    void visitRefund(RefundEntry txn);
    void visitFee(FeeEntry txn);
}

// --- Concrete visitor: accumulates a tax report ---
public final class TaxReportVisitor implements TransactionVisitor {
    private final Map&lt;String, Money&gt; taxByMerchant = new HashMap&lt;&gt;();

    @Override
    public void visitCard(CardTransaction txn) {
        Money tax = txn.amount().multiply(0.08);
        taxByMerchant.merge(txn.merchantId(), tax, Money::add);
    }

    @Override
    public void visitRefund(RefundEntry txn) {
        taxByMerchant.merge(txn.merchantId(), txn.amount().negate(), Money::add);
    }

    // visitWalletTransfer, visitFee similarly…

    public Map&lt;String, Money&gt; report() { return taxByMerchant; }
}</pre>
<p>This is <b>double dispatch</b>: the element's dynamic type selects which <code>accept</code> runs, and inside it the call selects which visitor method runs — so the executed behaviour depends on <em>both</em> the element type and the visitor type.</p>` },
    { title: `Implementation flow`, body: `<p>A traversal applies one visitor across the whole structure:</p>
<ol>
<li>Build a visitor: <code>TaxReportVisitor tax = new TaxReportVisitor()</code>.</li>
<li>Walk the elements (often via <b>Iterator</b> or <b>Composite</b>) calling <code>entry.accept(tax)</code>.</li>
<li>Each element dispatches to the matching method — <code>tax.visitCard(this)</code>, <code>tax.visitFee(this)</code> — accumulating the report inside the visitor.</li>
</ol>
<pre>// --- Traversal: apply visitor to every transaction ---
public Map&lt;String, Money&gt; generateTaxReport(List&lt;Transaction&gt; ledger) {
    TaxReportVisitor visitor = new TaxReportVisitor();
    for (Transaction txn : ledger) {
        txn.accept(visitor);
    }
    return visitor.report();
}</pre>
<p>Adding a whole new report is now one new class; the element classes never change.</p>` },
    { title: `The expression-problem trade-off`, body: `<p>Visitor makes one axis cheap and the other expensive. <b>Adding operations</b> is easy — write a new visitor. <b>Adding element types</b> is painful — every existing visitor must gain a new <code>visit</code> method, or fail to compile. Plain OOP (methods on the classes) is the reverse: easy to add types, costly to add operations across all of them. This is the classic <em>expression problem</em>; choose Visitor when the set of element types is <b>stable</b> but the operations grow.</p>
<p>Other costs: visitors often need access to element internals, weakening encapsulation, and the <code>accept</code>/<code>visit</code> boilerplate is verbose. Do not use it when your element hierarchy is still churning.</p>` },
  ],
  figures: [
    { id: "visitor-dd", svg: DD_SVG, caption: "accept() dispatches on the element type, then calls the visitor method — double dispatch selects behaviour from both types." },
  ],
  related: ["composite", "iterator", "interpreter", "strategy"],
});

export const meta = topic.meta;
export const content = topic.content;
