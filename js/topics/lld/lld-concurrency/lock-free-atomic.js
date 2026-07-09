// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const CAS_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Compare-and-swap retry loop">
  <defs><marker id="fig-lock-free-atomic-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="270" y="20" width="180" height="34" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="360" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">read old = counter</text>
  <rect x="270" y="72" width="180" height="34" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="360" y="94" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">compute next = old + 1</text>
  <rect x="240" y="124" width="240" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="360" y="146" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">CAS(counter, old, next)</text>
  <line x1="360" y1="54" x2="360" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-lock-free-atomic-arr)"/>
  <line x1="360" y1="106" x2="360" y2="122" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-lock-free-atomic-arr)"/>
  <text x="560" y="145" fill="#3ddc97" font-size="10" font-family="system-ui">success → done</text>
  <path d="M240,141 C120,141 120,37 268,37" fill="none" stroke="#ff6b6b" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#fig-lock-free-atomic-arr)"/>
  <text x="120" y="90" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">failed:</text>
  <text x="120" y="105" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">value changed,</text>
  <text x="120" y="120" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">retry</text>
</svg>`;

const topic = makeTopic({
  id: "lock-free-atomic",
  title: "Lock-Free / Atomic",
  category: "lld-concurrency",
  track: "lld",
  tier: "advanced",
  archetype: "concept",
  oneliner: `Coordinate threads with hardware atomic instructions like compare-and-swap instead of locks — no thread can block another by holding a lock.`,
  sections: [
    { title: `What lock-free means`, body: `<p>A <b>lock-free</b> algorithm coordinates concurrent threads without mutual-exclusion locks, using atomic read-modify-write instructions the CPU provides. The formal guarantee is that <em>the system as a whole always makes progress</em>: at least one thread completes an operation in a bounded number of steps, so a thread suspended mid-operation can never block the others (no deadlock, no priority inversion, no lock convoy). This is stronger than "no locks" — it is a progress guarantee.</p>` },
    { title: `How compare-and-swap works`, figureAfter: "cas", body: `<p>Here is how it works. The workhorse is <b>compare-and-swap</b> (CAS): a single atomic instruction <code>CAS(addr, expected, new)</code> that writes <code>new</code> to <code>addr</code> only if the current value still equals <code>expected</code>, returning whether it succeeded. Lock-free updates are built as an optimistic <b>retry loop</b>:</p>
<ol>
<li>Read the current value into <code>old</code>.</li>
<li>Compute the intended <code>next</code> value from <code>old</code>.</li>
<li>Attempt <code>CAS(v, old, next)</code>. If it succeeds, done. If another thread changed <code>v</code> in between, CAS fails — reload and retry.</li>
</ol>
<p>Because the write only lands when the value is unchanged, no update is ever silently overwritten. Atomic counters, flags, and stack/queue pointers are all built this way.</p>
<pre>// Idempotent payment dedup: only first submitter wins
public final class PaymentIdempotencyGuard {
    private static final ChargeResult PLACEHOLDER = new ChargeResult("pending", null, null);
    private final AtomicReference&lt;ConcurrentHashMap&lt;String, ChargeResult&gt;&gt; storeRef =
        new AtomicReference&lt;&gt;(new ConcurrentHashMap&lt;&gt;());

    public Optional&lt;ChargeResult&gt; findExisting(String paymentId) {
        return Optional.ofNullable(storeRef.get().get(paymentId));
    }

    public ChargeResult recordIfAbsent(String paymentId, Supplier&lt;ChargeResult&gt; capture) {
        ConcurrentHashMap&lt;String, ChargeResult&gt; map = storeRef.get();
        ChargeResult existing = map.putIfAbsent(paymentId, PLACEHOLDER);
        if (existing != null &amp;&amp; existing != PLACEHOLDER) return existing;

        ChargeResult result = capture.get();
        map.replace(paymentId, PLACEHOLDER, result);
        return result;
    }
}

// CAS retry loop for a simple counter (daily capture volume)
private final AtomicLong dailyCaptureCount = new AtomicLong(0);

public void incrementCaptureCount() {
    long old, next;
    do {
        old = dailyCaptureCount.get();
        next = old + 1;
    } while (!dailyCaptureCount.compareAndSet(old, next));
}</pre>` },
    { title: `The ABA problem`, body: `<p>CAS checks that a value <em>equals</em> what you last read — not that it never changed. If a value goes A → B → A between your read and your CAS, the CAS succeeds even though the world moved underneath you. This is the <b>ABA problem</b>, and it corrupts pointer-based structures: a node you popped could be freed and a different node reallocated at the same address, so your CAS reattaches stale state. Fixes: a <b>tagged/versioned pointer</b> (pack a monotonic counter beside the pointer so A-with-tag-1 ≠ A-with-tag-3, often via double-width CAS), hazard pointers, or epoch-based reclamation to defer freeing memory that another thread might still CAS against.</p>
<pre>// Payment status pointer: ABA-safe with AtomicStampedReference
public final class PaymentStatusTracker {
    private final AtomicStampedReference&lt;PaymentStatus&gt; status =
        new AtomicStampedReference&lt;&gt;(PaymentStatus.PENDING, 0);

    public boolean transition(PaymentStatus expected, PaymentStatus next) {
        int[] stampHolder = new int[1];
        PaymentStatus current = status.get(stampHolder);
        if (current != expected) return false;
        return status.compareAndSet(expected, next, stampHolder[0], stampHolder[0] + 1);
    }
}

// Without stamp: PENDING → CAPTURED → PENDING (reversal) → CAS(PENDING) succeeds wrongly
// With stamp: tag increments on every write, stale CAS fails</pre>` },
    { title: `Memory ordering and when to bother`, body: `<p>Atomics also control <b>memory ordering</b>. Modern CPUs and compilers reorder memory operations; a lock-free algorithm must specify barriers (acquire/release, or sequential consistency) so that other threads observe writes in the required order. Getting this wrong yields bugs that appear only on weakly-ordered hardware (ARM) under load. Lock-free code is genuinely hard to write and verify, so reserve it for proven hot spots — a shared counter, a single-producer/single-consumer ring buffer, or a library primitive. For ordinary critical sections a mutex is simpler, and for read-mostly data an immutable snapshot swap is easier to reason about than a hand-rolled lock-free structure.</p>` },
  ],
  figures: [
    { id: "cas", svg: CAS_SVG, caption: "A CAS loop reads, computes, then swaps only if the value is unchanged; a concurrent modification fails the CAS and forces a retry." },
  ],
  related: ["readers-writers", "threads-vs-async", "optimistic-locking"],
});

export const meta = topic.meta;
export const content = topic.content;
