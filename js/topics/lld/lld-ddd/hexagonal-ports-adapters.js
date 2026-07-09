// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const HEX_SVG = `<svg viewBox="0 0 720 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hexagonal ports and adapters">
  <defs><marker id="fig-hexagonal-ports-adapters-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <polygon points="360,55 430,95 430,155 360,195 290,155 290,95" fill="#1a2236" stroke="#3ddc97" stroke-width="1.8"/>
  <text x="360" y="120" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Domain</text>
  <text x="360" y="138" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">core + ports</text>
  <rect x="40" y="60" width="140" height="34" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="110" y="81" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">REST controller</text>
  <rect x="40" y="150" width="140" height="34" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="110" y="171" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">queue consumer</text>
  <text x="110" y="115" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">driving adapters</text>
  <rect x="540" y="60" width="150" height="34" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/><text x="615" y="81" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Postgres repo</text>
  <rect x="540" y="150" width="150" height="34" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/><text x="615" y="171" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">gateway client</text>
  <text x="615" y="115" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">driven adapters</text>
  <line x1="180" y1="77" x2="288" y2="105" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-hexagonal-ports-adapters-arr)"/>
  <line x1="180" y1="167" x2="288" y2="150" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-hexagonal-ports-adapters-arr)"/>
  <line x1="432" y1="105" x2="538" y2="77" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-hexagonal-ports-adapters-arr)"/>
  <line x1="432" y1="150" x2="538" y2="167" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-hexagonal-ports-adapters-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "hexagonal-ports-adapters",
  title: "Hexagonal Ports & Adapters",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Put the domain at the center behind ports (interfaces); connect the outside world through adapters that plug into those ports.`,
  sections: [
    { title: `The idea`, body: `<p><b>Hexagonal architecture</b> (Alistair Cockburn's "ports and adapters") inverts the usual layer stack. Instead of the domain sitting on top of the database, the <b>domain core sits in the middle</b> and everything external — HTTP, database, message broker, third-party APIs — attaches at the edges. The core knows nothing about those technologies; it only knows about abstract <b>ports</b>. The goal is symmetry: the application should be equally drivable by a real HTTP request, a test harness, or a CLI, and equally backed by Postgres, an in-memory fake, or a mock.</p>` },
    { title: `Ports and adapters`, figureAfter: "hex", body: `<p>A <b>port</b> is an interface owned by the domain, expressed in domain terms. An <b>adapter</b> is a concrete implementation that bridges a port to a specific technology. They come in two directions:</p>
<pre>// INBOUND port — application service API
public interface PlaceOrderUseCase {
    OrderId place(PlaceOrderCommand command);
}

// DRIVING adapter — REST translates HTTP to domain command
@RestController
public class OrderController {
    private final PlaceOrderUseCase placeOrder;

    @PostMapping("/orders")
    public OrderResponse create(@RequestBody PlaceOrderRequest req) {
        OrderId id = placeOrder.place(req.toCommand());
        return OrderResponse.from(id);
    }
}

// OUTBOUND port — domain defines what it needs
public interface PaymentGateway {
    ChargeResult charge(ChargeRequest request);
}

// DRIVEN adapter — HTTP client to Stripe
public class StripeGatewayAdapter implements PaymentGateway {
    public ChargeResult charge(ChargeRequest req) { /* ... */ }
}</pre>
<p>The dependency arrows all point <b>inward</b>: adapters depend on the core's ports, never the reverse.</p>
<pre>// Inbound port: domain vocabulary
public interface CapturePaymentUseCase {
    ChargeResult capture(ChargeRequest request);
}

// Outbound port: domain vocabulary
public interface PaymentGatewayPort {
    ChargeResult charge(ChargeRequest request);
}

// Driving adapter: REST controller translates HTTP → domain
@RestController
class PaymentController implements CapturePaymentUseCase {
    private final CapturePaymentService service;

    @PostMapping("/payments")
    public ChargeResult capture(@RequestBody ChargeRequest request) {
        return service.capture(request);
    }
}

// Driven adapter: Stripe client implements outbound port
class StripeGatewayAdapter implements PaymentGatewayPort {
    private final StripeClient stripe;
    @Override
    public ChargeResult charge(ChargeRequest req) { /* map to Stripe SDK */ }
}</pre>` },
    { title: `Why it pays off`, body: `<p>The structure buys three things. <b>Testability:</b> because outbound ports are interfaces, you unit-test the domain with in-memory fakes and no database or network — fast, deterministic tests of real business logic. <b>Replaceability:</b> swapping the persistence adapter (Postgres → DynamoDB) or adding a new entry point (add a Kafka consumer beside the REST API) touches only an adapter, not the core. <b>Clarity of contracts:</b> every external dependency is named and typed as a port, so the surface area of the domain's outside world is explicit rather than smeared through the code.</p>` },
    { title: `Implementation and pitfalls`, body: `<p>In practice: one module for the domain (entities, value objects, application services, and the port interfaces), and separate adapter modules that depend on it, wired together by dependency injection at startup. The classic mistake is <b>leaking technology into the port</b> — a repository port that returns an ORM entity or a JPA <code>Page</code>, or a port that takes an HTTP request object. Keep port signatures in domain types only. The second pitfall is over-engineering: a small CRUD service with no real domain logic gets little from full hexagonal ceremony — plain layering is enough. Reach for it when the domain is rich and you need to isolate it from churny infrastructure.</p>
<pre>// LEAKY port: ORM type in domain interface
public interface LeakyPaymentRepository {
    Page&lt;PaymentEntity&gt; findAll(Pageable page);  // JPA types in domain
}

// CLEAN port: domain types only
public interface PaymentRepository {
    Optional&lt;Payment&gt; findById(PaymentId id);
    void save(Payment payment);
}

// Module wiring at startup
@Configuration
class PaymentWiring {
    @Bean PaymentGatewayPort gateway(StripeClient stripe) {
        return new StripeGatewayAdapter(stripe);
    }
    @Bean PaymentRepository payments(PaymentJpaRepository jpa) {
        return new JpaPaymentRepository(jpa);
    }
}</pre>` },
  ],
  figures: [
    { id: "hex", svg: HEX_SVG, caption: "Driving adapters call inbound ports; the domain calls outbound ports implemented by driven adapters. All dependencies point inward." },
  ],
  related: ["layered-architecture", "repository-pattern", "anti-corruption-code-boundary", "aggregate-root"],
});

export const meta = topic.meta;
export const content = topic.content;
