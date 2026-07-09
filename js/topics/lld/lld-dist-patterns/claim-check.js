// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const CLAIM_SVG = `<svg viewBox="0 0 560 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Claim check store and reference"><defs><marker id="fig-claim-check-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="55" width="90" height="42" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="59" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Producer</text><text x="59" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">5 MB blob</text><rect x="150" y="18" width="120" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="210" y="40" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">S3 / blob store</text><rect x="150" y="98" width="120" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="210" y="120" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Queue (ref only)</text><rect x="330" y="98" width="90" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="375" y="120" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Consumer</text><rect x="450" y="55" width="96" height="42" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="498" y="72" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">fetch blob</text><text x="498" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">by ref</text><line x1="104" y1="66" x2="148" y2="42" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-claim-check-arr)"/><line x1="104" y1="82" x2="148" y2="112" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-claim-check-arr)"/><line x1="270" y1="116" x2="328" y2="116" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-claim-check-arr)"/><line x1="420" y1="108" x2="470" y2="90" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-claim-check-arr)"/><text x="210" y="72" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">store payload &#8594; get key</text></svg>`;

const topic = makeTopic({
  id: "claim-check",
  title: "Claim Check",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Keep large payloads out of the message bus: store the blob externally and send only a reference the consumer redeems.",
  sections: [
    {
      title: "The problem: big payloads clog the broker",
      body: `<p>Message brokers are tuned for many small messages. Kafka defaults to a ~1 MB max message size; SQS caps at 256 KB. Pushing a 5 MB invoice PDF, a batch export, or a base64 image through the bus balloons broker storage, blows past size limits, wrecks throughput, and makes every consumer pay to move bytes it may not need.</p>
<p>The <b>claim check</b> pattern (named after a coat-check ticket) removes the bulky data from the message. You store the payload in external storage and put only a small <b>claim</b> — a reference — on the queue.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "claim-flow",
      body: `<p>Two stores work together:</p>
<ul>
<li>A <b>blob/object store</b> (S3, GCS, a database BLOB) holds the large payload and returns a key.</li>
<li>The <b>message bus</b> carries a lightweight message containing that key plus small metadata (content type, size, checksum, expiry).</li>
</ul>
<p>The message is now tiny and cheap to route, filter, and fan out. Only consumers that actually need the data dereference the claim.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li><b>Check in:</b> the producer writes the payload to the object store and receives a key/URL.</li>
<li>It publishes a message containing the reference (e.g. <code>{ "blobKey": "s3://payloads/abc123", "sha256": "..." }</code>).</li>
<li><b>Redeem:</b> the consumer reads the reference and fetches the payload from the store when it needs it.</li>
<li>A retention/TTL policy (or the consumer) deletes the blob once processed, so storage does not grow unbounded.</li>
</ol>
<pre>// --- Producer: store blob first, then publish lightweight reference ---
@Service
public class InvoiceClaimCheckProducer {
    private final S3Client s3;
    private final KafkaTemplate&lt;String, String&gt; kafka;

    public void publishInvoice(Payment payment, byte[] pdfBytes) {
        String key = "invoices/" + sha256(pdfBytes) + ".pdf";
        s3.putObject(PutObjectRequest.builder()
            .bucket("payment-payloads").key(key).build(),
            RequestBody.fromBytes(pdfBytes));
        ClaimCheckMessage ref = new ClaimCheckMessage(
            payment.getId(), key, pdfBytes.length, sha256(pdfBytes));
        kafka.send("invoice.generated", payment.getId().toString(), Json.write(ref));
    }
}

public record ClaimCheckMessage(
    UUID paymentId, String blobKey, long sizeBytes, String sha256) {}</pre>
<pre>// --- Consumer: redeem claim from S3 when needed ---
@Service
public class InvoiceArchiver {
    @KafkaListener(topics = "invoice.generated", groupId = "invoice-archiver")
    public void archive(ClaimCheckMessage ref) {
        byte[] pdf = s3.getObjectAsBytes(
            GetObjectRequest.builder()
                .bucket("payment-payloads").key(ref.blobKey()).build());
        verifySha256(pdf, ref.sha256());
        archiveStore.store(ref.paymentId(), pdf);
        s3.deleteObject(b -&gt; b.bucket("payment-payloads").key(ref.blobKey()));
    }
}</pre>`,
    },
    {
      title: "Details that bite",
      body: `<p><b>Consistency:</b> write the blob <em>before</em> publishing the reference, or a consumer may redeem a claim for data that is not there yet. <b>Lifecycle:</b> orphaned blobs accumulate if a message is lost after upload — pair with a TTL sweep. <b>Security:</b> the reference alone should not grant access; use signed URLs or authorization so a leaked message id is not a data breach. <b>Idempotency:</b> use content-addressed keys (hash of payload) so retries do not create duplicate blobs.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> keeps messages small and the broker fast; sidesteps size limits; consumers fetch large data only when needed; the store can serve richer access (range reads) than a queue.</p>
<p><b>Cons:</b> an extra store to operate plus lifecycle/cleanup logic; two-step write introduces a consistency and orphan-blob concern; consumers incur a second round trip to fetch; end-to-end tracing spans two systems. <b>Use when</b> payloads are large or variable-sized, or exceed broker limits; <b>avoid</b> for small messages where the indirection only adds latency and moving parts.</p>`,
    },
  ],
  figures: [
    { id: "claim-flow", svg: CLAIM_SVG, caption: "Claim check: the producer stores the large payload externally and publishes only a reference; the consumer redeems it from the blob store when needed." },
  ],
  related: ["content-enricher", "message-router", "transactional-outbox"],
});

export const meta = topic.meta;
export const content = topic.content;
