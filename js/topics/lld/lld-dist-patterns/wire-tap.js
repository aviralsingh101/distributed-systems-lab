// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const TAP_SVG = `<svg viewBox="0 0 540 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wire tap duplicates messages to an inspection channel"><defs><marker id="fig-wire-tap-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="52" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="59" y="76" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Producer</text><rect x="160" y="52" width="90" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="205" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Wire Tap</text><text x="205" y="84" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">copy</text><rect x="320" y="20" width="130" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="385" y="42" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">main consumer</text><rect x="320" y="88" width="130" height="36" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="385" y="110" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">audit / monitor</text><line x1="104" y1="72" x2="158" y2="72" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-wire-tap-arr)"/><line x1="250" y1="66" x2="318" y2="42" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-wire-tap-arr)"/><line x1="250" y1="78" x2="318" y2="102" stroke="#ffb454" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#fig-wire-tap-arr)"/><text x="270" y="134" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">exact copy to secondary channel; primary flow unchanged</text></svg>`;

const topic = makeTopic({
  id: "wire-tap",
  title: "Wire Tap",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: "Non-invasively copy every message on a channel to a secondary channel for audit, monitoring, or debugging — without disturbing the primary flow.",
  sections: [
    {
      title: "The problem: observing a flow without altering it",
      body: `<p>You need to audit payment messages for compliance, sample traffic for debugging, or feed a monitoring pipeline — but you must not slow down or change the behavior of the primary message flow. Bolting inspection logic into the real consumer couples observation to processing and risks breaking production.</p>
<p>The <b>wire tap</b> pattern (from Enterprise Integration Patterns) inserts a simple element into the channel that <em>duplicates</em> each message: the original continues to its destination unchanged, and an identical copy is routed to a secondary inspection channel.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "tap-flow",
      body: `<p>A wire tap is a fixed <b>recipient list</b> with two outputs: the intended destination and the tap channel. Its defining property is transparency — it must send an <em>unmodified</em> copy onward, so downstream behavior is identical to having no tap at all.</p>
<ul>
<li><b>Primary output:</b> the message proceeds to the real consumer as usual.</li>
<li><b>Tap output:</b> a copy goes to an audit/monitor/debug consumer.</li>
</ul>
<p>Concretely this is often a publish/subscribe topic with multiple subscribers, or a broker feature (Kafka: an extra consumer group; a proxy: mirror to a shadow endpoint).</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>A message arrives at the tap point.</li>
<li>The tap forwards the original to the primary channel.</li>
<li>It emits a copy to the secondary channel, ideally asynchronously so tapping never adds latency or backpressure to the main path.</li>
<li>The tap consumer analyzes, stores, or samples the copy independently.</li>
</ol>
<p>Because the tap consumer is decoupled, if it is slow or down the primary flow is unaffected.</p>
<pre>// --- Kafka: primary consumer group + separate audit consumer group ---
@Service
public class PaymentSettlementHandler {
    @KafkaListener(topics = "payment.events", groupId = "settlement-primary")
    @Transactional
    public void settle(PaymentCapturedEvent event) {
        inbox.dedup(event.eventId());
        settlementLedger.post(event);
    }
}

@Service
public class PaymentAuditTap {
    // Same topic, different group — receives every message independently
    @KafkaListener(topics = "payment.events", groupId = "compliance-audit-tap")
    public void tap(PaymentCapturedEvent event) {
        auditStore.append(event); // read-only; never mutates settlement state
    }
}</pre>`,
    },
    {
      title: "Where it fits and what to watch",
      body: `<p>Common uses: audit trails, message archiving, live traffic sampling, and <b>shadow/mirror testing</b> (copying production traffic to a new service version to compare behavior). Keep the tap read-only and side-effect-free on the copy so shadow processing cannot touch real state. Because the copy carries the full payload, <b>PII and security</b> matter — the tap channel needs the same access controls and redaction as the primary. If order matters for analysis, tap after the point where ordering is established.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> observability, auditing, and shadow testing without touching the primary flow or the real consumer; easy to add and remove; decoupled failure domains.</p>
<p><b>Cons:</b> doubles message volume on the tapped path (storage/bandwidth cost); the copy can leak sensitive data if not secured; shadow consumers with side effects can cause real damage if misconfigured. <b>Use when</b> you must inspect a flow non-invasively; <b>avoid</b> when the volume overhead is prohibitive or when in-line processing (a filter/transformer in the main path) is what you actually need.</p>`,
    },
  ],
  figures: [
    { id: "tap-flow", svg: TAP_SVG, caption: "Wire tap: an unmodified copy of each message is routed to a secondary channel for audit or monitoring while the primary flow continues untouched." },
  ],
  related: ["message-router", "content-enricher", "splitter-aggregator", "correlation-trace-ids"],
});

export const meta = topic.meta;
export const content = topic.content;
