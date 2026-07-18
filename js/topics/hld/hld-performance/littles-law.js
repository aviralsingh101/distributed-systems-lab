// @article-v2
// @hld-gold
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "littles-law", title: "Little's Law", category: "prod-eng" };

const LITTLES_SVG = `<svg viewBox="0 0 720 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Little's Law L = λW">
  <defs><marker id="fig-littles-law-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="22" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">L = λ × W — inventory = arrival rate × time in system</text>
  <rect x="40" y="55" width="160" height="70" rx="8" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="120" y="85" text-anchor="middle" fill="#cdd6e8" font-size="13" font-family="system-ui">λ (lambda)</text>
  <text x="120" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">arrivals / second</text>
  <rect x="260" y="55" width="160" height="70" rx="8" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="340" y="85" text-anchor="middle" fill="#cdd6e8" font-size="13" font-family="system-ui">W</text>
  <text x="340" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">avg time in system</text>
  <rect x="480" y="55" width="180" height="70" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="570" y="85" text-anchor="middle" fill="#cdd6e8" font-size="13" font-family="system-ui">L</text>
  <text x="570" y="105" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">avg # in system</text>
  <text x="220" y="92" fill="#5b9dff" font-size="18" font-family="system-ui">×</text>
  <text x="440" y="92" fill="#5b9dff" font-size="18" font-family="system-ui">=</text>
  <text x="360" y="160" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">Example: 200 req/s × 0.25 s latency ⇒ ~50 concurrent in-flight requests</text>
</svg>`;

export const content = {
  oneliner: `In a stable system, the average number of requests in flight equals arrival rate times average time spent in the system — L = λW.`,
  archetype: "concept",
  figures: [
    {
      id: "littles-law-eq",
      svg: LITTLES_SVG,
      caption: "Little's Law relates concurrency (L), throughput (λ), and latency (W). Raise latency or traffic and in-flight work grows — queues explode.",
    },
  ],
  sections: [
    {
      title: "The one formula every backend engineer needs",
      body: `<p>You do not need a queueing-theory PhD to use <b>Little's Law</b>. In steady state (arrivals ≈ completions over a long window):</p>
<pre>L = λ × W</pre>
<ul>
<li><b>L</b> — average number of items in the system (requests in flight, messages in a queue, shoppers in a store).</li>
<li><b>λ</b> (lambda) — average arrival rate (requests per second).</li>
<li><b>W</b> — average time an item spends in the system (latency, including queue wait).</li>
</ul>
<p>It is identity-like for averages: if 200 payments/s each take 250 ms end-to-end, you should expect about <code>200 × 0.25 = 50</code> concurrent payment flows somewhere in your fleet (threads, async tasks, DB connections held).</p>
<p>That number is capacity planning gold. Thread pools, connection pools, and pod counts must cover <b>L</b>, not just λ.</p>`,
    },
    {
      title: "Intuition with a coffee shop",
      figureAfter: "littles-law-eq",
      body: `<p>Customers arrive at 2 per minute (λ = 2/min). Each stays 10 minutes (W = 10). On average you will see <code>L = 20</code> people in the shop — ordering, waiting, drinking. Double the stay time (slow barista) without changing arrivals and the shop fills to 40. Same law for Kafka consumer lag: higher processing time ⇒ more messages “in the system” (lag).</p>
<p><b>Stable</b> means the system is not endlessly growing. If λ exceeds service capacity, W grows without bound and L → ∞ (queue buildup). Little's Law still holds over finite windows, but the useful design message is: you left steady state.</p>`,
    },
    {
      title: "Using it in HLD and incidents",
      body: `<p><b>Connection pools:</b> DB latency W = 20 ms, QPS λ = 5 000 → L ≈ 100 connections in use on average. Size pool &gt; L plus headroom for bursts (p99 W is higher than mean W — use p99 for safety).</p>
<p><b>Timeouts:</b> if you set HTTP timeout to 2 s and admit 1 000 RPS, a dependency outage can pin <code>L ≈ 2000</code> stuck calls — that is how thread pools die. Lower timeouts or shed load to cap W.</p>
<p><b>Back-of-envelope interview:</b> “We need 10k QPS at 100 ms → ~1 000 concurrent handlers; with 200 ms p99, plan ~2 000.” Then map to pods × threads.</p>
<p><b>Related:</b> queue buildup is Little's Law screaming that W is rising because the server cannot keep up with λ.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Sizing pools from QPS alone and ignoring latency (forgets L = λW).</li>
<li>Using best-case W instead of p99 when provisioning.</li>
<li>Applying the law during meltdown without noticing the system is unstable.</li>
<li>Confusing throughput λ with concurrency L.</li>
</ul>`,
    },
  ],
  related: ["queue-buildup", "tail-latency", "connection-pooling", "backpressure-pattern", "load-shedding"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("littles-law", stage, panel, stageEl);
}
