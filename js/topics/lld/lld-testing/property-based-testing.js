// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "property-based-testing",
  title: "Property-Based Testing",
  category: "lld-testing",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Instead of hand-picking examples, state an invariant that must hold for all inputs and let a generator hunt for a counterexample.`,
  sections: [
    { title: `From examples to properties`, body: `<p>Example-based tests assert on inputs <em>you</em> thought of: <code>split(100, 3)</code> should give <code>[34, 33, 33]</code>. Bugs hide in the cases you did not imagine — negative amounts, zero shares, huge values, rounding boundaries. <b>Property-based testing (PBT)</b> flips this: you describe a <b>property</b> (an invariant true for every valid input) and a framework — QuickCheck, fast-check, Hypothesis, <b>jqwik</b> — generates hundreds of random inputs trying to break it.</p>
<p>For money splitting the property is not a specific output but a rule: <em>the parts always sum back to the original</em>. The framework then throws thousands of amounts and share-counts at your function looking for one where the sum is off by a cent.</p>
<pre>// Production code — split a payment total across N recipients
public final class PaymentSplitter {

    private PaymentSplitter() {}

    public static List&lt;Long&gt; splitEvenly(long totalCents, int parts) {
        if (parts &lt;= 0) throw new IllegalArgumentException("parts must be positive");
        if (totalCents &lt; 0) throw new IllegalArgumentException("total cannot be negative");
        long base = totalCents / parts;
        long remainder = totalCents % parts;
        List&lt;Long&gt; result = new ArrayList&lt;&gt;(parts);
        for (int i = 0; i &lt; parts; i++) {
            result.add(base + (i &lt; remainder ? 1 : 0));
        }
        return result;
    }
}</pre>` },
    { title: `The three moving parts`, body: `<p>A property-based test is built from three pieces that work together:</p>
<ol>
<li><b>Generators</b> — describe the space of valid inputs (e.g. integers 0–10⁹, share counts 1–100). The framework samples from these, biasing toward edge values like 0, 1, and max.</li>
<li><b>The property (invariant)</b> — a boolean assertion that must hold for every generated input. Common shapes: <em>round-trip</em> (<code>decode(encode(x)) == x</code>), <em>conservation</em> (splits sum to the total), <em>idempotence</em> (applying twice equals once), and comparison against a simple <em>oracle</em>.</li>
<li><b>Shrinking</b> — when a counterexample is found, the framework automatically <em>reduces</em> it to the smallest failing case, so instead of "fails at 987654321 split 47 ways" you get "fails at 10 split 3 ways" — a minimal, debuggable example.</li>
</ol>
<pre>import net.jqwik.api.*;
import static org.junit.jupiter.api.Assertions.*;

class PaymentSplitterPropertyTest {

    @Property
    void partsAlwaysSumToTotal(
            @ForAll @LongRange(min = 0, max = 1_000_000_000) long totalCents,
            @ForAll @IntRange(min = 1, max = 100) int parts) {

        List&lt;Long&gt; shares = PaymentSplitter.splitEvenly(totalCents, parts);
        long sum = shares.stream().mapToLong(Long::longValue).sum();

        assertEquals(totalCents, sum);
        assertEquals(parts, shares.size());
        assertTrue(shares.stream().allMatch(s -&gt; s &gt;= 0));
    }

    @Property
    void noShareDiffersByMoreThanOneCent(
            @ForAll @LongRange(min = 0, max = 1_000_000) long totalCents,
            @ForAll @IntRange(min = 1, max = 50) int parts) {

        List&lt;Long&gt; shares = PaymentSplitter.splitEvenly(totalCents, parts);
        long min = shares.stream().mapToLong(Long::longValue).min().orElse(0);
        long max = shares.stream().mapToLong(Long::longValue).max().orElse(0);
        assertTrue(max - min &lt;= 1, "shares must differ by at most 1 cent");
    }
}</pre>` },
    { title: `Structure of a test and where it shines`, body: `<p>Shrinking is what makes this practical: a raw random failure is noise, but the minimized counterexample usually points straight at the bug. Suppose a buggy implementation used floating-point division — jqwik would shrink to something like <code>totalCents=10, parts=3</code> where the sum is 9 instead of 10.</p>
<pre>    @Property
    void roundTrip_encodeDecodePaymentId(@ForAll("paymentIds") String paymentId) {
        String encoded = PaymentIdCodec.encode(paymentId);
        assertEquals(paymentId, PaymentIdCodec.decode(encoded));
    }

    @Provide
    Arbitrary&lt;String&gt; paymentIds() {
        return Arbitraries.strings()
            .withCharRange('a', 'z')
            .ofMinLength(8).ofMaxLength(32)
            .map(s -&gt; "pay_" + s);
    }</pre>
<p>PBT excels on code with clear algebraic invariants — serializers, parsers, money and rounding, sorting, state machines, and data structures. It complements example tests rather than replacing them; keep a few named examples as living documentation and let properties cover the vast input space you would never enumerate by hand. Seed the RNG in CI so a failing case is reproducible:</p>
<pre>// junit-platform.properties
jqwik.tries.default = 500
jqwik.report.onlyfailures = true</pre>` },
  ],
  related: ["unit-integration-contract", "tdd-for-lld", "mutation-testing"],
});

export const meta = topic.meta;
export const content = topic.content;
