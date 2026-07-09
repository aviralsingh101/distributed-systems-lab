// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const BUCKET_SVG = `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Token bucket">
  <defs><marker id="fig-rate-limiter-in-process-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="120" y="24" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">refill r tokens/sec</text>
  <line x1="120" y1="30" x2="120" y2="58" stroke="#3ddc97" stroke-width="1.6" marker-end="url(#fig-rate-limiter-in-process-arr)"/>
  <path d="M60,60 L180,60 L165,150 L75,150 Z" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/>
  <circle cx="100" cy="120" r="7" fill="#3ddc97"/><circle cx="120" cy="120" r="7" fill="#3ddc97"/>
  <circle cx="140" cy="120" r="7" fill="#3ddc97"/><circle cx="110" cy="103" r="7" fill="#3ddc97"/>
  <text x="120" y="170" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">capacity = burst size</text>
  <line x1="180" y1="105" x2="300" y2="105" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-rate-limiter-in-process-arr)"/>
  <text x="240" y="96" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">take 1 token</text>
  <rect x="310" y="60" width="110" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="365" y="85" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">allow (token)</text>
  <rect x="310" y="120" width="110" height="40" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="365" y="145" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">reject (empty)</text>
  <text x="490" y="105" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">429</text>
</svg>`;

const topic = makeTopic({
  id: "rate-limiter-in-process",
  title: "Rate Limiter (In-Process)",
  category: "lld-classics",
  track: "lld",
  tier: "essential",
  archetype: "classic",
  oneliner: `Cap requests to R/sec while allowing short bursts, using a token bucket held in one process — no network round-trip per check.`,
  figures: [
    { id: "token-bucket", svg: BUCKET_SVG, caption: "Tokens refill at a steady rate up to a capacity; each request spends one token, and an empty bucket means reject." },
  ],
  sections: [
    { title: `Requirement and the algorithm choice`, body: `<p>Limit a caller to a sustained rate (say 100 requests/second) while tolerating brief bursts, deciding <code>allow()</code> vs <code>reject()</code> in-process with no Redis round-trip. The candidate algorithms differ in burst behaviour:</p>
<ul>
<li><b>Fixed window</b> — count per calendar second. Simple, but allows a 2× spike straddling the boundary (100 at 0.9s + 100 at 1.1s).</li>
<li><b>Sliding window log/counter</b> — smooths the boundary spike but stores more state.</li>
<li><b>Leaky bucket</b> — drains at a constant rate; enforces a smooth output but no bursting.</li>
<li><b>Token bucket</b> — the usual answer: steady refill plus a bucket that stores unused allowance, so it permits bursts up to the bucket size while bounding the long-run rate.</li>
</ul>` },
    { title: `Token bucket, mechanically`, figureAfter: "token-bucket", body: `<p>A bucket holds up to <b>capacity</b> tokens and refills at <b>rate</b> tokens per second. Each request tries to take one token: if the bucket is non-empty, take it and allow; otherwise reject (return 429 / retry-after). Capacity sets the maximum burst; rate sets the sustained throughput.</p>
<p>The elegant trick is <b>lazy refill</b>: you do not run a background timer adding tokens. Instead, on each call you compute how many tokens <em>should</em> have accrued since the last check from elapsed time, and cap at capacity:</p>
<pre>tokens = min(capacity, tokens + (now - lastRefill) * rate)</pre>
<p>Then decrement if <code>tokens &gt;= 1</code>. This makes each check O(1) and stores just two numbers per bucket.</p>` },
    { title: `TokenBucket implementation`, body: `<p>The core class uses lazy refill with a monotonic clock and synchronized access for thread safety:</p>
<pre>public final class TokenBucket {
    private final double capacity;
    private final double refillPerSecond;
    private double tokens;
    private long lastRefillNanos;

    public TokenBucket(double capacity, double refillPerSecond) {
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
        this.tokens = capacity;
        this.lastRefillNanos = System.nanoTime();
    }

    public synchronized boolean tryAcquire() {
        refill();
        if (tokens &gt;= 1.0) {
            tokens -= 1.0;
            return true;
        }
        return false;
    }

    public synchronized boolean tryAcquire(int permits) {
        refill();
        if (tokens &gt;= permits) {
            tokens -= permits;
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.nanoTime();
        double elapsedSec = (now - lastRefillNanos) / 1_000_000_000.0;
        tokens = Math.min(capacity, tokens + elapsedSec * refillPerSecond);
        lastRefillNanos = now;
    }

    public synchronized double availableTokens() {
        refill();
        return tokens;
    }
}</pre>` },
    { title: `Per-key RateLimiter with ConcurrentHashMap`, body: `<p>Per-caller limiting means one bucket <em>per key</em> in a concurrent map. Guard each bucket's read-modify-write so two threads cannot both spend the last token:</p>
<pre>public final class RateLimiter {
    private final ConcurrentHashMap&lt;String, TokenBucket&gt; buckets = new ConcurrentHashMap&lt;&gt;();
    private final double capacity;
    private final double refillPerSecond;

    public RateLimiter(double capacity, double refillPerSecond) {
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
    }

    public boolean allow(String apiKey) {
        TokenBucket bucket = buckets.computeIfAbsent(apiKey,
            k -&gt; new TokenBucket(capacity, refillPerSecond));
        return bucket.tryAcquire();
    }

    public RateLimitResult checkPaymentEndpoint(String walletId) {
        if (allow(walletId)) {
            return RateLimitResult.allowed();
        }
        return RateLimitResult.rejected(429, "Retry-After", "1");
    }
}

public record RateLimitResult(boolean allowed, int statusCode, String header, String value) {
    static RateLimitResult allowed() { return new RateLimitResult(true, 200, null, null); }
    static RateLimitResult rejected(int code, String header, String value) {
        return new RateLimitResult(false, code, header, value);
    }
}</pre>
<p>Two operational concerns. <b>Memory</b>: a map keyed by caller grows unbounded, so evict idle buckets — an LRU or a full-bucket sweep works, since a fully-refilled bucket carries no state worth keeping. <b>Clock</b>: use a monotonic clock (<code>nanoTime</code>), never wall-clock, so an NTP step backwards cannot mint or destroy tokens. The hard limit of an in-process limiter is that it only sees <em>this instance's</em> traffic; behind a load balancer with N replicas the real global rate is up to N× your configured limit. When you need a fleet-wide cap, move the counter to a shared store (Redis token bucket, or a sidecar) and accept the per-request round-trip — but for protecting a single process's local resource, in-process is the right, fast choice.</p>` },
  ],
  related: ["lru-cache", "in-memory-pub-sub", "backpressure-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("rate-limiter-in-process", stage, panel, stageEl);
}
