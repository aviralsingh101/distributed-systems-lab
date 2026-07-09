// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const topic = makeTopic({
  id: "work-queue",
  title: "Work Queue",
  category: "lld-async",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Buffer tasks in a durable queue and let a pool of workers pull and process them at their own pace, smoothing bursts and scaling by adding workers.`,
  sections: [
    { title: `What a work queue is`, body: `<p>A <b>work queue</b> (task queue) decouples the <em>submission</em> of a job from its <em>execution</em>. A producer enqueues a task; a pool of workers pulls tasks and runs them asynchronously. It is a point-to-point pattern focused on offloading slow or spiky work — generating a PDF receipt, calling the <b>Payment Gateway</b>, running a settlement batch — out of the request path.</p>
<p>The queue acts as a <b>buffer</b>: when arrivals temporarily exceed processing capacity, tasks accumulate instead of overwhelming the workers or failing the caller. This turns a load spike into a longer queue rather than a cascade of errors.</p>` },
    { title: `Structure and pull-based flow`, body: `<p>The pattern is deliberately <b>pull-based</b>: workers ask for the next task when they are ready, which naturally load-balances toward faster/idle workers and is a form of backpressure — a saturated worker simply stops pulling.</p>
<ol>
<li>Producer serializes a task (type + payload + idempotency key) and enqueues it.</li>
<li>An idle worker fetches one task (or a small prefetch batch) and marks it in-flight via a visibility timeout / unacked state.</li>
<li>The worker executes, then <b>acks</b> on success so the broker deletes it, or <b>nacks</b>/lets the timeout expire on failure so it is redelivered.</li>
<li>Autoscaling adds or removes workers based on <b>queue depth</b> and consumer lag.</li>
</ol>` },
    { title: `Reliability and semantics`, body: `<p>To survive crashes the queue must be <b>durable</b> and use ack-on-completion, which yields <b>at-least-once</b> delivery: a worker that dies mid-task loses its ack and the task is retried, so tasks can run more than once. Handlers must therefore be <b>idempotent</b>, keyed on a task/idempotency id.</p>
<p>Control redelivery with a bounded <b>retry policy</b> (exponential backoff) and route repeatedly failing tasks to a <b>dead-letter queue</b> so one poison task cannot burn worker capacity forever. Set a sensible prefetch count: too high and a slow worker hoards messages it cannot process; too low and workers idle between fetches.</p>` },
    { title: `Operating and when to use it`, body: `<p>The signals that matter are <b>queue depth</b> (backlog) and <b>consumer lag</b> (how far behind workers are). A steadily growing backlog means arrival rate exceeds throughput — add workers or shed load; a flat-then-spiky backlog is normal burst absorption. Watch for the queue quietly hiding an under-provisioned worker pool.</p>
<p>Use a work queue whenever work can be done asynchronously and you want to smooth bursts, isolate slow dependencies, and scale processing independently of request traffic. If instead multiple services must each react to an event, use pub/sub; if the caller needs the result, use request-reply.</p>
<pre>// --- Producer: enqueue task, return immediately ---
@RestController
public class ReceiptController {
    private final KafkaTemplate&lt;String, String&gt; kafka;

    @PostMapping("/v1/payments/{id}/receipt")
    public ResponseEntity&lt;Void&gt; enqueueReceipt(@PathVariable UUID id) {
        GenerateReceiptTask task = new GenerateReceiptTask(id, UUID.randomUUID());
        kafka.send("receipt.generate", id.toString(), Json.write(task));
        return ResponseEntity.accepted().build();
    }
}

public record GenerateReceiptTask(UUID paymentId, UUID taskId) {}</pre>
<pre>// --- Worker pool: pull, process, ack on success ---
@Service
public class ReceiptWorker {
    @KafkaListener(
        topics = "receipt.generate",
        groupId = "receipt-workers",
        concurrency = "5"
    )
    @Transactional
    public void generate(GenerateReceiptTask task) {
        inbox.dedup(task.taskId());
        Payment payment = paymentRepo.findById(task.paymentId()).orElseThrow();
        byte[] pdf = pdfRenderer.render(payment);
        objectStore.put("receipts/" + task.paymentId() + ".pdf", pdf);
    }
}</pre>` },
  ],
  related: ["point-to-point", "pub-sub-pattern", "dead-letter-pattern", "backpressure-pattern", "api-idempotency"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("work-queue", stage, panel, stageEl);
}
