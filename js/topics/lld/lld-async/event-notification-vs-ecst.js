// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const COMPARE_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Event notification vs event-carried state transfer">
  <defs><marker id="fig-event-notification-vs-ecst-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="180" y="20" text-anchor="middle" fill="#5b9dff" font-size="11" font-family="system-ui">Event Notification (thin)</text>
  <rect x="40" y="45" width="110" height="34" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="95" y="66" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">producer</text>
  <rect x="230" y="45" width="130" height="34" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="295" y="66" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">consumer</text>
  <line x1="150" y1="62" x2="228" y2="62" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-event-notification-vs-ecst-arr)"/>
  <text x="189" y="55" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">{id} only</text>
  <line x1="295" y1="79" x2="150" y2="95" stroke="#ffb454" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-event-notification-vs-ecst-arr)"/>
  <text x="230" y="105" text-anchor="middle" fill="#ffb454" font-size="8" font-family="system-ui">callback to fetch details</text>
  <text x="180" y="150" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">ECST (fat)</text>
  <rect x="40" y="160" width="110" height="30" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="95" y="179" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">producer</text>
  <rect x="230" y="160" width="130" height="30" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="295" y="179" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">consumer + local copy</text>
  <line x1="150" y1="175" x2="228" y2="175" stroke="#3ddc97" stroke-width="1.6" marker-end="url(#fig-event-notification-vs-ecst-arr)"/>
  <text x="189" y="168" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">full state</text>
  <text x="520" y="20" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Notification: small, always fresh,</text>
  <text x="520" y="36" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">but chatty callbacks + coupling.</text>
  <text x="520" y="150" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">ECST: autonomous consumers,</text>
  <text x="520" y="166" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">but bigger events + stale copies.</text>
</svg>`;

const topic = makeTopic({
  id: "event-notification-vs-ecst",
  title: "Event Notification vs ECST",
  category: "lld-async",
  track: "lld",
  tier: "hidden-gem",
  archetype: "tradeoff",
  oneliner: `Should an event be a thin "something changed, go look" ping, or carry the full changed state so consumers never call back?`,
  figures: [
    { id: "notif-vs-ecst", svg: COMPARE_SVG, caption: "Event Notification sends just an identifier and the consumer calls back for details; Event-Carried State Transfer embeds the full state so the consumer can keep its own local copy." },
  ],
  sections: [
    { title: `The two designs`, body: `<p>Both are event styles, but they differ in <em>how much they carry</em>. An <b>Event Notification</b> is deliberately thin: <code>PaymentCaptured {paymentId: 123}</code> — it announces that something happened and leaves it to the consumer to call back (query the producer's API) if it needs the details. <b>Event-Carried State Transfer (ECST)</b> is fat: the event embeds the full relevant state — amount, currency, wallet, status, timestamps — so the consumer has everything it needs without asking anyone.</p>
<p>This is not about which is "modern" — it is a trade between coupling, freshness, payload size, and consumer autonomy.</p>` },
    { title: `Event Notification — when it wins`, figureAfter: "notif-vs-ecst", body: `<p><b>Strengths:</b> tiny payloads; no risk of stale data in the event (the consumer fetches current state on demand); and you don't leak your full internal schema onto the bus. Good when the state is large, changes often between emit and consumption, or is sensitive (you'd rather gate access behind an API with authz).</p>
<p><b>Costs:</b> every interested consumer makes a synchronous <b>callback</b> to the producer, which reintroduces runtime coupling and load — a fan-out of notifications becomes a fan-in of queries (a read amplification / potential thundering herd on the producer). The consumer also cannot function if the producer is down when it needs details.</p>` },
    { title: `ECST — when it wins`, body: `<p><b>Strengths:</b> consumers become <b>autonomous</b> — they keep a local read-model built from the events and never call back, so they keep working even if the producer is offline. This is the foundation of read-side replicas / materialized views across services and removes synchronous request coupling.</p>
<p><b>Costs:</b> larger events; the producer publishes internal state, which risks schema coupling and exposing fields; each consumer stores a <b>duplicate copy</b> that is <em>eventually consistent</em> and can be stale or arrive out of order; and versioning/replay must be handled carefully so a consumer's copy converges to the truth.</p>` },
    { title: `Decision guide`, body: `<p>Choose based on the consumer's real need:</p>
<ul>
<li><b>Prefer ECST</b> when consumers must be resilient to producer downtime, need to build their own queryable view, or when callbacks would overload the producer — e.g. an analytics or notifications service that reacts to many payment events.</li>
<li><b>Prefer Event Notification</b> when state is large/volatile/sensitive, consumers rarely need the details, or you want to avoid publishing internal schema and are comfortable with a callback API.</li>
<li><b>Mixed</b> is common: notify with a compact event that includes the key fields most consumers need, plus an id/URL for the rest — a pragmatic middle ground.</li>
</ul>
<p>Whichever you pick, events must carry a stable <code>event_id</code> and version, and consumers must dedupe (at-least-once) and tolerate reordering.</p>
<pre>// --- Event Notification: thin payload, consumer calls back ---
public record PaymentCapturedNotification(
    UUID eventId, UUID paymentId) {}

@Service
public class NotificationThinConsumer {
    private final RestClient orderService;

    @KafkaListener(topics = "payment.captured.notify", groupId = "notifications")
    public void onNotify(PaymentCapturedNotification n) {
        PaymentDetails details = orderService.get()
            .uri("/v1/payments/" + n.paymentId())
            .retrieve()
            .body(PaymentDetails.class); // synchronous callback to producer
        emailService.sendReceipt(details.customerEmail(), details);
    }
}</pre>
<pre>// --- ECST: fat payload, consumer builds local read model ---
public record PaymentCapturedEcst(
    UUID eventId,
    UUID paymentId,
    String walletId,
    long amountCents,
    String currency,
    String customerEmail,
    String status,
    Instant capturedAt) {}

@Service
public class AnalyticsEcstConsumer {
    @KafkaListener(topics = "payment.captured.ecst", groupId = "analytics")
    @Transactional
    public void onEcst(PaymentCapturedEcst event) {
        inbox.dedup(event.eventId());
        analyticsRepo.upsert(PaymentFact.from(event)); // no callback needed
    }
}</pre>` },
  ],
  related: ["pub-sub-pattern", "event-driven-architecture", "cqrs", "event-sourcing", "outbox-inbox-combo"],
});

export const meta = topic.meta;
export const content = topic.content;
