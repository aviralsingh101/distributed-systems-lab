// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "grpc-service-design",
  title: "gRPC Service Design",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Define services and messages in a .proto contract, then get generated, strongly-typed clients and servers that talk binary Protobuf over HTTP/2.`,
  sections: [
    { title: `What gRPC is`, body: `<p><b>gRPC</b> is a contract-first RPC framework: you declare <b>services</b> and their <b>messages</b> in a <code>.proto</code> file, and the compiler generates client and server code in many languages. On the wire it uses <b>Protocol Buffers</b> (compact binary) over <b>HTTP/2</b>, which brings multiplexed streams on one connection, header compression, and full-duplex streaming. Compared to JSON/REST it trades human-readability for speed, a strict typed schema, and low-latency service-to-service calls — the sweet spot for internal microservices like Order Service ↔ Ledger.</p>
<pre>// payment.proto — contract-first, the source of truth
syntax = "proto3";
package payments.v1;

service PaymentService {
  rpc Charge(ChargeRequest) returns (ChargeReply);
  rpc GetPayment(GetPaymentRequest) returns (Payment);
  rpc StreamLedgerEntries(StreamLedgerRequest)
      returns (stream LedgerEntry);
}

message ChargeRequest {
  string wallet_id = 1;
  int64 amount_minor = 2;
  string currency = 3;
  string idempotency_key = 4;
}

message ChargeReply {
  string payment_id = 1;
  PaymentStatus status = 2;
  string processor_ref = 3;
}

enum PaymentStatus {
  PAYMENT_STATUS_UNSPECIFIED = 0;
  PAYMENT_STATUS_CAPTURED = 1;
  PAYMENT_STATUS_PENDING = 2;
  PAYMENT_STATUS_DECLINED = 3;
}</pre>` },
    { title: `Structure: the proto contract`, body: `<p>The design surface is the proto. You define a service and its RPCs, and messages built from numbered fields:</p>
<p><code>service PaymentService { rpc Charge(ChargeRequest) returns (ChargeReply); }</code> and <code>message ChargeRequest { string wallet_id = 1; int64 amount_minor = 2; string currency = 3; }</code>.</p>
<p>The <b>field numbers</b> are the contract, not the names — they are what's encoded on the wire. This drives the backward-compatibility rules: you may <b>add</b> new fields with new numbers, and old readers ignore unknown fields; you must <b>never reuse or renumber</b> a field, and you <code>reserved</code> removed numbers so they can't be recycled. Design messages to evolve: prefer adding optional fields over changing existing ones.</p>
<pre>// Evolving the contract — add fields, reserve removed numbers
message ChargeRequest {
  string wallet_id = 1;
  int64 amount_minor = 2;
  string currency = 3;
  string idempotency_key = 4;
  // New optional field — old clients ignore field 5
  string merchant_id = 5;
  reserved 6;           // was: legacy_card_token
  reserved "card_token"; // reserve the name too
}

message Payment {
  string id = 1;
  string wallet_id = 2;
  int64 amount_minor = 3;
  string currency = 4;
  PaymentStatus status = 5;
  int64 created_at_epoch_ms = 6;
}</pre>` },
    { title: `The four RPC types`, body: `<p>gRPC's streaming, enabled by HTTP/2, gives four call shapes — choosing the right one is the core design decision:</p>
<ul>
<li><b>Unary</b> — one request, one response. The default; use for ordinary calls like <code>Charge</code>.</li>
<li><b>Server streaming</b> — one request, a stream of responses (e.g. stream ledger entries or live status updates).</li>
<li><b>Client streaming</b> — a stream of requests, one response (e.g. upload a batch of transactions, get a summary).</li>
<li><b>Bidirectional streaming</b> — both sides stream independently over one connection (e.g. a live reconciliation feed).</li>
</ul>
<pre>// Java service implementation — unary + server streaming
@GrpcService
public class PaymentServiceImpl extends PaymentServiceGrpc.PaymentServiceImplBase {

    private final PaymentDomainService paymentDomainService;
    private final LedgerRepository ledgerRepository;

