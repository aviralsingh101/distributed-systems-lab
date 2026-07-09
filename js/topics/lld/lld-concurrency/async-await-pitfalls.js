// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "async-await-pitfalls",
  title: "Async/Await Pitfalls",
  category: "lld-concurrency",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `async/await reads like sequential code, which is exactly why its failure modes — blocking the loop, sync-over-async deadlock, and unawaited tasks — are easy to introduce.`,
  sections: [
    { title: `How async/await actually works`, body: `<p>To understand the traps, start with how it works. <code>async</code>/<code>await</code> is syntactic sugar over a state machine. When execution hits <code>await</code>, the function <em>suspends</em> and returns control to the event loop (or scheduler); the continuation after the <code>await</code> is scheduled to run when the awaited task completes. Crucially, <b>awaiting does not create a thread and does not run anything in parallel</b> — it yields the current thread so the loop can run other ready work. Most pitfalls come from forgetting that the whole thing usually rides on a small number of threads whose cooperation you must not break.</p>` },
    { title: `Blocking the loop`, body: `<p>Because the event loop is cooperative, any code that runs without ever awaiting monopolizes the thread. Two ways to block it:</p>
<ul>
<li><b>CPU-bound work</b> in an async function — a tight loop, JSON parsing of a huge payload, crypto — stalls <em>every</em> other task on that loop until it finishes. Offload it to a worker thread/pool (<code>runInExecutor</code>, a worker thread, <code>Task.Run</code>).</li>
<li><b>Hidden synchronous IO</b> — calling a blocking file/DB/HTTP API inside async code. It looks innocent but parks the loop thread. Use the non-blocking client instead.</li>
</ul>
<pre>// Java CompletableFuture — blocking JDBC inside async chain
@Service
public class AsyncPaymentService {
    private final ExecutorService cpuPool = Executors.newFixedThreadPool(4);
    private final WalletRepository wallets;  // blocking JDBC

    public CompletableFuture&lt;PaymentResult&gt; processAsync(PayRequest req) {
        return CompletableFuture.supplyAsync(() -&gt; {
            // BAD: blocking call on ForkJoinPool.commonPool()
            return wallets.findById(req.walletId()).orElseThrow();
        }, cpuPool);  // GOOD: dedicated pool for blocking IO
    }
}

// Spring @Async pitfall — default executor may be too small
@Async
public CompletableFuture&lt;Void&gt; notifyWebhook(PaymentCompleted evt) {
    httpClient.post(evt.callbackUrl(), evt);  // blocks async thread
    return CompletableFuture.completedFuture(null);
}</pre>
<p>Symptom: latency for all requests spikes together whenever one heavy request arrives.</p>
<pre>// PITFALL: @Async on default pool + blocking Stripe HTTP inside
@Service
public class PaymentNotificationService {
    @Async  // runs on Spring's shared pool (often small)
    public void sendReceiptEmail(ChargeResult result) {
        emailClient.send(result);  // blocking SMTP — starves other @Async tasks
    }
}

// FIX: dedicated executor + non-blocking client
@Configuration
@EnableAsync
class AsyncConfig {
    @Bean(name = "notificationExecutor")
    Executor notificationExecutor() {
        return Executors.newFixedThreadPool(4);
    }
}

@Async("notificationExecutor")
public void sendReceiptEmail(ChargeResult result) {
    emailClient.sendAsync(result).join();  // or truly async client
}</pre>` },
    { title: `Sync-over-async deadlock`, body: `<p>Blocking a thread to wait for an async result — <code>task.Result</code>, <code>task.get()</code>, <code>runBlocking</code> inside a request — is the classic <b>sync-over-async</b> trap. On runtimes with a captured context or a single-threaded loop it <b>deadlocks</b>: the thread you blocked is the very thread the continuation needs to resume on, so the task can never complete and your wait never returns (the .NET <code>ConfigureAwait(true)</code> UI/ASP.NET deadlock is the textbook case). The rule is "async all the way down": never block on async code; await it. If you truly must bridge, hop to a distinct thread pool that is not the one the continuation will resume on.</p>
<pre>// DEADLOCK in servlet thread: .get() waits for @Async on same pool
@RestController
class PaymentController {
    @Autowired PaymentService paymentService;

    @PostMapping("/payments")
    public ChargeResult capture(@RequestBody ChargeRequest req) {
        return paymentService.captureAsync(req).get(); // blocks servlet thread
        // @Async continuation may need same pool → deadlock under load
    }
}

// FIX: async all the way — return CompletableFuture, or use virtual threads
@PostMapping("/payments")
public CompletableFuture&lt;ChargeResult&gt; capture(@RequestBody ChargeRequest req) {
    return paymentService.captureAsync(req);
}</pre>` },
    { title: `Fire-and-forget and lost errors`, body: `<p>Calling an async function without <code>await</code> starts it and drops the returned task on the floor. Two consequences: you have no idea when (or whether) it finished, and any exception it throws becomes an <b>unobserved rejection</b> — silently swallowed, or crashing the process later far from its cause. This is common in "log this in the background" or "kick off a webhook" code. Fixes: keep a reference and <code>await</code> it at a well-defined join point (see structured concurrency), or explicitly attach error handling and hand the work to a supervised background runner. Related traps: <b>sequential awaits</b> where a <code>for</code> loop awaits each call one at a time instead of starting them together and awaiting the group (an N× latency N+1 problem), and mixing parallel writes to shared state under the assumption that "single-threaded" means "no interleaving" — it does interleave, at every <code>await</code> point.</p>
<pre>// FIRE-AND-FORGET: webhook delivery errors vanish
@Async
public void notifyMerchant(ChargeResult result) {
    webhookClient.post(result);  // exception → unobserved, merchant never notified
}

// FIX: attach error handler + structured join at request boundary
public CompletableFuture&lt;Void&gt; notifyMerchant(ChargeResult result) {
    return CompletableFuture.runAsync(() -&gt; webhookClient.post(result))
        .exceptionally(ex -&gt; {
            deadLetterQueue.enqueue(result, ex);
            return null;
        });
}

// SEQUENTIAL AWAITS: N payments × 200ms = N×200ms latency
for (ChargeRequest req : batch) {
    results.add(paymentService.captureAsync(req).join());
}
// PARALLEL: ~200ms total for the batch
List&lt;CompletableFuture&lt;ChargeResult&gt;&gt; futures = batch.stream()
    .map(paymentService::captureAsync).toList();
CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();</pre>` },
  ],
  related: ["threads-vs-async", "structured-concurrency", "thread-pool", "virtual-threads"],
});

export const meta = topic.meta;
export const content = topic.content;
