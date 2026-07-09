// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "mutation-testing",
  title: "Mutation Testing",
  category: "lld-testing",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Deliberately introduce small bugs into your code and measure how many your test suite catches — a test of your tests, not your code.`,
  sections: [
    { title: `Testing the tests`, body: `<p>Line coverage lies. A test can <em>execute</em> a line without asserting anything about it, so 90% coverage can hide a suite that would not notice if the code were wrong. <b>Mutation testing</b> measures what coverage cannot: whether your assertions are strong enough to <em>detect</em> defects.</p>
<p>The idea is to systematically inject small faults — <b>mutants</b> — into the production code, one at a time, and re-run the tests against each mutated version. If a test fails, the mutant is <b>killed</b> (good — your suite caught the bug). If all tests still pass, the mutant <b>survives</b> (bad — a real bug of that shape would ship unnoticed).</p>` },
    { title: `Mutation operators and the flow`, body: `<p>A mutation-testing tool (Stryker, <b>PIT</b>, mutmut, Cosmic Ray) applies mechanical <b>mutation operators</b> to the AST. Typical ones:</p>
<ul>
<li>Flip a relational operator: <code>a &gt;= b</code> becomes <code>a &gt; b</code>.</li>
<li>Swap arithmetic: <code>total - fee</code> becomes <code>total + fee</code>.</li>
<li>Negate a condition, or replace it with <code>true</code>/<code>false</code>.</li>
<li>Remove a statement (e.g. delete a method call for its side effect).</li>
<li>Mutate a return or a boundary constant.</li>
</ul>
<p>The implementation flow: (1) run the suite once to confirm it is green and to record which tests touch which lines; (2) generate mutants; (3) for each mutant, run only the covering tests; (4) tally kills vs survivors. The headline metric is the <b>mutation score</b> = killed ÷ (total − equivalent).</p>
<pre>// Production code under test — payment fee rounding
public final class PaymentFeeCalculator {
    private final long flatFeeCents;
    private final double percentageRate;   // e.g. 0.029 for 2.9%

    public PaymentFeeCalculator(long flatFeeCents, double percentageRate) {
        this.flatFeeCents = flatFeeCents;
        this.percentageRate = percentageRate;
    }

    public long computeFeeCents(long amountCents) {
        if (amountCents &lt;= 0) return 0;
        long percentageFee = Math.round(amountCents * percentageRate);
        return flatFeeCents + percentageFee;
    }

    public boolean allowsOverdraft(long balanceCents, long chargeCents) {
        return balanceCents &gt;= chargeCents;   // mutant: &gt; instead of &gt;=
    }
}</pre>
<p>PIT mutates bytecode in place and runs only the tests that cover each mutated line, which keeps the loop tractable on a CI machine.</p>` },
    { title: `JUnit tests and what PIT reveals`, body: `<p>Here is a test suite that covers the fee calculator but leaves boundary gaps PIT will expose:</p>
<pre>import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PaymentFeeCalculatorTest {

    @Test
    void zeroAmount_returnsZeroFee() {
        var calc = new PaymentFeeCalculator(30, 0.029);
        assertEquals(0, calc.computeFeeCents(0));
    }

    @Test
    void positiveAmount_includesFlatAndPercentage() {
        var calc = new PaymentFeeCalculator(30, 0.029);
        // $10.00 charge: 30¢ flat + 29¢ percentage = 59¢
        assertEquals(59, calc.computeFeeCents(1000));
    }

    @Test
    void exactBalance_allowsCharge() {
        var calc = new PaymentFeeCalculator(30, 0.029);
        assertTrue(calc.allowsOverdraft(500, 500));
    }
    // MISSING: allowsOverdraft(499, 500) should be false
}</pre>
<p>When PIT flips <code>&gt;=</code> to <code>&gt;</code> in <code>allowsOverdraft</code>, all three tests still pass — the mutant <b>survives</b>. The fix is a boundary test:</p>
<pre>    @Test
    void balanceOneCentShort_rejectsCharge() {
        var calc = new PaymentFeeCalculator(30, 0.029);
        assertFalse(calc.allowsOverdraft(499, 500));
    }</pre>
<p>That single test kills the relational-operator mutant. Mutation testing turns "I should add more tests" into "add <em>this</em> assertion at <em>this</em> boundary."</p>` },
    { title: `Reading survivors, and the costs`, body: `<p>Every <b>surviving mutant</b> is a concrete, actionable gap: "I changed <code>&gt;=</code> to <code>&gt;</code> in the overdraft check and no test complained" tells you to add a boundary test at exactly that limit. This is far more useful than a coverage percentage — it names the missing assertion.</p>
<pre>// pom.xml — scope PIT to high-value payment modules only
&lt;plugin&gt;
  &lt;groupId&gt;org.pitest&lt;/groupId&gt;
  &lt;artifactId&gt;pitest-maven&lt;/artifactId&gt;
  &lt;version&gt;1.15.0&lt;/version&gt;
  &lt;configuration&gt;
    &lt;targetClasses&gt;
      &lt;param&gt;com.acme.payments.fee.*&lt;/param&gt;
      &lt;param&gt;com.acme.payments.wallet.*&lt;/param&gt;
    &lt;/targetClasses&gt;
    &lt;targetTests&gt;
      &lt;param&gt;com.acme.payments.*Test&lt;/param&gt;
    &lt;/targetTests&gt;
    &lt;mutationThreshold&gt;80&lt;/mutationThreshold&gt;
    &lt;threads&gt;4&lt;/threads&gt;
  &lt;/configuration&gt;
&lt;/plugin&gt;</pre>
<p>Two costs to manage. First, <b>speed</b>: naively you run the suite once per mutant, so tools rely on test selection, parallelism, and incremental analysis on changed files only. Second, <b>equivalent mutants</b> — a mutation that produces behaviour indistinguishable from the original (e.g. changing a value that is later overwritten). These can never be killed and must be excluded by hand, which is the main source of toil. Use mutation testing on high-value, logic-dense code — a payment fee/rounding engine, an authorization check — rather than the whole repo, and gate CI on the mutation score of just those critical modules.</p>` },
  ],
  related: ["property-based-testing", "unit-integration-contract", "tdd-for-lld"],
});

export const meta = topic.meta;
export const content = topic.content;
