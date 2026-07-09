// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const RW_SVG = `<svg viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reader-writer lock states">
  <rect x="30" y="55" width="200" height="50" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="130" y="76" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">shared (read) mode</text>
  <text x="130" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">R1 · R2 · R3 concurrent</text>
  <rect x="490" y="55" width="200" height="50" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="590" y="76" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">exclusive (write) mode</text>
  <text x="590" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">W1 alone — all others wait</text>
  <text x="360" y="70" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">no active readers</text>
  <text x="360" y="86" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">⇄ acquire / release ⇄</text>
  <text x="360" y="140" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">many readers OR one writer — never both</text>
</svg>`;

const topic = makeTopic({
  id: "readers-writers",
  title: "Readers-Writers",
  category: "lld-concurrency",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A lock that allows many concurrent readers or a single exclusive writer, exploiting the fact that concurrent reads of immutable data are safe.`,
  sections: [
    { title: `The insight`, body: `<p>A plain mutex serializes <em>all</em> access, but concurrent reads never conflict with each other — only writes do. A <b>reader-writer lock</b> (shared/exclusive lock) exploits this: it grants the lock in <b>shared mode</b> to any number of readers simultaneously, but in <b>exclusive mode</b> to at most one writer with no readers present. It is the right tool for read-heavy shared state such as a config cache, a routing table, or an in-memory price map.</p>` },
    { title: `Structure and rules`, figureAfter: "rw", body: `<p>The lock exposes four operations: <code>lockRead</code> / <code>unlockRead</code> and <code>lockWrite</code> / <code>unlockWrite</code>. The invariant is simple: the number of active writers is 0 or 1, and if a writer is active the number of active readers is 0. So the states are: idle, N readers active, or 1 writer active.</p>
<ul>
<li>A reader acquires if no writer holds or is (depending on policy) waiting.</li>
<li>A writer acquires only when there are zero active readers and zero active writers.</li>
</ul>
<p>Internally this is a mutex protecting a reader count plus condition variables that writers wait on until the count drops to zero.</p>
<pre>// Read-heavy FX rate table: many payment conversions, rare admin updates
public final class ExchangeRateCache {
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final Map&lt;String, BigDecimal&gt; rates = new HashMap&lt;&gt;();

    public BigDecimal getRate(String currencyPair) {
        lock.readLock().lock();
        try {
            return rates.get(currencyPair);
        } finally {
            lock.readLock().unlock();
        }
    }

    public void updateRate(String pair, BigDecimal rate) {
        lock.writeLock().lock();
        try {
            rates.put(pair, rate);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public Money convert(Money amount, String targetCurrency) {
        BigDecimal rate = getRate(amount.currency() + "-" + targetCurrency);
        return amount.convertTo(targetCurrency, rate);
    }
}</pre>` },
    { title: `Writer starvation and fairness`, body: `<p>The naive "let readers in whenever no writer is active" policy is <b>read-preferring</b>, and under a steady stream of readers a writer can wait forever — as long as at least one reader is always active, the reader count never reaches zero. This is <b>writer starvation</b>. Fairness policies fix it:</p>
<ul>
<li><b>Write-preferring:</b> once a writer is waiting, new readers queue behind it, so the reader count can drain and the writer proceeds. Risks reader starvation under write-heavy load.</li>
<li><b>Fair / FIFO:</b> requests are served roughly in arrival order, bounding wait time for both sides at the cost of some read concurrency.</li>
</ul>` },
    { title: `When it actually helps`, body: `<p>A reader-writer lock only pays off when reads genuinely dominate <em>and</em> the critical section is long enough that read parallelism matters; its bookkeeping is heavier than a plain mutex, so for very short critical sections a mutex is faster. For read-mostly data where writes are rare, prefer lower-contention alternatives entirely: an immutable snapshot swapped atomically on update (copy-on-write) lets readers proceed with no lock at all, and RCU (read-copy-update) generalizes this. Reach for a reader-writer lock when in-place mutation is required and reads clearly outnumber writes.</p>
<pre>// Copy-on-write alternative: readers never block
public final class ImmutableRateTable {
    private volatile Map&lt;String, BigDecimal&gt; rates = Map.of();

    public BigDecimal getRate(String pair) {
        return rates.get(pair);  // volatile read — no lock
    }

    public void updateRate(String pair, BigDecimal rate) {
        Map&lt;String, BigDecimal&gt; next = new HashMap&lt;&gt;(rates);
        next.put(pair, rate);
        this.rates = Map.copyOf(next);  // atomic swap
    }
}

// PaymentService reads rates thousands/sec; treasury updates once/hour
Money usdTotal = orders.stream()
    .map(o -&gt; rateTable.convert(o.amount(), "USD"))
    .reduce(Money.ZERO, Money::add);</pre>` },
  ],
  figures: [
    { id: "rw", svg: RW_SVG, caption: "The lock is held either by many readers in shared mode or by one writer in exclusive mode — the two modes are mutually exclusive." },
  ],
  related: ["lock-free-atomic", "producer-consumer", "threads-vs-async"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("readers-writers", stage, panel, stageEl);
}
