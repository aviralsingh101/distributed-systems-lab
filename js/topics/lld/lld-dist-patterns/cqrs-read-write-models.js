// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const CQRS_SVG = `<svg viewBox="0 0 560 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CQRS command and query split"><defs><marker id="fig-cqrs-read-write-models-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="60" width="80" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/><text x="54" y="84" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text><rect x="150" y="16" width="110" height="38" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="205" y="33" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Command</text><text x="205" y="47" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">write model</text><rect x="150" y="106" width="110" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="205" y="123" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Query</text><text x="205" y="137" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">read model</text><rect x="320" y="16" width="100" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="370" y="39" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Write store</text><rect x="320" y="106" width="100" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="370" y="129" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Read store</text><line x1="94" y1="72" x2="148" y2="40" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cqrs-read-write-models-arr)"/><line x1="94" y1="88" x2="148" y2="122" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cqrs-read-write-models-arr)"/><line x1="260" y1="35" x2="318" y2="35" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cqrs-read-write-models-arr)"/><line x1="260" y1="125" x2="318" y2="125" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-cqrs-read-write-models-arr)"/><line x1="370" y1="54" x2="370" y2="104" stroke="#7c5cff" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#fig-cqrs-read-write-models-arr)"/><text x="452" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">async</text><text x="452" y="94" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">projection</text></svg>`;

const topic = makeTopic({
  id: "cqrs-read-write-models",
  title: "CQRS Read/Write Models",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Split the model that accepts writes from the model that serves reads, so each is shaped and scaled for its own job.",
  sections: [
    {
      title: "The problem: one model, two conflicting jobs",
      body: `<p>A single domain model must simultaneously enforce write invariants and answer queries. These pull in opposite directions. Writes want a normalized, aggregate-shaped model that guarantees consistency (debit a Wallet only if balance &#8805; amount). Reads want denormalized, query-shaped data (a "customer statement" joining payments, refunds, and fees) served fast without expensive joins.</p>
<p><b>CQRS</b> (Command Query Responsibility Segregation) resolves this by using <em>two separate models</em>: a <b>command (write) model</b> and a <b>query (read) model</b>. It is not two databases by definition — at minimum it is two code paths — but it commonly extends to two stores.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "cqrs-flow",
      body: `<p>The two sides have distinct responsibilities:</p>
<ul>
<li><b>Command side</b> — accepts commands (<code>CapturePayment</code>), loads the aggregate, checks invariants, and persists changes to the write store. It returns success/failure, not data.</li>
<li><b>Query side</b> — serves read models (DTOs / projections) tailored to each screen or API, from a store optimized for reading (denormalized tables, a search index, a cache).</li>
</ul>
<p>The read store is kept up to date by <b>projecting</b> writes into it. The write side emits events (via a <b>transactional outbox</b> or CDC); projection handlers consume them and update the read model.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>A command hits the write model; it validates and commits one local transaction, emitting <code>PaymentCaptured</code>.</li>
<li>A projector consumes the event and upserts the read model — e.g. increments the customer's <code>total_paid</code> and appends a row to a flattened statement table.</li>
<li>Queries hit only the read store and never touch the write aggregates.</li>
</ol>
<p>Because projection is asynchronous, the read model is <b>eventually consistent</b> with the write model.</p>
<pre>// --- Write side: command handler + outbox in one transaction ---
@Service
public class CapturePaymentHandler {
    @Transactional
    public void handle(CapturePaymentCommand cmd) {
        Payment payment = paymentRepo.save(Payment.capture(cmd));
        outbox.save(OutboxEntity.of("PaymentCaptured", payment.getId(), payment.toJson()));
    }
}

// --- Read side: denormalized statement table (never touched by writes) ---
@Entity
@Table(name = "customer_statement_read")
public class StatementLine {
    @Id private UUID id;
    private UUID customerId;
    private long amountCents;
    private Instant capturedAt;
}</pre>
<pre>// --- Projector: consumes events, upserts read model ---
@Service
public class StatementProjector {
    @KafkaListener(topics = "payment.events", groupId = "statement-projection")
    @Transactional
    public void onPaymentCaptured(PaymentCapturedEvent e) {
        inbox.dedup(e.eventId());
        statementRepo.save(new StatementLine(e));
    }
}

@RestController
public class StatementQueryController {
    @GetMapping("/v1/customers/{id}/statement")
    public List&lt;StatementLine&gt; statement(@PathVariable UUID id) {
        return statementRepo.findByCustomerIdOrderByCapturedAtDesc(id);
    }
}</pre>`,
    },
    {
      title: "The consistency gap you must design for",
      body: `<p>After a successful command, a client may read a stale value for a short window (the projection lag). This breaks naive "write then immediately read" UX. Mitigations: return the new state directly in the command response; version reads and have the client wait for its own write's version (read-your-writes); or, for a critical screen, read from the write model. Never pretend the lag is zero.</p>
<p>CQRS pairs naturally with <b>event sourcing</b> (the event log is the write model and projections build read models), but the two are independent — you can do CQRS over ordinary CRUD tables.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> each side scales and is modeled independently (read replicas, search indexes, caches for the query side); complex reads become simple lookups; write model stays small and invariant-focused.</p>
<p><b>Cons:</b> more moving parts (projections, event flow, two stores to keep in sync); eventual consistency complicates UX and testing; over-applied to a simple CRUD app it is pure overhead. <b>Use when</b> read and write loads or shapes diverge sharply, or reads vastly outnumber writes; <b>avoid when</b> a single well-indexed table serves both comfortably.</p>`,
    },
  ],
  figures: [
    { id: "cqrs-flow", svg: CQRS_SVG, caption: "CQRS: commands go to the write model and store; an asynchronous projection updates a separate read store that queries hit." },
  ],
  related: ["event-sourcing-projection", "cqrs-handler-separation", "transactional-outbox", "cdc-relay", "denormalization-patterns"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("cqrs-read-write-models", stage, panel, stageEl);
}
