// @article-v2
// @sim-lab
// @hld-gold
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "leaky-bucket", title: "Leaky Bucket", category: "prod-eng" };

export const content = {
  oneliner: "Requests enter a queue that drains at a fixed rate — excess overflows and is rejected; output traffic to downstream is always smooth.",
  archetype: "concept",
  sections: [
    {
      title: "What is a leaky bucket?",
      body: `<p>A <b>leaky bucket</b> models a queue with a constant <i>leak rate</i>. Incoming requests add water to the bucket. Water drains (is processed) at a fixed rate regardless of how fast requests arrive. If the bucket overflows, excess requests are <b>dropped</b> (or rejected with 429).</p>
<p>Named by analogy: a bucket with a small hole in the bottom — water leaks out steadily. Pour too fast and it spills over the top.</p>
<p>Unlike token bucket (which allows the <i>client</i> to burst), leaky bucket allows burst <i>arrival</i> but enforces smooth <i>departure</i> — protecting downstream systems that can only handle steady QPS.</p>`,
    },
    {
      title: "How the algorithm works",
      body: `<p><b>Parameters:</b></p>
<ul>
<li><code>leak_rate</code> — requests processed per second (= <code>limit / window</code>)</li>
<li><code>bucket_size</code> — max queue depth (burst buffer)</li>
</ul>
<pre>function on_request():
  now = current_time_ms()
  // drain queue based on elapsed time
  leaked = (now - last_leak_ms) / 1000 * leak_rate
  queue_depth = max(0, queue_depth - leaked)
  last_leak_ms = now

  if queue_depth < bucket_size:
    queue_depth += 1
    schedule_process_at_leak_rate()  // or process immediately if leak slot free
    return ALLOW (may be queued)
  else:
    return DENY  // overflow</pre>
<p><b>Two variants:</b></p>
<ul>
<li><b>Queueing leaky bucket</b> — excess waits in queue (adds latency). Used in traffic shaping.</li>
<li><b>Drop-overflow leaky bucket</b> — reject immediately when full (like token bucket deny path). Used when queueing is unacceptable.</li>
</ul>`,
    },
    {
      title: "Token bucket vs leaky bucket",
      body: `<table>
<tr><th></th><th>Token bucket</th><th>Leaky bucket</th></tr>
<tr><td>Burst behavior</td><td>Client can burst if tokens accumulated</td><td>Arrivals can burst; <b>output</b> is smooth</td></tr>
<tr><td>On exceed</td><td>Immediate 429</td><td>Queue (latency) or drop</td></tr>
<tr><td>Protects</td><td>Your service from too many requests</td><td><b>Downstream</b> from irregular traffic</td></tr>
<tr><td>HTTP API default</td><td>Yes</td><td>Rare (queueing hurts UX)</td></tr>
</table>
<p><b>When to pick leaky bucket:</b> message consumer feeding a fixed-rate external API, video encoder pipeline, legacy mainframe with strict TPS cap — anywhere downstream must see clockwork steady input.</p>`,
    },
    {
      title: "HLD placement",
      body: `<p>Place leaky bucket <b>between</b> a bursty producer and a rate-sensitive consumer:</p>
<pre>Bursty API → [Leaky bucket queue] → steady drip → Partner API (100 TPS max)
Kafka consumer → [Leaky bucket] → HTTP webhook sender</pre>
<p>Implementation: in-process queue + timer goroutine, or Redis list + worker polling at fixed rate. For distributed leaky bucket, central queue (Redis Stream, SQS) with fixed worker pool count enforces leak rate.</p>
<p>Do <b>not</b> use leaky bucket at the public API edge unless you explicitly want to queue user requests (almost never for REST).</p>`,
    },
    {
      title: "Design decisions",
      body: `<p><b>Bucket size</b> = how much arrival burst you buffer before dropping. Larger bucket = more latency variance for queued requests.</p>
<p><b>Monitoring:</b> track queue depth p99, drop rate, and processing lag. Rising queue depth means leak_rate is below arrival rate sustained.</p>
<p><b>Backpressure:</b> when queue is 80% full, signal upstream (HTTP 503, Kafka pause) before hard overflow — combines leaky bucket with admission control.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<ul>
<li>Using leaky bucket for public REST without explaining queuing latency — users see slow responses, not 429.</li>
<li>Confusing with token bucket — know which allows client-side burst.</li>
<li>No bucket size — infinite queue masks overload until OOM.</li>
</ul>`,
    },
  ],
  related: ["rate-limit-algorithms", "token-bucket", "load-shedding", "admission-control"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("leaky-bucket", stage, panel, stageEl);
}
