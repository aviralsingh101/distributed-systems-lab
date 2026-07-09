// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const MODELS_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Thread-per-request vs event loop">
  <defs><marker id="fig-threads-vs-async-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="180" y="20" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Thread-per-request (blocking)</text>
  <rect x="40" y="35" width="150" height="24" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="115" y="51" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">thread 1 — waiting on IO</text>
  <rect x="40" y="66" width="150" height="24" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="115" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">thread 2 — waiting on IO</text>
  <rect x="40" y="97" width="150" height="24" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="115" y="113" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">thread 3 — waiting on IO</text>
  <text x="115" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">N connections = N stacks (~1 MB each)</text>
  <line x1="360" y1="25" x2="360" y2="185" stroke="#93a1bd" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="540" y="20" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Event loop (non-blocking)</text>
  <circle cx="470" cy="80" r="30" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/><text x="470" y="84" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">loop</text>
  <rect x="560" y="45" width="130" height="70" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.4"/>
  <text x="625" y="66" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">OS async IO</text>
  <text x="625" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">epoll / kqueue</text>
  <text x="625" y="98" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">IOCP</text>
  <line x1="500" y1="70" x2="558" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-threads-vs-async-arr)"/>
  <line x1="558" y1="92" x2="500" y2="92" stroke="#3ddc97" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-threads-vs-async-arr)"/>
  <text x="540" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">1 thread drives thousands of sockets</text>
</svg>`;

const topic = makeTopic({
  id: "threads-vs-async",
  title: "Threads vs Async",
  category: "lld-concurrency",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Two ways to serve many concurrent connections: give each a blocking OS thread, or multiplex all of them onto a non-blocking event loop.`,
  sections: [
    { title: `The problem both solve`, body: `<p>A server handling many simultaneous requests spends most of its wall-clock time <em>waiting</em> — on a database, a downstream gateway, or the network. The question is what a request holds while it waits. The two dominant answers are <b>OS threads</b> (thread-per-request with blocking calls) and the <b>event loop</b> (async/await over non-blocking IO). They are not "fast vs slow"; they trade memory, scheduling, and code style against each other. Below we look at how it works for each model and when to reach for it.</p>` },
    { title: `How OS threads work`, figureAfter: "models", body: `<p>In the thread-per-request model the operating system gives each request its own thread with its own stack (often ~0.5–1&nbsp;MB reserved). Code makes <b>blocking</b> calls: <code>socket.read()</code> parks the thread until data arrives. The OS scheduler is <b>preemptive</b> — it can suspend a thread at almost any instruction and run another, and it moves threads across cores.</p>
<pre>// Thread-per-request — classic Spring/Tomcat model
@RestController
public class PaymentController {
    private final OrderService orders;

    @PostMapping("/pay")
    public ResponseEntity&lt;PaymentDto&gt; pay(@RequestBody PayRequest req) {
        // Tomcat assigns one platform thread for this request
        PaymentDto result = orders.placeOrder(req);
        return ResponseEntity.ok(result);
    }
}

@Service
public class OrderService {
    private final PaymentGateway gateway;
    private final WalletRepository wallets;

    @Transactional
    public PaymentDto placeOrder(PayRequest req) {
        Wallet w = wallets.findById(req.walletId()).orElseThrow();
        // thread blocks here on HTTP — OS schedules other threads
        ChargeResult charge = gateway.charge(req.toChargeRequest());
        w.applyCharge(charge);
        wallets.save(w);
        return PaymentDto.from(w, charge);
    }
}</pre>
<ul>
<li><b>Pro:</b> straight-line, sequential code; a stack trace shows the whole request; debuggers and profilers understand it natively.</li>
<li><b>Con:</b> each parked thread still costs memory, and thousands of threads mean heavy context-switch and cache-thrash overhead. Because switches can happen anywhere, shared mutable state needs locks.</li>
</ul>
<pre>// Thread-per-request: one platform thread per checkout
@RestController
class CheckoutController {
    @PostMapping("/checkout")
    public ChargeResult checkout(@RequestBody ChargeRequest req) {
        FraudScore score = fraudService.score(req);     // blocks this thread
        return gateway.charge(req);                     // blocks again (~200ms IO)
    }
}
// 1000 concurrent checkouts → 1000 OS threads × ~1 MB stack</pre>` },
    { title: `How the event loop works`, body: `<p>The async model runs a small number of threads (often one per core) each spinning an <b>event loop</b>. Instead of blocking, IO is registered with the kernel (<code>epoll</code>, <code>kqueue</code>, IOCP) and the loop is notified when a socket is ready. <code>await</code> does not block a thread — it suspends the current task, saves its continuation, and lets the loop run other ready tasks; when the awaited IO completes the task is resumed.</p>
<p>Scheduling here is <b>cooperative</b>: a task keeps the thread until it hits an <code>await</code>. That is why a single loop can drive tens of thousands of connections with a few kilobytes of state each — but also why one CPU-heavy or accidentally-blocking call freezes <em>every</em> connection on that loop.</p>
<pre>// Event-loop style: Spring WebFlux + non-blocking gateway client
@RestController
class ReactiveCheckoutController {
    @PostMapping("/checkout")
    public Mono&lt;ChargeResult&gt; checkout(@RequestBody ChargeRequest req) {
        return fraudService.scoreAsync(req)
            .flatMap(score -&gt; {
                if (score.isHighRisk()) return Mono.error(new FraudRejectedException());
                return gateway.chargeAsync(req);  // yields thread at each await point
            });
    }
}
// 10_000 concurrent checkouts → few carrier threads, ~KB state each</pre>` },
    { title: `Choosing between them`, body: `<p>For <b>IO-bound</b> fan-out (an API that calls three services and a database), both scale well; async uses far less memory per connection, threads keep code simpler. For <b>CPU-bound</b> work, threads across cores win — async gives no parallelism on a single loop and must offload to a worker pool. The models also converge: Go goroutines and JVM virtual threads give thread-per-request code on top of an async runtime, hiding the loop while keeping blocking-style syntax.</p>
<p>Rule of thumb: pick the model your platform makes idiomatic (Node/Python asyncio → event loop; classic JVM/Go → threads), never mix blocking calls into a loop, and never do heavy CPU work on the thread that must stay responsive.</p>
<pre>// Convergence: virtual threads give blocking syntax + async scalability
@RestController
class VirtualThreadCheckoutController {
    private final ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor();

    @PostMapping("/checkout")
    public CompletableFuture&lt;ChargeResult&gt; checkout(@RequestBody ChargeRequest req) {
        return CompletableFuture.supplyAsync(() -&gt; {
            FraudScore score = fraudService.score(req);  // blocking OK
            return gateway.charge(req);                  // carrier freed while waiting
        }, exec);
    }
}

// Same sequential code as thread-per-request; memory profile of event loop
// Choose: WebFlux if team knows reactive; virtual threads if team knows blocking</pre>` },
  ],
  figures: [
    { id: "models", svg: MODELS_SVG, caption: "Thread-per-request parks one OS stack per waiting connection; the event loop multiplexes all waits onto one thread via the kernel's async IO facilities." },
  ],
  related: ["thread-pool", "virtual-threads", "async-await-pitfalls", "structured-concurrency"],
});

export const meta = topic.meta;
export const content = topic.content;
