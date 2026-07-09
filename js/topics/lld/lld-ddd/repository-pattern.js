// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const REPO_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Repository as collection abstraction">
  <defs><marker id="fig-repository-pattern-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="60" width="160" height="50" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="110" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Domain service</text>
  <text x="110" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">thinks in aggregates</text>
  <rect x="280" y="55" width="180" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="370" y="79" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">WalletRepository</text>
  <text x="370" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">add / findById / save</text>
  <rect x="550" y="60" width="150" height="50" rx="6" fill="#1a2236" stroke="#93a1bd" stroke-width="1.5"/>
  <text x="625" y="82" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Postgres / ORM</text>
  <text x="625" y="99" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">SQL, mapping</text>
  <line x1="190" y1="85" x2="278" y2="85" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-repository-pattern-arr)"/>
  <line x1="460" y1="85" x2="548" y2="85" stroke="#7c5cff" stroke-width="1.4" marker-end="url(#fig-repository-pattern-arr)"/>
  <text x="370" y="140" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">interface in domain · implementation in infrastructure</text>
</svg>`;

const topic = makeTopic({
  id: "repository-pattern",
  title: "Repository Pattern",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `An abstraction that lets the domain load and store aggregates as if they were an in-memory collection, hiding all persistence detail.`,
  sections: [
    { title: `What a repository is`, body: `<p>A <b>repository</b> gives the domain the illusion of an in-memory <b>collection</b> of aggregates. Code says <code>wallets.findById(id)</code> or <code>wallets.add(wallet)</code> and never sees SQL, an ORM session, or a query language. The repository mediates between the domain model and the data mapping layer, translating between rich domain objects and rows. Its purpose is to keep persistence concerns out of the domain so business logic reads as if the database did not exist.</p>` },
    { title: `Structure`, figureAfter: "repo", body: `<p>The pattern splits across the dependency boundary:</p>
<ul>
<li>The <b>interface</b> (e.g. <code>WalletRepository</code>) is declared in the <b>domain</b> layer, in domain terms — its methods take and return aggregates, not DTOs or rows.</li>
<li>The <b>implementation</b> lives in <b>infrastructure</b> and does the real work: SQL/ORM queries, object-relational mapping, caching.</li>
</ul>
<p>This is dependency inversion in action: the domain depends on an abstraction it owns, and infrastructure implements it. The immediate benefit is <b>testability</b> — swap in an in-memory list implementation to unit-test domain logic with no database.</p>
<pre>// Domain layer: interface in domain terms, returns aggregates
public interface PaymentRepository {
    Optional&lt;Payment&gt; findById(PaymentId id);
    void save(Payment payment);
    void delete(PaymentId id);
}

// Infrastructure: JPA implementation hides SQL and mapping
@Repository
class JpaPaymentRepository implements PaymentRepository {
    private final PaymentJpaRepository jpa;
    private final PaymentMapper mapper;

    @Override
    public Optional&lt;Payment&gt; findById(PaymentId id) {
        return jpa.findById(id.value()).map(mapper::toDomain);
    }

    @Override
    public void save(Payment payment) {
        PaymentEntity entity = mapper.toEntity(payment);
        jpa.save(entity);
    }

    @Override
    public void delete(PaymentId id) {
        jpa.deleteById(id.value());
    }
}

// Test double: in-memory, no database
class InMemoryPaymentRepository implements PaymentRepository {
    private final Map&lt;PaymentId, Payment&gt; store = new HashMap&lt;&gt;();
    @Override public Optional&lt;Payment&gt; findById(PaymentId id) { return Optional.ofNullable(store.get(id)); }
    @Override public void save(Payment p) { store.put(p.id(), p); }
    @Override public void delete(PaymentId id) { store.remove(id); }
}</pre>` },
    { title: `Repository vs DAO / generic repository`, body: `<p>A repository is <b>not</b> a generic table-per-entity DAO with <code>getAll</code>/<code>update</code>/<code>delete</code> on every column. Key differences: a repository is <b>per aggregate root</b> (one for Order, none for its child LineItems — you fetch the whole Order), it deals in <b>whole aggregates</b> so invariants stay intact, and its query methods speak the domain (<code>findOverdueInvoices()</code>) rather than exposing arbitrary SQL. A "generic <code>Repository&lt;T&gt;</code>" that leaks <code>IQueryable</code>/HQL back to callers defeats the point — it re-exposes the database and lets business logic build ad-hoc queries anywhere.</p>` },
    { title: `Persistence, transactions, and pitfalls`, body: `<p>Repositories usually pair with a <b>Unit of Work</b>: the repository stages loads and changes, and the unit of work commits them in one transaction, tracking what changed. Because an aggregate is the consistency and transaction boundary, <code>save(order)</code> persists the whole aggregate atomically. Pitfalls to avoid: repository methods that return partial aggregates and let callers mutate detached pieces (breaks invariants); a repository per non-root entity (invites cross-aggregate writes); and pushing pagination/reporting queries through the same abstraction — heavy read/reporting concerns are usually better served by a separate query model (CQRS) that bypasses the domain aggregates entirely.</p>
<pre>// GOOD: save whole Payment aggregate (root + embedded lines)
payments.save(payment);  // one transaction, all lines persisted

// BAD: repository per child entity — callers mutate LineItems directly
paymentLineRepository.update(line);  // bypasses Payment root invariants

// BAD: reporting query through write repository
paymentRepository.findAllCapturedLastMonth(Pageable.unpaged()); // use query handler instead</pre>` },
  ],
  figures: [
    { id: "repo", svg: REPO_SVG, caption: "The domain uses a collection-like repository interface; the infrastructure implementation hides the SQL and object mapping." },
  ],
  related: ["aggregate-root", "hexagonal-ports-adapters", "layered-architecture", "cqrs-handler-separation"],
});

export const meta = topic.meta;
export const content = topic.content;
