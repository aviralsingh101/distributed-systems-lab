// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const POOL_SVG = `<svg viewBox="0 0 720 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Thread pool structure">
  <defs><marker id="fig-thread-pool-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="120" y="24" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">submit(task)</text>
  <rect x="30" y="60" width="180" height="50" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="120" y="80" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Bounded task queue</text>
  <text x="120" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">T5 · T6 · T7 …</text>
  <rect x="300" y="30" width="150" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="375" y="50" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">worker 1 — T1</text>
  <rect x="300" y="70" width="150" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="375" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">worker 2 — T2</text>
  <rect x="300" y="110" width="150" height="30" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/><text x="375" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">worker 3 — T3</text>
  <line x1="210" y1="85" x2="298" y2="45" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-thread-pool-arr)"/>
  <line x1="210" y1="85" x2="298" y2="85" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-thread-pool-arr)"/>
  <line x1="210" y1="85" x2="298" y2="125" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-thread-pool-arr)"/>
  <text x="600" y="80" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Fixed worker count</text>
  <text x="600" y="96" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">caps concurrency</text>
</svg>`;

const topic = makeTopic({
  id: "thread-pool",
  title: "Thread Pool",
  category: "lld-concurrency",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `A fixed set of reusable worker threads pull tasks from a shared queue — bounding concurrency and amortizing thread-creation cost.`,
  sections: [
    { title: `Why pool threads at all`, body: `<p>Creating a thread per task is expensive: each thread reserves stack memory and costs a system call to spawn and tear down. Worse, unbounded thread creation lets a traffic spike spawn tens of thousands of threads, exhausting memory and drowning the scheduler in context switches. A <b>thread pool</b> fixes both problems by keeping a fixed set of long-lived worker threads that repeatedly pull work from a shared queue.</p>` },
    { title: `Structure`, figureAfter: "pool", body: `<p>The pattern has three parts: a <b>task queue</b>, a fixed set of <b>worker threads</b>, and a <b>submit</b> API that enqueues work and (optionally) returns a future. Each worker loops forever: take a task, run it, repeat. The pool size caps how many tasks run in parallel, which is the entire point — it turns "unbounded concurrency" into a tunable, back-pressured resource.</p>
<p>The queue should be <b>bounded</b>. An unbounded queue turns overload into an out-of-memory crash instead of a clean rejection, and hides the fact that arrival rate exceeds service rate. When the queue is full, a rejection policy (fail fast, block the caller, or drop) decides what happens.</p>
<pre>// Bounded pool for IO-bound payment capture calls
public final class PaymentCapturePool {
    private final ExecutorService workers;
    private final PaymentGateway gateway;

    public PaymentCapturePool(PaymentGateway gateway) {
        this.gateway = gateway;
        this.workers = new ThreadPoolExecutor(
            8, 8,                          // fixed size — caps in-flight captures
            0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue&lt;&gt;(500), // bounded queue — backpressure
            new ThreadPoolExecutor.CallerRunsPolicy() // full queue → caller runs task
        );
    }

    public Future&lt;ChargeResult&gt; submitCapture(ChargeRequest request) {
        return workers.submit(() -&gt; gateway.charge(request));
    }

    public void shutdown() {
        workers.shutdown();
    }
}

// Caller: submit many captures, collect results
List&lt;Future&lt;ChargeResult&gt;&gt; futures = orders.stream()
    .map(o -&gt; pool.submitCapture(o.toChargeRequest()))
    .toList();</pre>` },
    { title: `Sizing the pool`, body: `<p>Sizing depends on whether tasks are CPU-bound or IO-bound.</p>
<ul>
<li><b>CPU-bound</b> (hashing, parsing, compression): threads compete for cores, so the sweet spot is roughly the number of cores, sometimes cores&nbsp;+&nbsp;1 to cover the occasional page fault. More threads than cores just adds context-switch overhead.</li>
<li><b>IO-bound</b> (calling a gateway, querying a database): threads spend most time blocked, so you can run many more than you have cores. A useful starting formula is <code>threads ≈ cores × (1 + waitTime / serviceTime)</code>. A task that waits 90% of the time can profitably use ~10× the core count.</li>
</ul>
<p>Keep CPU-bound and blocking IO work in <b>separate pools</b>. A slow downstream call sharing a pool with fast CPU tasks will pin every worker in a blocking wait and starve everything else.</p>` },
    { title: `Failure modes to watch`, body: `<p>Two classic hazards: <b>pool-exhaustion deadlock</b> — tasks in the pool submit sub-tasks to the <em>same</em> pool and wait for them; if all workers are blocked waiting on work that can never be scheduled, the pool wedges. Use a separate pool for dependent work, or restructure so tasks never block on the same pool. Second, <b>silent queue growth</b>: with an unbounded queue, latency climbs invisibly as the backlog grows while throughput looks fine. Always monitor queue depth and rejection count, and size the bounded queue so it absorbs bursts without hiding sustained overload.</p>
<pre>// DEADLOCK: capture task submits fraud-check to the SAME pool and blocks
public ChargeResult captureWithFraudCheck(ChargeRequest req) {
    Future&lt;FraudScore&gt; score = capturePool.submit(() -&gt;
        fraudService.score(req));          // needs a worker — all are blocked!
    return gateway.charge(req);            // never reached if pool is full
}

// FIX: separate pools — IO capture vs CPU fraud scoring
private final ExecutorService capturePool = Executors.newFixedThreadPool(16);
private final ExecutorService fraudPool   = Executors.newFixedThreadPool(4);

public ChargeResult captureWithFraudCheck(ChargeRequest req) throws Exception {
    FraudScore score = fraudPool.submit(() -&gt; fraudService.score(req)).get();
    if (score.isHighRisk()) throw new FraudRejectedException(req.paymentId());
    return capturePool.submit(() -&gt; gateway.charge(req)).get();
}</pre>` },
  ],
  figures: [
    { id: "pool", svg: POOL_SVG, caption: "Submitted tasks land in a bounded queue; a fixed set of workers pulls and executes them, capping in-flight concurrency." },
  ],
  related: ["producer-consumer", "threads-vs-async", "virtual-threads", "structured-concurrency"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("thread-pool", stage, panel, stageEl);
}
