// @article-v2
// @hld-gold
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "tail-latency", title: "Tail Latency", category: "prod-eng" };

const TAIL_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tail latency fan-out">
  <defs><marker id="fig-tail-latency-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="360" y="20" text-anchor="middle" fill="#93a1bd" font-size="11" font-family="system-ui">Fan-out: parent latency ≈ max(child latencies) — tails amplify</text>
  <rect x="40" y="70" width="100" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="90" y="97" text-anchor="middle" fill="#cdd6e8" font-size="12" font-family="system-ui">API</text>
  <rect x="260" y="40" width="90" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="305" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">svc A p50</text>
  <rect x="260" y="90" width="90" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/>
  <text x="305" y="112" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">svc B p95</text>
  <rect x="260" y="140" width="90" height="36" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="305" y="162" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">svc C p99</text>
  <line x1="140" y1="92" x2="258" y2="58" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-tail-latency-arr)"/>
  <line x1="140" y1="92" x2="258" y2="108" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-tail-latency-arr)"/>
  <line x1="140" y1="92" x2="258" y2="158" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-tail-latency-arr)"/>
  <rect x="420" y="80" width="240" height="50" rx="6" fill="#1a2236" stroke="#ff5c6c" stroke-width="1.5"/>
  <text x="540" y="100" text-anchor="middle" fill="#ff5c6c" font-size="12" font-family="system-ui">User waits for slowest</text>
  <text x="540" y="118" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">parent p99 ≫ child p99</text>
</svg>`;

export const content = {
  oneliner: `Users feel the slowest percentile — p99/p999 — and fan-out microservices make those tails much worse than any single service's average.`,
  archetype: "concept",
  figures: [
    {
      id: "tail-fanout",
      svg: TAIL_SVG,
      caption: "When one API call fans out to many dependencies, the parent finishes only when the slowest child returns — so rare slow calls dominate user experience.",
    },
  ],
  sections: [
    {
      title: "Averages lie; tails tell the truth",
      body: `<p>Your Payment Gateway reports <b>average</b> latency 40 ms. Product still hears “checkout feels random.” The missing number is the <b>tail</b>: p95, p99, p999 — the latency that 5%, 1%, or 0.1% of requests exceed.</p>
<p>If p50 = 40 ms but p99 = 800 ms, one in a hundred checkouts feels broken. At 1 000 RPS that is ten unhappy users every second. SLOs for user-facing APIs should be written on tails (e.g. “p99 &lt; 300 ms”), not means.</p>
<p><b>Why tails exist:</b> GC pauses, noisy neighbors, lock waits, cold caches, slow disks, packet loss, oversized payloads. Means wash those events out; percentiles keep them visible.</p>`,
    },
    {
      title: "Fan-out amplification",
      figureAfter: "tail-fanout",
      body: `<p>Order Service calls Wallet, Fraud, FX, and Ledger in parallel. The API returns when <b>all</b> finish — latency ≈ <code>max(children)</code> (plus overhead).</p>
<p>If each dependency has a 1% chance of being “slow,” four independent calls yield roughly <code>1 - 0.99⁴ ≈ 4%</code> chance the parent is slow. Tails compound. Google’s “The Tail at Scale” paper is the classic reference for this effect.</p>
<p><b>Mitigations:</b></p>
<ul>
<li><b>Hedged requests</b> — after a delay, send a duplicate to another replica; cancel the loser (see Hedged Requests).</li>
<li><b>Deadline propagation</b> — pass remaining budget downstream so stragglers abort early.</li>
<li><b>Fewer serial hops</b> — collapse chatty RPCs; cache stable data.</li>
<li><b>Isolate latency classes</b> — don’t put admin export queries on the same pool as checkout.</li>
</ul>`,
    },
    {
      title: "Measuring and budgeting in HLD",
      body: `<p>In design interviews, sketch a latency budget: “200 ms p99 client SLO → 50 ms edge → 80 ms Order → 40 ms each parallel dependency.” If Fraud alone needs 120 ms p99, the design fails before you draw Kafka.</p>
<p>Load tests must not hide tails via coordinated omission (next topic): slow responses that free the client to wait will under-report offered load and tails.</p>
<p>Ops: track p50/p95/p99 per route, and <b>saturation</b> (queue depth, pool wait). Rising queue wait is Little's Law turning into visible tail latency.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Quoting only average latency for an SLO.</li>
<li>Fan-out of 10+ services with no hedge/deadline story.</li>
<li>Sharing one DB pool between interactive and batch traffic.</li>
<li>Ignoring GC / cold-start as first-class tail sources.</li>
</ul>`,
    },
  ],
  related: ["hedged-requests", "littles-law", "coordinated-omission-perf", "queue-buildup", "gc-pause"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("tail-latency", stage, panel, stageEl);
}
