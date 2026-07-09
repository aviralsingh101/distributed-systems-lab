// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const CLASS_SVG = `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Proxy class structure">
  <defs><marker id="fig-proxy-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="200" y="12" width="170" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="285" y="31" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">«interface» Ledger</text>
  <line x1="200" y1="40" x2="370" y2="40" stroke="#26324a"/>
  <text x="210" y="57" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">+ postEntry(txn)</text>
  <rect x="20" y="120" width="120" height="44" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="80" y="146" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">caller</text>
  <rect x="200" y="120" width="170" height="56" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="285" y="140" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">LedgerProxy</text>
  <text x="285" y="157" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">authz + cache, then delegate</text>
  <rect x="410" y="120" width="140" height="56" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="480" y="146" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">RealLedger</text>
  <text x="480" y="162" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">(subject)</text>
  <line x1="140" y1="142" x2="198" y2="148" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-proxy-arr)"/>
  <line x1="285" y1="120" x2="285" y2="66" stroke="#7c5cff" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-proxy-arr)"/>
  <line x1="480" y1="120" x2="360" y2="60" stroke="#3ddc97" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-proxy-arr)"/>
  <line x1="370" y1="150" x2="408" y2="150" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-proxy-arr)"/>
  <text x="388" y="142" fill="#93a1bd" font-size="8" font-family="system-ui">delegates</text>
</svg>`;

const topic = makeTopic({
  id: "proxy",
  title: "Proxy",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Stand in for another object with the same interface so you can control access to it — lazily, remotely, or under a policy.`,
  sections: [
    { title: `Intent`, body: `<p><b>Proxy</b> provides a surrogate or placeholder for another object to <b>control access</b> to it. The proxy implements the same interface as the real subject, so callers cannot tell they are talking to a stand-in, but the proxy can add checks, caching, laziness, or remoting around each call.</p>
<p>Access control is the key word. A <code>LedgerProxy</code> can verify the caller holds the right scope before letting a <code>postEntry</code> reach the real ledger, and can serve recent reads from a cache — all without the caller changing a line.</p>
<pre>// --- Subject: the interface both proxy and real object share ---
public interface Ledger {
    void postEntry(LedgerEntry entry);
    List&lt;LedgerEntry&gt; entriesFor(String accountId);
}

// NOT an Adapter (same interface — controls access, does not reshape APIs)
// NOT a Decorator (controls one subject's lifecycle — not meant to stack concerns)</pre>` },
    { title: `Common varieties`, body: `<p>Proxies differ by <em>what</em> they control:</p>
<ul>
<li><b>Protection proxy</b> — enforces authorization/quotas before delegating (our ledger example).</li>
<li><b>Virtual proxy</b> — defers creating an expensive subject until first real use (lazy connection to a payment gateway).</li>
<li><b>Remote proxy</b> — a local stand-in for an object living in another process or host; it marshals the call over the network.</li>
<li><b>Caching / smart-reference proxy</b> — memoizes results, counts references, or logs access.</li>
</ul>
<pre>// --- Virtual proxy: lazy-init expensive PaymentGateway connection ---
public final class LazyPaymentGatewayProxy implements PaymentGateway {
    private final Supplier&lt;PaymentGateway&gt; factory;
    private volatile PaymentGateway real;

    public LazyPaymentGatewayProxy(Supplier&lt;PaymentGateway&gt; factory) {
        this.factory = factory;
    }

    @Override
    public ChargeResult charge(ChargeRequest request) {
        if (real == null) {
            synchronized (this) {
                if (real == null) real = factory.get();  // first call only
            }
        }
        return real.charge(request);
    }
}</pre>` },
    { title: `Participants and flow`, figureAfter: "proxy-class", body: `<p>Three roles: the <b>Subject</b> interface, the <b>RealSubject</b> that does the work, and the <b>Proxy</b> that implements Subject and holds (or lazily creates) the RealSubject.</p>
<ol>
<li>Caller invokes <code>ledger.postEntry(txn)</code> against the Subject interface, holding a proxy.</li>
<li>The proxy runs its policy — check permissions, consult the cache, or establish the connection.</li>
<li>If the policy allows, it delegates to the real subject and returns the result; otherwise it rejects without ever touching it.</li>
</ol>
<pre>// --- Protection + caching proxy ---
public final class LedgerProxy implements Ledger {
    private final Ledger realLedger;
    private final AuthService auth;
    private final Cache&lt;String, List&lt;LedgerEntry&gt;&gt; readCache;

    public LedgerProxy(Ledger realLedger, AuthService auth,
            Cache&lt;String, List&lt;LedgerEntry&gt;&gt; readCache) {
        this.realLedger = realLedger;
        this.auth = auth;
        this.readCache = readCache;
    }

    @Override
    public void postEntry(LedgerEntry entry) {
        if (!auth.hasScope("ledger:write")) {
            throw new AccessDeniedException("ledger:write required");
        }
        realLedger.postEntry(entry);
        readCache.invalidate(entry.accountId());
    }

    @Override
    public List&lt;LedgerEntry&gt; entriesFor(String accountId) {
        if (!auth.hasScope("ledger:read")) {
            throw new AccessDeniedException("ledger:read required");
        }
        return readCache.get(accountId, realLedger::entriesFor);
    }
}</pre>` },
    { title: `Trade-offs and how it differs from Decorator`, body: `<p>Proxies keep access control transparent and centralized, but they add an indirection hop and can <em>hide</em> real costs: a virtual proxy masks a slow first call, and a remote proxy makes a network round trip look like a local method — a leaky abstraction if latency or partial failure is ignored.</p>
<p>On a class diagram Proxy and <b>Decorator</b> are twins — same interface, wraps a subject. The intent separates them: a Decorator <em>adds behaviour</em> and is meant to be stacked; a Proxy <em>controls access</em> to one specific subject, often owning its creation and lifecycle. Unlike <b>Adapter</b> it never changes the interface, and unlike <b>Facade</b> it stands in for a single object rather than simplifying many.</p>` },
  ],
  figures: [
    { id: "proxy-class", svg: CLASS_SVG, caption: "The proxy implements the same Ledger interface, applies its access policy, then delegates to the real subject." },
  ],
  related: ["decorator", "adapter", "facade", "api-idempotency", "circuit-breaker"],
});

export const meta = topic.meta;
export const content = topic.content;
