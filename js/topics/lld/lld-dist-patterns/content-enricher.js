// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const ENR_SVG = `<svg viewBox="0 0 540 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Content enricher augments a message"><defs><marker id="fig-content-enricher-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="52" width="110" height="42" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="69" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">thin message</text><text x="69" y="84" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">wallet_id</text><rect x="200" y="50" width="120" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="260" y="68" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Enricher</text><text x="260" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">lookup + merge</text><rect x="220" y="8" width="120" height="30" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.2"/><text x="280" y="28" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Customer store</text><rect x="400" y="50" width="130" height="46" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="465" y="68" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">enriched message</text><text x="465" y="82" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">+name +tier +region</text><line x1="124" y1="73" x2="198" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-content-enricher-arr)"/><line x1="280" y1="50" x2="280" y2="40" stroke="#5b9dff" stroke-width="1.2" marker-end="url(#fig-content-enricher-arr)"/><line x1="320" y1="73" x2="398" y2="73" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-content-enricher-arr)"/></svg>`;

const topic = makeTopic({
  id: "content-enricher",
  title: "Content Enricher",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Fill the gaps in an incoming message by looking up missing data from another source and merging it in before downstream steps run.",
  sections: [
    {
      title: "The problem: the message lacks what downstream needs",
      body: `<p>A producer often emits a lean message — a payment event carrying just <code>wallet_id</code> and <code>amount</code> — because that is all it knows. But a downstream consumer (fraud scoring, notifications, the Ledger) needs more: the customer's name, tier, region, or the current balance. Making every producer include every possible field couples them to consumers and bloats messages.</p>
<p>The <b>content enricher</b> (from Enterprise Integration Patterns) sits between producer and consumer and <em>adds</em> the missing data by consulting a resource — a database, cache, or another service — then forwards the augmented message.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "enr-flow",
      body: `<p>An enricher is a message transformer with a side input:</p>
<ul>
<li><b>Input message</b> — carries a key (e.g. <code>wallet_id</code>) but not the full data.</li>
<li><b>Resource</b> — the source of truth the enricher queries (customer store, pricing service, geo-IP).</li>
<li><b>Output message</b> — the original fields plus the looked-up attributes merged in.</li>
</ul>
<p>It is the conceptual inverse of the <b>content filter</b> (which removes fields). The enricher only reads the resource; it does not change the resource's state.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>Receive the thin message and extract the correlation key(s).</li>
<li>Query the resource for the missing attributes (ideally batched or cached to avoid a per-message round trip).</li>
<li>Merge the results into the message payload.</li>
<li>Publish the enriched message onward.</li>
</ol>
<p>Because the lookup is on the hot path, caching and batching are the usual performance levers, and the resource being slow or down directly affects throughput.</p>
<pre>// --- Thin event in, enriched event out ---
public record PaymentCapturedThin(UUID eventId, String walletId, long amountCents) {}

public record PaymentCapturedEnriched(
    UUID eventId, String walletId, long amountCents,
    String customerName, String tier, String region) {}</pre>
<pre>@Service
public class PaymentEnricher {
    private final CustomerRepository customers;
    private final KafkaTemplate&lt;String, String&gt; kafka;

    @KafkaListener(topics = "payment.captured.thin")
    public void enrich(PaymentCapturedThin thin) {
        CustomerProfile profile = customers.findByWalletId(thin.walletId())
            .orElseThrow();
        PaymentCapturedEnriched enriched = new PaymentCapturedEnriched(
            thin.eventId(), thin.walletId(), thin.amountCents(),
            profile.name(), profile.tier(), profile.region());
        kafka.send("payment.captured.enriched",
            thin.walletId(), Json.write(enriched));
    }
}</pre>`,
    },
    {
      title: "Pitfalls and alternatives",
      body: `<p><b>Latency and coupling:</b> a synchronous lookup per message makes the enricher only as fast and available as its resource — cache aggressively and set timeouts. <b>Staleness:</b> enriched data reflects the resource at lookup time; if the customer's tier changes later, already-enriched messages are stale. <b>Consistency vs claim check:</b> the enricher adds <em>small</em> reference data; when the payload itself is large you want the <b>claim check</b> pattern instead. For read-heavy joins that do not need to be inline, a materialized/denormalized read model (CQRS) may beat per-message enrichment.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> keeps producers simple and messages lean; centralizes the join so many consumers reuse it; decouples who <em>has</em> the data from who <em>needs</em> it.</p>
<p><b>Cons:</b> adds latency and a runtime dependency on the resource; risk of stale or inconsistent enriched data; hot-path lookups need caching/batching to scale. <b>Use when</b> consumers routinely need attributes the producer lacks; <b>avoid</b> when the producer can cheaply include the data, or when the enrichment source is too slow/unreliable to sit on the message path.</p>`,
    },
  ],
  figures: [
    { id: "enr-flow", svg: ENR_SVG, caption: "Content enricher: a thin message's key is used to look up missing attributes from a resource, which are merged into an enriched message forwarded downstream." },
  ],
  related: ["claim-check", "message-router", "wire-tap", "cqrs-read-write-models"],
});

export const meta = topic.meta;
export const content = topic.content;
