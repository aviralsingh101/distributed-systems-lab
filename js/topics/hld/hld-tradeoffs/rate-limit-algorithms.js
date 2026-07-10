// @article-v2
// @hld-gold
import { makeTopic } from "../../shared/topicFactory.js";

const ALGO_SVG = `<svg viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rate limit algorithm shapes">
  <text x="360" y="16" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Traffic shape allowed by each algorithm (same avg rate, different burst behavior)</text>
  <text x="120" y="36" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Token bucket</text>
  <text x="360" y="36" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Leaky bucket</text>
  <text x="600" y="36" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Fixed window</text>
  <polyline points="30,120 50,80 70,100 90,60 110,90 130,70 150,100 170,50 190,120" fill="none" stroke="#5b9dff" stroke-width="2"/>
  <text x="120" y="145" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">allows bursts</text>
  <polyline points="270,120 290,110 310,100 330,90 350,80 370,70 390,60 410,50 430,40 450,120" fill="none" stroke="#ffb454" stroke-width="2"/>
  <text x="360" y="145" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">smooth output rate</text>
  <polyline points="510,120 530,40 550,40 570,120 590,40 610,40 630,120 650,40 670,40 690,120" fill="none" stroke="#ff5c6c" stroke-width="2"/>
  <text x="600" y="145" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">spike at window reset</text>
</svg>`;

