// @article-v2
// @sim-lab
// @hld-gold
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "token-bucket", title: "Token Bucket", category: "prod-eng" };

export const content = {
  oneliner: "Tokens refill at a steady rate into a bucket with max capacity — requests consume tokens and can burst up to capacity.",
  archetype: "concept",
  sections: [
    {
      title: "What is a token bucket?",
      body: `<p>A <b>token bucket</b> rate limiter maintains a counter of <i>tokens</i> per client (or API key, IP, etc.). Tokens are added continuously at a configured <b>refill rate</b>. Each accepted request consumes one or more tokens. If insufficient tokens remain, the request is rejected (HTTP 429).</p>
<p>The bucket has a <b>maximum capacity</b> — you cannot accumulate unlimited tokens while idle. Capacity is typically <code>limit + burst</code>: e.g. 100 requests/minute sustained with up to 20 extra burst tokens.</p>
<p>This is the default algorithm for HTTP API rate limiting (Stripe, GitHub, AWS API Gateway) because it allows legitimate burst traffic while enforcing long-term averages.</p>`,
    },
    {
      title: "How the algorithm works",
      body: `<p><b>Parameters:</b></p>
<ul>
<li><code>refill_rate</code> — tokens added per second (= <code>limit / window_seconds</code>)</li>
<li><code>capacity</code> — max tokens in bucket (= <code>limit + burst</code>)</li>
<li><code>cost</code> — tokens per request (usually 1; heavy endpoints can cost 5)</li>
</ul>
<pre>function allow(key, cost=1):
  state = load(key)  // { tokens, last_refill_ms }
  now = current_time_ms()
  elapsed_sec = (now - state.last_refill_ms) / 1000
  state.tokens = min(capacity, state.tokens + elapsed_sec * refill_rate)
  state.last_refill_ms = now

  if state.tokens >= cost:
    state.tokens -= cost
    save(key, state)
    return { allowed: true, remaining: floor(state.tokens) }
  else:
    deficit = cost - state.tokens
    retry_after = ceil(deficit / refill_rate)
    return { allowed: false, retry_after }</pre>
<p><b>Example:</b> limit=60/min, burst=10 → <code>refill_rate=1/sec</code>, <code>capacity=70</code>. Client idle 30s accumulates 30 tokens (capped at 70). Can then send 70 requests instantly, then throttled to 1/sec.</p>`,
    },
    {
      title: "HLD placement in a distributed system",
      body: `<p>Token bucket state must be <b>shared</b> across all gateway/app instances — otherwise each pod maintains its own bucket and a client gets N× the limit across N pods.</p>
<p><b>Typical placement:</b></p>
<ol>
<li><b>API Gateway / Envoy / nginx</b> — plugin calls Redis before upstream. Best latency (same AZ Redis).</li>
<li><b>Dedicated rate-limiter microservice</b> — gateway calls <code>/check</code> over gRPC. Easier to update logic; adds hop.</li>
<li><b>Embedded in app</b> — only acceptable behind gateway that already enforces limits; never sole defense.</li>
</ol>
<p>Store state in <b>Redis</b> with a Lua script executing refill+decrement atomically. Key format: <code>tb:{scope}:{id}</code> e.g. <code>tb:user:9281:/v1/search</code>.</p>`,
    },
    {
      title: "Distributed implementation details",
      body: `<p><b>Atomicity:</b> without Lua, two concurrent requests both read <code>tokens=0.5</code>, both pass after local refill math, both write — limit exceeded. Lua script runs atomically on Redis server.</p>
<p><b>Redis Cluster:</b> use hash tags <code>tb:{user_id}:path</code> so one user's bucket is on one shard.</p>
<p><b>Local cache:</b> gateway mirrors bucket in memory; flush to Redis every 50ms or 10 requests. Accept ~5% overshoot during gateway-Redis partition for lower p99 latency.</p>
<p><b>Response headers</b> (good practice): <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>, and on 429: <code>Retry-After</code>.</p>`,
    },
    {
      title: "Design decisions & tradeoffs",
      body: `<p><b>vs leaky bucket:</b> token bucket rejects immediately with 429; leaky bucket queues excess (adds latency). For synchronous HTTP, token bucket is standard.</p>
<p><b>vs fixed window:</b> token bucket avoids the 2× spike at window boundary. Slightly more state (float tokens + timestamp vs integer counter).</p>
<p><b>vs sliding window log:</b> token bucket uses O(1) memory per key; sliding log stores every request timestamp — doesn't scale to 50k RPS per key.</p>
<p><b>Fail-open vs fail-closed</b> when Redis is down: most consumer APIs fail-open (allow) with alerts; banking/fraud endpoints may fail-closed.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Implementing per-pod counters — limit is meaningless with horizontal scale.</li>
<li>No burst capacity — punishes normal parallel browser/app requests.</li>
<li>Separate GET and SET without atomic script — race under concurrency.</li>
<li>Using integer-only refill without floats — coarse granularity at high rates.</li>
</ul>`,
    },
  ],
  related: ["rate-limit-algorithms", "rate-limiter-service", "leaky-bucket", "edge-rate-limiting"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("token-bucket", stage, panel, stageEl);
}
