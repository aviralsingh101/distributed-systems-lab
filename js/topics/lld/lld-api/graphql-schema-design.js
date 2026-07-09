// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "graphql-schema-design",
  title: "GraphQL Schema Design",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Expose a typed graph of your domain that clients query for exactly the fields they need — powerful for clients, but it moves cost and the N+1 trap onto the server.`,
  sections: [
    { title: `The model: one typed graph`, body: `<p><b>GraphQL</b> replaces many fixed REST endpoints with a single endpoint and a <b>strongly-typed schema</b> describing your domain as a graph of types and their relationships. Clients send a query naming exactly the fields they want; the server returns exactly that shape. This directly attacks REST's <b>over-fetching</b> (getting fields you don't need) and <b>under-fetching</b> (having to call three endpoints to build one screen) — a mobile client can fetch a payment, its order, and the customer name in one round trip, requesting only the columns it renders.</p>
<pre>// schema.graphqls — domain types, not table shapes
type Payment {
  id: ID!
  amountMinor: Long!
  currency: String!
  status: PaymentStatus!
  wallet: Wallet!
  ledgerEntries(first: Int, after: String): LedgerEntryConnection!
}

type Wallet {
  id: ID!
  balanceMinor: Long!
  currency: String!
  ownerName: String
}

type LedgerEntry {
  id: ID!
  amountMinor: Long!
  createdAt: DateTime!
}

enum PaymentStatus { PENDING CAPTURED DECLINED REFUNDED }

type Query {
  payment(id: ID!): Payment
  payments(first: Int!, after: String): PaymentConnection!
}</pre>` },
    { title: `Structure: types, operations, resolvers`, body: `<p>Schema design has three moving parts:</p>
<ul>
<li><b>Types</b> — the nodes of the graph (<code>Payment</code>, <code>Order</code>, <code>Wallet</code>) with fields and edges to other types. Model the domain, not your tables.</li>
<li><b>Operations</b> — <b>Query</b> (reads), <b>Mutation</b> (writes, run serially), and <b>Subscription</b> (server push over a live channel).</li>
<li><b>Resolvers</b> — a function per field that knows how to fetch it. A query is executed by walking the tree and invoking each field's resolver.</li>
</ul>
<p>The resolver-per-field model is what makes GraphQL flexible — and is also the source of its signature performance problem.</p>
<pre>// Spring GraphQL resolver — one method per field
@Controller
public class PaymentResolver {

    private final PaymentRepository paymentRepository;
    private final WalletDataLoader walletLoader;

    public PaymentResolver(PaymentRepository paymentRepository,
                           WalletDataLoader walletLoader) {
        this.paymentRepository = paymentRepository;
        this.walletLoader = walletLoader;
    }

    @QueryMapping
    public Payment payment(@Argument String id) {
        return paymentRepository.findById(id)
            .orElseThrow(() -&gt; new PaymentNotFoundException(id));
    }

    // Field resolver: Payment.wallet — batched via DataLoader
    @SchemaMapping(typeName = "Payment", field = "wallet")
    public CompletableFuture&lt;Wallet&gt; wallet(Payment payment) {
        return walletLoader.load(payment.getWalletId());
    }

    @MutationMapping
    public Payment chargeWallet(@Argument ChargeInput input) {
        return paymentRepository.charge(
            input.walletId(),
            input.amountMinor(),
            input.currency(),
            input.idempotencyKey()
        );
    }
}

public record ChargeInput(
    String walletId,
    long amountMinor,
    String currency,
    String idempotencyKey
) {}</pre>` },
    { title: `The N+1 problem and DataLoader`, body: `<p>Because each field resolves independently, a query like "list 50 payments and each payment's wallet owner" naively runs <b>1 query for the payments + 50 queries for the owners</b> — the <b>N+1 problem</b>. It's easy to write a schema that quietly issues hundreds of database calls per request.</p>
<p>The standard fix is <b>batching and caching per request</b>, implemented with <b>DataLoader</b>: instead of each resolver hitting the DB, it registers the key it needs; DataLoader collects the keys within a tick and issues one batched query (<code>WHERE wallet_id IN (...)</code>), then hands each resolver its result. This collapses N+1 into 2 queries. Designing resolvers to be batch-friendly is the central discipline of GraphQL server design.</p>
<pre>// DataLoader: collapse N wallet lookups into one IN query
@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class WalletDataLoader {

    private final WalletRepository walletRepository;
    private final DataLoader&lt;String, Wallet&gt; loader;

    public WalletDataLoader(WalletRepository walletRepository) {
        this.walletRepository = walletRepository;
        this.loader = DataLoader.newMappedDataLoader(this::batchLoad);
    }

    public CompletableFuture&lt;Wallet&gt; load(String walletId) {
        return loader.load(walletId);
    }

    private CompletableFuture&lt;Map&lt;String, Wallet&gt;&gt; batchLoad(Set&lt;String&gt; walletIds) {
        return CompletableFuture.supplyAsync(() -&gt;
            walletRepository.findAllById(walletIds).stream()
                .collect(Collectors.toMap(Wallet::getId, w -&gt; w))
        );
    }
}

// Ledger entries resolver — same batching pattern
@SchemaMapping(typeName = "Payment", field = "ledgerEntries")
public LedgerEntryConnection ledgerEntries(
        Payment payment,
        @Argument int first,
        @Argument String after) {
    return ledgerEntryRepository.findByPaymentId(payment.getId(), first, after);
}</pre>` },
    { title: `Guarding the server and evolving the schema`, body: `<p>Because clients compose arbitrary queries, a malicious or careless query can be catastrophically expensive (deeply nested, huge lists). Protect the server with <b>query depth limits</b>, <b>complexity/cost analysis</b> (budget per query), pagination via <b>Relay-style connections</b> (cursor-based <code>edges</code>/<code>pageInfo</code>) instead of unbounded lists, and persisted/allow-listed queries for public traffic.</p>
<p>Evolution differs from REST: GraphQL is typically <b>not versioned</b>. You add fields freely and <b>deprecate</b> old ones with <code>@deprecated(reason: ...)</code>, removing them once clients stop using them (analytics on field usage guides this). Errors are also different — a partial response can return <code>data</code> plus an <code>errors</code> array, so clients must handle per-field failure rather than a single HTTP status. Choose GraphQL when diverse clients need flexible, tailored reads over a rich graph; keep it off simple CRUD where REST is lighter.</p>
<pre>// Relay-style connection for payments — cursor pagination, no unbounded lists
type PaymentConnection {
  edges: [PaymentEdge!]!
  pageInfo: PageInfo!
}

type PaymentEdge {
  cursor: String!
  node: Payment!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

@QueryMapping
public PaymentConnection payments(
        @Argument int first,
        @Argument String after) {
    if (first &gt; 100) {
        throw new GraphQLBadRequestException("first must be &lt;= 100");
    }
    return paymentRepository.findConnection(first, after);
}

// Deprecation — evolve without breaking clients
type Payment {
  id: ID!
  amountMinor: Long!
  amountCents: Long! @deprecated(reason: "Use amountMinor")
}</pre>` },
  ],
  related: ["grpc-service-design", "rest-resource-modeling", "pagination-offset-cursor", "contract-first-vs-code-first", "api-versioning-strategies"],
});

export const meta = topic.meta;
export const content = topic.content;
