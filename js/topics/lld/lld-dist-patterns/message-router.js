// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const ROUTER_SVG = `<svg viewBox="0 0 540 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Message router directs by content"><defs><marker id="fig-message-router-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs><rect x="14" y="62" width="90" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="59" y="86" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Producer</text><rect x="150" y="58" width="110" height="48" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="205" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Router</text><text x="205" y="92" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">read, decide</text><rect x="330" y="14" width="120" height="32" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="390" y="34" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">card handler</text><rect x="330" y="64" width="120" height="32" rx="6" fill="#1a2236" stroke="#ffb454" stroke-width="1.5"/><text x="390" y="84" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">wallet handler</text><rect x="330" y="114" width="120" height="32" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/><text x="390" y="134" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">invalid / DLQ</text><line x1="104" y1="82" x2="148" y2="82" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-message-router-arr)"/><line x1="260" y1="76" x2="328" y2="32" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-message-router-arr)"/><line x1="260" y1="82" x2="328" y2="80" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-message-router-arr)"/><line x1="260" y1="90" x2="328" y2="128" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-message-router-arr)"/><text x="230" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">one input, N outputs; picks exactly one by rule</text></svg>`;

const topic = makeTopic({
  id: "message-router",
  title: "Message Router",
  category: "lld-dist-patterns",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: "Send each message to a different destination based on its content or rules, decoupling producers from the topology of consumers.",
  sections: [
    {
      title: "The problem: producers should not know the topology",
      body: `<p>Different messages need different handling. A card payment goes to the card processor, a wallet payment to the internal ledger flow, an international one to a compliance check. If the producer hard-codes these decisions, it becomes coupled to every consumer and must change whenever routing rules change.</p>
<p>A <b>message router</b> (from Enterprise Integration Patterns) centralizes this decision. It consumes from one input channel, inspects each message, and forwards it to exactly one of several output channels — without modifying the message.</p>`,
    },
    {
      title: "Structure",
      figureAfter: "router-flow",
      body: `<p>A router is a message endpoint with one input and many outputs, plus a decision rule:</p>
<ul>
<li><b>Content-based router</b> — decides from the message body/headers (payment type, amount, region).</li>
<li><b>Context-based router</b> — decides from external state (feature flag, tenant config, current load).</li>
</ul>
<p>Its defining constraint: it is a <em>pure director</em>. It does not transform the payload (that is a translator's job) and it forwards to <b>one</b> destination (fan-out to many is a recipient list / publish-subscribe). Because rules live in one place, adding a route is a single-component change.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<ol>
<li>Consume a message from the input channel.</li>
<li>Evaluate the routing rule against its content/headers/context.</li>
<li>Publish the unchanged message to the matching output channel.</li>
<li>If no rule matches, send it to an <b>invalid-message</b> channel or dead-letter queue rather than dropping it.</li>
</ol>
<p>Keep the rules externalized (config/DSL) so routing changes do not require redeploying logic; keep the router stateless so it scales as competing consumers.</p>
<pre>// --- Content-based router: one input topic, N output topics ---
@Service
public class PaymentMessageRouter {
    private final KafkaTemplate&lt;String, String&gt; kafka;

    @KafkaListener(topics = "payment.inbound", groupId = "payment-router")
    public void route(InboundPaymentMessage msg) {
        String destination = switch (msg.paymentMethod()) {
            case CARD -&gt; "payment.card";
            case WALLET -&gt; "payment.wallet";
            case BANK_TRANSFER -&gt; "payment.bank";
            default -&gt; "payment.invalid";
        };
        kafka.send(destination, msg.walletId(), Json.write(msg));
    }
}

@ConfigurationProperties(prefix = "routing")
public record RoutingRules(Map&lt;String, String&gt; methodToTopic) {}</pre>`,
    },
    {
      title: "Failure modes and variants",
      body: `<p>A router is a chokepoint: if it is down, nothing flows, so it must be highly available and fast. Always define a default/invalid route so unmatched messages are captured, not lost. When routing rules grow complex or must be maintained by non-developers, a <b>rules engine</b> or dynamic routing table helps. Related patterns: a <b>splitter</b> breaks one message into many, an <b>aggregator</b> recombines them, and a <b>content enricher</b> may run before the router so it can route on looked-up attributes.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Pros:</b> decouples producers from consumer topology; centralizes and simplifies routing changes; enables A/B, tenant-based, and load-aware dispatch.</p>
<p><b>Cons:</b> a potential single point of failure and bottleneck; routing logic can become a hidden monolith of business rules; harder to trace a message's path across dynamic routes. <b>Use when</b> messages legitimately need different destinations and the rules change; <b>avoid</b> when there is one obvious destination (point-to-point) or when consumers can self-select via topic subscriptions.</p>`,
    },
  ],
  figures: [
    { id: "router-flow", svg: ROUTER_SVG, caption: "Message router: one input channel, several outputs; the router inspects each message and forwards it unchanged to exactly one destination." },
  ],
  related: ["splitter-aggregator", "content-enricher", "wire-tap", "priority-queue-consumer", "dead-letter-pattern"],
});

export const meta = topic.meta;
export const content = topic.content;
