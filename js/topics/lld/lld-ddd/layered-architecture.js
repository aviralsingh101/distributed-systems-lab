// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const LAYERS_SVG = `<svg viewBox="0 0 460 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Layered architecture stack">
  <defs><marker id="fig-layered-architecture-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="80" y="20" width="300" height="38" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/><text x="230" y="43" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Presentation (HTTP / API)</text>
  <rect x="80" y="66" width="300" height="38" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/><text x="230" y="89" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Application (use cases)</text>
  <rect x="80" y="112" width="300" height="38" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/><text x="230" y="135" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Domain (entities, rules)</text>
  <rect x="80" y="158" width="300" height="38" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/><text x="230" y="181" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Infrastructure (DB, brokers)</text>
  <line x1="400" y1="39" x2="400" y2="177" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-layered-architecture-arr)"/>
  <text x="426" y="112" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui" transform="rotate(90 426 112)">dependencies point down</text>
</svg>`;

const topic = makeTopic({
  id: "layered-architecture",
  title: "Layered Architecture",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Organize code into stacked layers — presentation, application, domain, infrastructure — where each depends only on the layer beneath it.`,
  sections: [
    { title: `The structure`, figureAfter: "layers", body: `<p><b>Layered (n-tier) architecture</b> partitions an application into horizontal layers, each with one responsibility, arranged so that <b>dependencies point in one direction only</b> — downward.</p>
<ul>
<li><b>Presentation:</b> HTTP controllers, serialization, request/response DTOs. No business rules.</li>
<li><b>Application:</b> orchestrates use cases — transactions, coordination between domain objects — but holds no business rules itself.</li>
<li><b>Domain:</b> entities, value objects, and the business invariants. The heart of the system.</li>
<li><b>Infrastructure / persistence:</b> databases, message brokers, external clients.</li>
</ul>
<p>The rule that gives the pattern its value: a layer may call the layer below, never the one above. A controller calls an application service; the domain never imports a controller.</p>
<pre>// Presentation layer — HTTP only, no business rules
@RestController
class PaymentApiController {
    private final CapturePaymentHandler handler;
    @PostMapping("/payments/{id}/capture")
    public PaymentResponse capture(@PathVariable String id) {
        handler.handle(new CapturePaymentCommand(new PaymentId(id)));
        return PaymentResponse.captured(id);
    }
}

// Application layer — orchestrates, no invariants
@Service
class CapturePaymentHandler {
    private final PaymentRepository payments;
    @Transactional
    public void handle(CapturePaymentCommand cmd) {
        Payment p = payments.findById(cmd.paymentId()).orElseThrow();
        p.capture();
        payments.save(p);
    }
}

// Domain layer — invariants live here
public final class Payment {
    public void capture() {
        if (status != PENDING) throw new IllegalStateException("not pending");
        status = CAPTURED;
    }
}</pre>` },
    { title: `Why direction matters`, body: `<p>The dependency direction is the whole point. It keeps volatile concerns (HTTP framework, ORM, message broker) out of stable ones (business rules), so you can change the transport or the database without touching the domain. In a <b>payment</b> service, the rule "a wallet balance may not go negative" lives in the domain layer and is expressed the same way whether the request arrived over REST or gRPC and whether balances are stored in Postgres or DynamoDB.</p>
<p>A common refinement is <b>strict</b> vs <b>relaxed</b> layering: strict forbids skipping layers (presentation must go through application); relaxed allows a layer to reach any lower layer. Strict is more decoupled; relaxed is less boilerplate.</p>` },
    { title: `The dependency-inversion refinement`, body: `<p>Naive layering has a flaw: the domain layer needs to persist entities, which seems to force a dependency <em>downward</em> onto infrastructure — coupling business rules to the database. The fix is <b>dependency inversion</b>: the domain layer <em>declares an interface</em> it needs (e.g. a <code>WalletRepository</code>), and the infrastructure layer <em>implements</em> it. At runtime infrastructure is injected, but at compile time the arrow points inward, toward the domain. This is the step that turns plain layering into hexagonal / clean architecture, and it is what keeps the domain testable with in-memory fakes.</p>
<pre>// --- Domain layer (no Spring, no JPA imports) ---
public class WalletService {
    private final WalletRepository wallets;
    private final PaymentGateway gateway;

    public WalletService(WalletRepository wallets, PaymentGateway gateway) {
        this.wallets = wallets;
        this.gateway = gateway;
    }

    public void topUp(WalletId id, Money amount, String paymentId) {
        Wallet w = wallets.findById(id).orElseThrow();
        ChargeResult r = gateway.charge(new ChargeRequest(paymentId, id, amount));
        if (r.status() == ChargeStatus.CAPTURED) {
            w.credit(amount);
            wallets.save(w);
        }
    }
}

// --- Infrastructure layer implements domain ports ---
@Repository
class JpaWalletRepository implements WalletRepository { /* ... */ }

@Component
class StripeGateway implements PaymentGateway { /* ... */ }</pre>` },
    { title: `Trade-offs and failure modes`, body: `<p>Layering is the sensible default: familiar, easy to navigate, and it isolates change. Its risks: the <b>anemic domain model</b>, where all logic leaks up into "service" classes and the domain layer degenerates into data bags — the layers exist on disk but the business rules are scattered. And <b>pass-through</b> layers that add a class per layer without adding behavior, inflating boilerplate. Keep real invariants in the domain, keep the application layer thin (orchestration only), and do not add a layer that only forwards calls.</p>
<pre>// ANEMIC: domain is a data bag, rules live in service (anti-pattern)
class Payment { private PaymentStatus status; /* getters/setters only */ }
class PaymentService {
    public void capture(Payment p) {
        if (p.getStatus() != PENDING) throw ...;  // invariant in wrong layer
        p.setStatus(CAPTURED);
    }
}

// RICH: domain enforces its own rules
class Payment {
    public void capture() {
        if (status != PENDING) throw new IllegalStateException("not pending");
        status = CAPTURED;
    }
}</pre>` },
  ],
  figures: [
    { id: "layers", svg: LAYERS_SVG, caption: "Each layer depends only on the layer below it; dependency inversion lets the domain define interfaces that infrastructure implements." },
  ],
  related: ["hexagonal-ports-adapters", "repository-pattern", "aggregate-root", "cqrs-handler-separation"],
});

export const meta = topic.meta;
export const content = topic.content;
