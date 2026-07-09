// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "single-responsibility-principle",
  title: "Single Responsibility",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `A module should have exactly one reason to change — it should be responsible to a single actor or stakeholder.`,
  sections: [
    { title: `The formal statement`, body: `<p>The <b>Single Responsibility Principle (SRP)</b>, the "S" in SOLID, is often mis-quoted as "a class should do one thing". Robert Martin's precise formulation is sharper: <em>a module should have one, and only one, reason to change</em>, where a "reason to change" means being answerable to a single <b>actor</b> — a group of people who request changes for the same business reason.</p>
<p>So SRP is about <b>who</b> asks for changes, not how many methods a class has. A class serves finance, operations, and reporting? Those are three actors, three reasons to change, and therefore an SRP violation even if the code is small.</p>` },
    { title: `How it works in practice — violation vs fix`, body: `<p>You apply SRP by asking, for each class, "which stakeholders drive edits here?" When two unrelated stakeholders touch the same class, their changes collide: a tweak requested by the reporting team can break logic the compliance team depends on, because they share the same file and state.</p>
<pre>// VIOLATION: PaymentRecord serves finance AND customer-facing teams
public class PaymentRecord {
    private String paymentId;
    private int amountCents;
    private String currency;
    private double settlementFeeRate;  // finance actor changes this

    // Finance actor: fee calculation logic
    public int computeSettlementFee() {
        return (int) (amountCents * settlementFeeRate);
    }

    // Customer-facing actor: receipt formatting
    public String formatReceipt() {
        return "Receipt for " + paymentId + ": "
            + (amountCents / 100.0) + " " + currency
            + " (fee: " + computeSettlementFee() / 100.0 + ")";
    }

    // Compliance actor: audit export format — third reason to change!
    public String toAuditCsv() {
        return paymentId + "," + amountCents + "," + currency;
    }
}</pre>
<p>Split along actor boundaries so each class changes only when its stakeholder asks:</p>
<pre>// FIX: each class has one reason to change
public record PaymentRecord(String paymentId, int amountCents, String currency) {}

public class SettlementFeeCalculator {
    private final double feeRate;
    public SettlementFeeCalculator(double feeRate) { this.feeRate = feeRate; }

    public int computeFee(PaymentRecord record) {
        return (int) (record.amountCents() * feeRate);
    }
}

public class ReceiptFormatter {
    public String format(PaymentRecord record, int feeCents) {
        return "Receipt for " + record.paymentId() + ": "
            + (record.amountCents() / 100.0) + " " + record.currency()
            + " (fee: " + feeCents / 100.0 + ")";
    }
}</pre>
<p>When finance changes the fee formula, only <code>SettlementFeeCalculator</code> changes. When marketing wants a new receipt layout, only <code>ReceiptFormatter</code> changes. Neither can accidentally break the other.</p>` },
    { title: `Why it reduces risk`, body: `<p>Mixing responsibilities creates <b>coupling through shared code</b>. Two teams editing one class produce merge conflicts, entangled tests, and surprise regressions. SRP localizes the blast radius: a change requested by one actor lives in one place, so it is easy to find, test in isolation, and reason about. Cohesion goes up (everything in the class serves one purpose) and accidental coupling goes down.</p>
<pre>// Orchestrator composes single-responsibility pieces
public class PaymentService {
    private final SettlementFeeCalculator feeCalc;
    private final ReceiptFormatter receiptFormatter;

    public PaymentResult process(PaymentRecord record) {
        int fee = feeCalc.computeFee(record);
        String receipt = receiptFormatter.format(record, fee);
        return new PaymentResult(record, fee, receipt);
    }
}</pre>
<p>The orchestrator has one job: wire the workflow. Each collaborator has one job: fee math or receipt layout.</p>` },
    { title: `Getting the granularity right`, body: `<p>SRP is easy to over-apply. Shattering a class into a dozen one-method fragments creates its own problem — the logic that belongs together is now scattered, and following a single request means hopping across files. The heuristic is the actor, not line count: keep code that changes for the same reason together, and split code that changes for different reasons apart. Related principles (cohesion, separation of concerns) point the same way at different scales.</p>` },
  ],
  related: ["open-closed-principle", "interface-segregation-principle", "dry-principle", "encapsulation"],
});

export const meta = topic.meta;
export const content = topic.content;