    public PaymentServiceImpl(PaymentDomainService paymentDomainService,
                              LedgerRepository ledgerRepository) {
        this.paymentDomainService = paymentDomainService;
        this.ledgerRepository = ledgerRepository;
    }

    // Unary: Charge(wallet, amount) → ChargeReply
    @Override
    public void charge(ChargeRequest request, StreamObserver&lt;ChargeReply&gt; responseObserver) {
        try {
            ChargeResult result = paymentDomainService.charge(
                request.getWalletId(),
                request.getAmountMinor(),
                request.getCurrency(),
                request.getIdempotencyKey()
            );
            ChargeReply reply = ChargeReply.newBuilder()
                .setPaymentId(result.paymentId())
                .setStatus(mapStatus(result.status()))
                .setProcessorRef(result.processorRef())
                .build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        } catch (InsufficientFundsException ex) {
            responseObserver.onError(Status.FAILED_PRECONDITION
                .withDescription("wallet_insufficient_funds")
                .asRuntimeException());
        }
    }

    // Server streaming: stream ledger entries for a wallet
    @Override
    public void streamLedgerEntries(StreamLedgerRequest request,
                                    StreamObserver&lt;LedgerEntry&gt; responseObserver) {
        ledgerRepository.streamByWalletId(request.getWalletId())
            .forEach(entry -&gt; {
                responseObserver.onNext(LedgerEntry.newBuilder()
                    .setId(entry.getId())
                    .setAmountMinor(entry.getAmountMinor())
                    .setCreatedAtEpochMs(entry.getCreatedAt().toEpochMilli())
                    .build());
            });
        responseObserver.onCompleted();
    }
}</pre>` },
    { title: `Errors, deadlines, and operating it`, body: `<p>gRPC has its own <b>status codes</b> (<code>OK</code>, <code>INVALID_ARGUMENT</code>, <code>NOT_FOUND</code>, <code>ALREADY_EXISTS</code>, <code>FAILED_PRECONDITION</code>, <code>UNAVAILABLE</code>, <code>DEADLINE_EXCEEDED</code>…) — map domain failures to these deliberately, and use <code>google.rpc.Status</code> details for structured error payloads. Every call should carry a <b>deadline/timeout</b> (propagated across hops) so a slow dependency can't hang the whole chain; <code>UNAVAILABLE</code> and <code>DEADLINE_EXCEEDED</code> are the retryable ones.</p>
<p>Operational realities: gRPC needs HTTP/2 end-to-end, so load balancers must do <b>L7 (per-request) balancing</b> — a naive L4 LB pins all requests to one backend because connections are long-lived. Browsers can't speak gRPC directly (use gRPC-Web or a gateway). Use gRPC for internal, high-throughput, polyglot service meshes; keep REST/JSON at the public edge.</p>
<pre>// Client: propagate deadline and map retryable statuses
public class LedgerGrpcClient {

    private final PaymentServiceGrpc.PaymentServiceBlockingStub stub;

    public LedgerGrpcClient(ManagedChannel channel) {
        this.stub = PaymentServiceGrpc.newBlockingStub(channel)
            .withDeadlineAfter(3, TimeUnit.SECONDS);
    }

    public ChargeReply charge(String walletId, long amountMinor, String currency,
                              String idempotencyKey) {
        ChargeRequest request = ChargeRequest.newBuilder()
            .setWalletId(walletId)
            .setAmountMinor(amountMinor)
            .setCurrency(currency)
            .setIdempotencyKey(idempotencyKey)
            .build();
        try {
            return stub.charge(request);
        } catch (StatusRuntimeException ex) {
            Status.Code code = ex.getStatus().getCode();
            if (code == Status.Code.UNAVAILABLE || code == Status.Code.DEADLINE_EXCEEDED) {
                throw new RetryableGrpcException(ex);
            }
            if (code == Status.Code.NOT_FOUND) {
                throw new WalletNotFoundException(walletId);
            }
            throw ex;
        }
    }
}</pre>` },
  ],
  related: ["contract-first-vs-code-first", "graphql-schema-design", "api-versioning-strategies", "error-contract-design", "rest-resource-modeling"],
});

export const meta = topic.meta;
export const content = topic.content;
