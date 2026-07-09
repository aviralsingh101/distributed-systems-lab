// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const VT_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Virtual threads on carrier threads">
  <defs><marker id="fig-virtual-threads-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="20" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">thousands of virtual threads</text>
  <g fill="#1a2236" stroke="#7c5cff" stroke-width="1.2">
    <rect x="30" y="32" width="60" height="18" rx="3"/><rect x="100" y="32" width="60" height="18" rx="3"/><rect x="170" y="32" width="60" height="18" rx="3"/><rect x="240" y="32" width="60" height="18" rx="3"/>
    <rect x="330" y="32" width="60" height="18" rx="3"/><rect x="400" y="32" width="60" height="18" rx="3"/><rect x="470" y="32" width="60" height="18" rx="3"/><rect x="560" y="32" width="60" height="18" rx="3"/><rect x="630" y="32" width="60" height="18" rx="3"/>
  </g>
  <line x1="130" y1="55" x2="180" y2="108" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-virtual-threads-arr)"/>
  <line x1="420" y1="55" x2="360" y2="108" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-virtual-threads-arr)"/>
  <line x1="600" y1="55" x2="540" y2="108" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-virtual-threads-arr)"/>
  <text x="360" y="128" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">mounted on a small pool of carrier (platform) threads</text>
  <g fill="#1a2236" stroke="#5b9dff" stroke-width="1.5">
    <rect x="150" y="140" width="80" height="34" rx="5"/><rect x="320" y="140" width="80" height="34" rx="5"/><rect x="490" y="140" width="80" height="34" rx="5"/>
  </g>
  <text x="190" y="161" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">carrier 1</text>
  <text x="360" y="161" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">carrier 2</text>
  <text x="530" y="161" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">carrier 3</text>
  <text x="360" y="192" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">blocking IO unmounts the virtual thread, freeing the carrier</text>
</svg>`;

const topic = makeTopic({
  id: "virtual-threads",
  title: "Virtual Threads",
  category: "lld-concurrency",
  track: "lld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `JVM Project Loom threads that are cheap enough to create by the million — restoring simple blocking code while scaling like async IO.`,
  sections: [
    { title: `Why they exist`, body: `<p>On the JVM, a classic <b>platform thread</b> is a thin wrapper over an OS thread: it reserves a large stack (often ~1&nbsp;MB) and its scheduling is the kernel's job. That makes threads scarce — a few thousand is a lot — which is why the ecosystem drifted to async/reactive code to handle high connection counts. <b>Virtual threads</b> (Project Loom, stable in Java 21) remove the scarcity: they are lightweight threads managed by the JVM, cheap enough that "one thread per request" scales to hundreds of thousands of concurrent requests.</p>` },
    { title: `How they work`, figureAfter: "vt", body: `<p>Here is how it works. A virtual thread is scheduled by the JVM onto a small pool of platform threads called <b>carrier threads</b>. The key mechanism is <b>mount / unmount</b>: while a virtual thread runs it is <em>mounted</em> on a carrier; when it hits a blocking operation (socket read, sleep, lock wait) the JVM <b>unmounts</b> it, saving its stack on the heap and freeing the carrier to run a different virtual thread. When the blocking call completes, the virtual thread is remounted (on any carrier) and continues.</p>
<p>The payoff: your code makes ordinary <b>blocking</b> calls and reads top-to-bottom, but a blocked virtual thread costs almost nothing — no OS thread is tied up while it waits. The JVM does the async multiplexing the event loop used to force you to write by hand.</p>
<pre>// One virtual thread per payment request — no pool needed
public final class PaymentRequestHandler {
    private final ExecutorService virtualExec =
        Executors.newVirtualThreadPerTaskExecutor();
    private final PaymentGateway gateway;
    private final FraudService fraudService;

    public CompletableFuture&lt;ChargeResult&gt; handleAsync(ChargeRequest req) {
        return CompletableFuture.supplyAsync(() -&gt; {
            FraudScore score = fraudService.score(req);   // blocks — carrier freed
            if (score.isHighRisk()) throw new FraudRejectedException(req.paymentId());
            return gateway.charge(req);                   // blocks — carrier freed
        }, virtualExec);
    }
}

// 50_000 concurrent checkout requests: ~50k virtual threads, ~8 carriers
// Same code as thread-per-request, fraction of the memory</pre>` },
    { title: `Virtual vs platform threads`, body: `<ul>
<li><b>Cost:</b> a virtual thread's stack lives on the heap and grows on demand (kilobytes), versus a platform thread's large fixed OS stack.</li>
<li><b>Scheduling:</b> virtual threads are scheduled by the JVM (cooperatively yielding at blocking points); platform threads by the OS (preemptively).</li>
<li><b>Use:</b> virtual threads are for high-throughput, IO-bound, thread-per-task workloads; platform threads still suit long-running CPU-bound work and are the carriers underneath.</li>
</ul>
<p>They are not faster per operation — they let you run vastly more concurrent blocking tasks.</p>` },
    { title: `Pinning and gotchas`, body: `<p>The main hazard is <b>pinning</b>: some situations prevent unmounting, so the virtual thread stays glued to its carrier and blocks it like an old-style thread. The notable cases are running inside a <code>synchronized</code> block/method during a blocking call, and blocking inside native (JNI) code. Fixes: replace <code>synchronized</code> with <code>ReentrantLock</code> around blocking sections (later Loom versions also reduce this). Also do not <b>pool</b> virtual threads — they are meant to be created per task and discarded; pooling them defeats the purpose. And avoid stashing per-request data in thread-locals across millions of threads (Loom's scoped values are the intended replacement).</p>
<pre>// PINNING: synchronized + blocking gateway call holds the carrier
public synchronized ChargeResult chargeSynchronized(ChargeRequest req) {
    return gateway.charge(req);  // virtual thread cannot unmount inside synchronized
}

// FIX: ReentrantLock allows unmount during blocking IO
private final ReentrantLock lock = new ReentrantLock();

public ChargeResult chargeWithLock(ChargeRequest req) {
    lock.lock();
    try {
        return gateway.charge(req);  // carrier freed while waiting on socket
    } finally {
        lock.unlock();
    }
}

// Anti-pattern: pooling virtual threads (they are free — create per task)
// BAD:  Executors.newFixedThreadPool(200, Thread.ofVirtual().factory())
// GOOD: Executors.newVirtualThreadPerTaskExecutor()</pre>` },
  ],
  figures: [
    { id: "vt", svg: VT_SVG, caption: "Many virtual threads are multiplexed onto a few carrier threads; a blocking call unmounts a virtual thread and frees its carrier for others." },
  ],
  related: ["threads-vs-async", "thread-pool", "structured-concurrency", "async-await-pitfalls"],
});

export const meta = topic.meta;
export const content = topic.content;