const topic = makeTopic({
  id: "rate-limit-algorithms",
  title: "Rate-Limit Algorithms",
  category: "hld-tradeoffs",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: "Token bucket, leaky bucket, fixed window, and sliding window — how each enforces limits and what traffic shape they produce.",
  sections: [
    {
      title: "The problem rate-limit algorithms solve",
      body: `<p>You must cap how many requests a client (user, IP, API key) can make in a time period — without melting your database or unfairly blocking legitimate burst traffic (mobile app opens 8 parallel API calls on launch).</p>
<p>Every algorithm answers two questions: <b>(1)</b> when do we reject? <b>(2)</b> what traffic <i>shape</i> do we allow between rejections? The shape difference is what interviewers test — not just "use Redis".</p>`,
    },
    {
      title: "Token bucket",
      body: `<p><b>Mental model:</b> a bucket holds tokens. Tokens refill at a steady rate (<code>refill_rate = limit / window</code>). Each request spends one token. Bucket has a <b>maximum capacity</b> (limit + burst allowance).</p>
<pre>capacity = limit + burst        // e.g. 100/min + 20 burst = 120 max tokens
refill   = limit / window_sec // 100/60 ≈ 1.67 tokens per second

on request:
  refill tokens based on elapsed time (cap at capacity)
  if tokens >= 1: consume; ALLOW
  else: DENY; retry_after = tokens_needed / refill_rate</pre>
<p><b>Traffic shape:</b> allows bursts up to <code>capacity</code>, then enforces average rate. A client idle for 30s accumulates tokens and can burst — desirable for interactive apps.</p>
<p><b>Used by:</b> AWS API Gateway, Stripe, most HTTP APIs. <b>State:</b> 2 numbers per key (tokens, last_refill_ts).</p>`,
    },
    {
      title: "Leaky bucket",
      body: `<p><b>Mental model:</b> requests enter a queue (bucket). The bucket <i>leaks</i> at a fixed rate — only <code>leak_rate</code> requests per second exit to the backend. If the queue is full, new requests are dropped immediately.</p>
<pre>queue_max = burst_size
leak_rate = limit / window_sec

on request:
  leak queue based on elapsed time
  if queue not full: enqueue; ALLOW (or queue for later processing)
  else: DENY (overflow)</pre>
<p><b>Traffic shape:</b> output to backend is <b>perfectly smooth</b> — no bursts downstream. Input can arrive in bursts but backend sees steady drip.</p>
<p><b>Used by:</b> network traffic shaping, some message brokers. <b>Key difference from token bucket:</b> leaky bucket <i>queues</i> (adds latency); token bucket typically rejects immediately. For HTTP APIs you usually want immediate 429, so token bucket wins.</p>`,
    },
    {
      title: "Fixed window counter",
      body: `<p><b>Mental model:</b> divide time into windows (e.g. each minute). Count requests in current window. Reset counter at window boundary.</p>
<pre>window_id = floor(now / window_sec)
key = f"{client}:{window_id}"

on request:
  count = INCR key
  EXPIRE key window_sec
  if count <= limit: ALLOW
  else: DENY</pre>
<p><b>Traffic shape:</b> simple but has the <b>boundary problem</b> — 100 requests at 00:59 and 100 at 01:00 = 200 in 2 seconds while "100 per minute" was intended.</p>
<p><b>Used by:</b> naive implementations, some CDNs. <b>State:</b> 1 counter per key per window — very cheap. Fix boundary with sliding window.</p>`,
    },
    {
      title: "Sliding window log & sliding window counter",
      body: `<p><b>Sliding window log:</b> store timestamp of each request in a sorted set. On check, remove entries older than <code>now - window</code>, count remainder. <b>Accurate</b> but memory-heavy (one entry per request).</p>
<p><b>Sliding window counter (hybrid):</b> blend previous window and current window counts — used by Redis rate limiting recipes and Cloudflare:</p>
<pre>prev_count = count in previous window
curr_count = count in current window
elapsed_pct = (now % window) / window
weighted = prev_count * (1 - elapsed_pct) + curr_count
if weighted <= limit: ALLOW</pre>
<p>Fixes boundary spike with O(1) state (two counters). Slightly approximate but good enough for APIs.</p>`,
    },
    {
      title: "Comparison",
      figureAfter: "algo-shapes",
      body: `<table>
<tr><th>Algorithm</th><th>Burst allowed?</th><th>State size</th><th>Boundary spike?</th><th>Best for</th></tr>
<tr><td>Token bucket</td><td>Yes (configurable)</td><td>Small (2 fields)</td><td>No</td><td>HTTP APIs, user-facing limits</td></tr>
<tr><td>Leaky bucket</td><td>Input burst, smooth output</td><td>Queue depth</td><td>No</td><td>Protecting downstream steady-rate systems</td></tr>
<tr><td>Fixed window</td><td>Until window full</td><td>1 counter</td><td><b>Yes</b></td><td>Simple internal tools only</td></tr>
<tr><td>Sliding window counter</td><td>Moderate</td><td>2 counters</td><td>Mostly no</td><td>CDN/WAF, high-scale edge</td></tr>
</table>
<p><b>Default recommendation for API rate limiting:</b> token bucket. Add sliding window counter at CDN edge if you need cheap per-IP limits on millions of keys.</p>`,
    },
    {
      title: "Decision guide",
      body: `<p>Choose <b>token bucket</b> when clients need legitimate bursts and you return 429 immediately. Choose <b>leaky bucket</b> when downstream (DB, partner API) can only absorb fixed QPS and you can queue. Choose <b>sliding window counter</b> at the edge for memory-efficient per-IP limits. Never use raw fixed window in production without acknowledging the boundary spike.</p>
<p>In interviews: name the algorithm, draw the traffic shape, state Redis state per key, mention atomic Lua — that separates senior from junior answers.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Saying "Redis INCR" without naming which algorithm — INCR alone is fixed window.</li>
<li>Claiming leaky bucket and token bucket are identical — they produce different traffic shapes.</li>
<li>Ignoring burst — mobile clients and browsers send parallel requests.</li>
<li>Storing every request timestamp at 50k RPS — sliding log doesn't scale; use counter hybrid.</li>
</ul>`,
    },
  ],
  figures: [
    { id: "algo-shapes", svg: ALGO_SVG, caption: "Same average rate, different burst behavior: token bucket allows spikes; leaky bucket smooths output; fixed window spikes at window boundaries." },
  ],
  related: ["rate-limiter-service", "token-bucket", "leaky-bucket", "edge-rate-limiting"],
});

export const meta = topic.meta;
export const content = topic.content;
