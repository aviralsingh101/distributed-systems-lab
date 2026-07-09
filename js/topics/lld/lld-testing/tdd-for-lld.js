// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const CYCLE_SVG = `<svg viewBox="0 0 460 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Red green refactor cycle">
  <defs><marker id="fig-tdd-for-lld-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <rect x="20" y="60" width="110" height="46" rx="8" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.6"/>
  <text x="75" y="80" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">RED</text>
  <text x="75" y="96" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">failing test</text>
  <rect x="175" y="60" width="110" height="46" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.6"/>
  <text x="230" y="80" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">GREEN</text>
  <text x="230" y="96" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">make it pass</text>
  <rect x="330" y="60" width="110" height="46" rx="8" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/>
  <text x="385" y="80" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">REFACTOR</text>
  <text x="385" y="96" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">clean, stay green</text>
  <line x1="130" y1="83" x2="173" y2="83" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-tdd-for-lld-arr)"/>
  <line x1="285" y1="83" x2="328" y2="83" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-tdd-for-lld-arr)"/>
  <path d="M385,60 C385,25 75,25 75,58" fill="none" stroke="#93a1bd" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#fig-tdd-for-lld-arr)"/>
  <text x="230" y="20" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">repeat, one tiny behaviour at a time</text>
</svg>`;

const topic = makeTopic({
  id: "tdd-for-lld",
  title: "TDD for LLD",
  category: "lld-testing",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Write the failing test first, make it pass with the simplest code, then refactor — letting tests drive the shape of your classes.`,
  figures: [
    { id: "tdd-cycle", svg: CYCLE_SVG, caption: "Red → Green → Refactor: the loop is deliberately tiny, repeated once per small behaviour." },
  ],
  sections: [
    { title: `The red-green-refactor loop`, figureAfter: "tdd-cycle", body: `<p><b>Test-Driven Development</b> inverts the usual order: you write a test <em>before</em> the code it exercises. The loop has three steps and each one is small on purpose.</p>
<ol>
<li><b>Red</b> — write one failing test that states a behaviour you want (e.g. "a charge of 0 is rejected"). It fails to compile or asserts wrong; that failure proves the test can detect the absence of the feature.</li>
<li><b>Green</b> — write the <em>simplest</em> code that makes the test pass, even if it is ugly or hard-codes a value. The goal is a passing bar, not elegance.</li>
<li><b>Refactor</b> — with a green safety net, clean up duplication and improve names and structure, re-running the test after each change to stay green.</li>
</ol>
<p>You repeat this loop many times a session, growing the implementation one tiny verified behaviour at a time.</p>` },
    { title: `TDD cycle on a payment fee calculator`, body: `<p>Applied to a payment fee calculator, TDD might look like this — each step is one loop:</p>
<pre>// RED — test first, class does not exist yet
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FeeScheduleTest {

    @Test
    void zeroAmount_hasZeroFee() {
        FeeSchedule schedule = new FeeSchedule(0, 0.0);
        assertEquals(0L, schedule.computeFeeCents(0));
    }
}</pre>
<pre>// GREEN — simplest passing implementation
public class FeeSchedule {
    private final long flatFeeCents;
    private final double percentageRate;

    public FeeSchedule(long flatFeeCents, double percentageRate) {
        this.flatFeeCents = flatFeeCents;
        this.percentageRate = percentageRate;
    }

    public long computeFeeCents(long amountCents) {
        if (amountCents == 0) return 0;
        return flatFeeCents;   // hard-coded stub — good enough for green
    }
}</pre>
<pre>// RED again — triangulate with a second example
    @Test
    void flatFeeOnly_whenPercentageIsZero() {
        FeeSchedule schedule = new FeeSchedule(30, 0.0);
        assertEquals(30L, schedule.computeFeeCents(1000));
    }

// GREEN — generalize
    public long computeFeeCents(long amountCents) {
        if (amountCents == 0) return 0;
        return flatFeeCents + Math.round(amountCents * percentageRate);
    }</pre>` },
    { title: `Why it shapes low-level design`, body: `<p>TDD's real payoff for LLD is not coverage — it is <b>design pressure</b>. To write a test first you must decide, from the caller's side, what the class is called, what its method signature is, and what it returns. Code that is hard to test is usually hard to <em>use</em>: a class that reaches out to a static clock, opens its own database connection, or does five things at once resists being instantiated in a test.</p>
<pre>// REFACTOR — extract tiered pricing behind a clean interface
public interface FeePolicy {
    long feeCents(long amountCents);
}

public final class FlatPlusPercentageFee implements FeePolicy {
    private final long flatFeeCents;
    private final double rate;

    public FlatPlusPercentageFee(long flatFeeCents, double rate) {
        this.flatFeeCents = flatFeeCents;
        this.rate = rate;
    }

    @Override
    public long feeCents(long amountCents) {
        if (amountCents &lt;= 0) return 0;
        return flatFeeCents + Math.round(amountCents * rate);
    }
}

public final class TieredFee implements FeePolicy {
    private final NavigableMap&lt;Long, Double&gt; tiers;  // threshold -&gt; rate

    @Override
    public long feeCents(long amountCents) {
        if (amountCents &lt;= 0) return 0;
        double rate = tiers.floorEntry(amountCents).getValue();
        return Math.round(amountCents * rate);
    }
}</pre>
<p>That friction pushes you toward small units with <b>injected dependencies</b> and clear seams — exactly the structure that dependency injection and the test-doubles vocabulary support. In effect, the test is the first client of your API, so the API ends up shaped for its callers.</p>` },
    { title: `Discipline and pitfalls`, body: `<p>Follow the flow strictly: do not write production code without a failing test demanding it, and do not write more test than is needed to fail. Triangulate — add a second and third example to force a general implementation rather than a hard-coded return. Keep tests fast and isolated so the loop stays sub-second; a slow suite kills the rhythm.</p>
<p>Common failure modes: writing tests <em>after</em> the code (that is just testing, not TDD, and misses the design feedback); testing private methods instead of observable behaviour; and skipping the refactor step so the design never actually improves. Each rule in a <code>FeeSchedule</code> or <code>ChargeService</code> should be pinned by a test before it exists — zero-fee case, flat fee, percentage tier, overdraft rejection — one red-green-refactor loop per behaviour.</p>` },
  ],
  related: ["test-doubles", "unit-integration-contract", "single-responsibility-principle"],
});

export const meta = topic.meta;
export const content = topic.content;
