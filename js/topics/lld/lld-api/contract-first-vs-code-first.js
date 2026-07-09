// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "contract-first-vs-code-first",
  title: "Contract-First vs Code-First",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Do you write the API schema (OpenAPI/proto) first and generate code from it, or write the code first and generate the schema from it?`,
  sections: [
    { title: `Two directions of truth`, body: `<p>Every API has a contract — the schema describing its endpoints, types, and errors (OpenAPI for REST, <code>.proto</code> for gRPC, SDL for GraphQL). The question is which artifact is the <b>source of truth</b>. In <b>contract-first</b> (design-first) you author the schema by hand, then generate server stubs, client SDKs, and validation from it. In <b>code-first</b> you write the implementation (annotated handlers/structs) and a tool generates the schema from your code.</p>
<p>This is a real fork about coupling, collaboration, and drift — not a matter of taste.</p>
<pre>// Contract-first OpenAPI fragment — reviewed before any Java exists
// openapi/payments-v1.yaml
// paths:
//   /v1/payments/{id}:
//     get:
//       operationId: getPayment
//       responses:
//         '200':
//           content:
//             application/json:
//               schema:
//                 $ref: '#/components/schemas/PaymentResponse'
// components:
//   schemas:
//     PaymentResponse:
//       type: object
//       required: [id, walletId, amountMinor, status]
//       properties:
//         id: { type: string }
//         walletId: { type: string }
//         amountMinor: { type: integer, format: int64 }
//         status: { type: string, enum: [PENDING, CAPTURED, DECLINED] }</pre>` },
    { title: `Contract-first — when it wins`, body: `<p>You design the schema (often collaboratively, in a repo) before implementing. Tools like OpenAPI Generator / protoc emit server interfaces and typed clients.</p>
<p><b>Pros:</b> the contract is an explicit, reviewable agreement, so front-end/back-end/partner teams can work in <b>parallel</b> against a stub and mock immediately. It enables <b>consumer-driven contracts</b> and prevents the implementation from accidentally shaping the API. The schema can't silently drift from intent because it <em>is</em> the intent. <b>Cons:</b> more upfront ceremony; you must keep generated code and hand-written logic in sync; and editing large schemas by hand (and regenerating) has friction. gRPC is essentially always contract-first because proto is mandatory.</p>
<pre>// Generated interface from OpenAPI — implement, don't edit
public interface PaymentsApi {

    @GetMapping("/v1/payments/{id}")
    PaymentResponse getPayment(@PathVariable("id") String id);

    @PostMapping("/v1/payments")
    ResponseEntity&lt;PaymentResponse&gt; createPayment(
        @RequestBody CreatePaymentRequest body,
        @RequestHeader("Idempotency-Key") String idempotencyKey);
}

// Hand-written implementation behind the generated contract
@RestController
public class PaymentsApiController implements PaymentsApi {

    private final PaymentService paymentService;

    public PaymentsApiController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Override
    public PaymentResponse getPayment(String id) {
        return paymentService.findById(id)
            .orElseThrow(() -&gt; new PaymentNotFoundException(id));
    }

    @Override
    public ResponseEntity&lt;PaymentResponse&gt; createPayment(
            CreatePaymentRequest body, String idempotencyKey) {
        PaymentResponse created = paymentService.create(body, idempotencyKey);
        return ResponseEntity.created(URI.create("/v1/payments/" + created.id()))
            .body(created);
    }
}</pre>` },
    { title: `Code-first — when it wins`, body: `<p>You write the handlers and models; a library introspects them to produce the OpenAPI/GraphQL schema (e.g. from decorators/annotations).</p>
<p><b>Pros:</b> fastest to start, no separate schema to maintain, and the docs are generated from code so they can't lag the implementation for existing fields. Natural fit for small teams, internal services, and rapid iteration where the code <em>is</em> the design. <b>Cons:</b> the API shape becomes a byproduct of implementation details, which leaks internals and makes breaking changes easy to introduce unnoticed; parallel client development is harder (no contract until the code exists); and cross-team/partner review is weaker because there's no agreed artifact reviewed before coding.</p>
<pre>// Code-first: SpringDoc generates OpenAPI from annotations at runtime
@RestController
@RequestMapping("/v1/wallets")
@Tag(name = "Wallets", description = "Wallet balance and ledger operations")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    @Operation(summary = "Get wallet by ID")
    @ApiResponse(responseCode = "200", description = "Wallet found")
    @ApiResponse(responseCode = "404", description = "Wallet not found")
    @GetMapping("/{walletId}")
    public WalletResponse getWallet(
            @Parameter(description = "Wallet UUID") @PathVariable String walletId) {
        return walletService.findById(walletId)
            .orElseThrow(() -&gt; new WalletNotFoundException(walletId));
    }

    @PostMapping
    @Operation(summary = "Create a new wallet")
    public ResponseEntity&lt;WalletResponse&gt; createWallet(
            @Valid @RequestBody CreateWalletRequest request) {
        WalletResponse created = walletService.create(request);
        return ResponseEntity.created(URI.create("/v1/wallets/" + created.id()))
            .body(created);
    }
}</pre>` },
    { title: `Decision guide`, body: `<ul>
<li><b>Choose contract-first</b> for public/partner APIs, multi-team or multi-language ecosystems, and anywhere the interface must be stable and reviewed independently of implementation — and always for gRPC.</li>
<li><b>Choose code-first</b> for small teams, internal-only services, prototypes, and single-language shops iterating quickly, where speed beats formal upfront agreement.</li>
<li><b>Either way, close the loop:</b> commit the schema to version control, run it through <b>contract tests</b> and a <b>breaking-change linter</b> in CI, and publish generated SDKs. The failure to avoid — in both approaches — is <b>drift</b> between what the schema says and what the server actually does.</li>
</ul>
<p>Many mature teams converge on contract-first as the API surface grows and more consumers depend on stability.</p>
<pre>// gRPC is always contract-first — proto drives both sides
// payment.proto → protoc generates Java stubs
//   PaymentServiceGrpc.PaymentServiceImplBase  (server)
//   PaymentServiceGrpc.PaymentServiceBlockingStub  (client)

@GrpcService
public class PaymentGrpcService extends PaymentServiceGrpc.PaymentServiceImplBase {
    // Implementation conforms to the proto contract — no drift possible
    @Override
    public void charge(ChargeRequest request, StreamObserver&lt;ChargeReply&gt; observer) {
        // ...
    }
}

// CI: breaking-change linter on openapi/payments-v1.yaml
//   oasdiff breaking openapi/payments-v1.yaml openapi/payments-v1-pr.yaml</pre>` },
  ],
  related: ["api-versioning-strategies", "rest-resource-modeling", "grpc-service-design", "graphql-schema-design", "error-contract-design"],
});

export const meta = topic.meta;
export const content = topic.content;
