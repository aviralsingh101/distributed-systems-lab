// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const ITER_SVG = `<svg viewBox="0 0 560 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Iterator structure">
  <defs><marker id="fig-iterator-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="70" width="150" height="52" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.4"/>
  <text x="95" y="90" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">caller</text>
  <text x="95" y="106" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">for (e of ledger)</text>
  <rect x="210" y="66" width="160" height="60" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="290" y="86" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">LedgerIterator</text>
  <text x="290" y="102" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">cursor, next(), hasNext()</text>
  <text x="290" y="116" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">holds traversal position</text>
  <rect x="410" y="30" width="130" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.3"/>
  <text x="475" y="54" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">page 1</text>
  <rect x="410" y="80" width="130" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.3"/>
  <text x="475" y="104" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">page 2 (lazy)</text>
  <rect x="410" y="130" width="130" height="34" rx="6" fill="#141b2c" stroke="#26324a" stroke-width="1.1"/>
  <text x="475" y="151" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">page 3 …</text>
  <line x1="170" y1="96" x2="208" y2="96" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-iterator-arr)"/>
  <line x1="370" y1="90" x2="408" y2="60" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-iterator-arr)"/>
  <line x1="370" y1="100" x2="408" y2="100" stroke="#3ddc97" stroke-width="1.3" marker-end="url(#fig-iterator-arr)"/>
  <text x="300" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">iterator hides pagination; caller just loops</text>
</svg>`;

const topic = makeTopic({
  id: "iterator",
  title: "Iterator",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Expose sequential access to a collection's elements without revealing how the collection stores them.`,
  sections: [
    { title: `Intent`, body: `<p><b>Iterator</b> provides a way to access the elements of an aggregate object sequentially without exposing its underlying representation. The caller gets a uniform "give me the next element" contract; whether the data is an array, a tree, or paged rows from a database stays hidden.</p>
<p>This separation matters when traversal is non-trivial. Reading a merchant's ledger might mean fetching results from the database one page at a time. An iterator lets the caller write a plain loop while the cursor, page boundaries, and prefetching live inside the iterator.</p>
<pre>// --- Iterator interface ---
public interface LedgerIterator extends Iterator&lt;LedgerEntry&gt; {
    // inherits hasNext() and next() from java.util.Iterator
}

// --- Aggregate produces iterators ---
public interface LedgerRepository {
    LedgerIterator entriesFor(String merchantId);
}</pre>` },
    { title: `Participants and structure`, figureAfter: "iterator-struct", body: `<p>Four roles:</p>
<ul>
<li><b>Iterator</b> — the interface: <code>hasNext()</code> and <code>next()</code>.</li>
<li><b>Concrete Iterator</b> — <code>PagedLedgerIterator</code>, which holds the current position and knows how to advance it.</li>
<li><b>Aggregate</b> — the collection interface with <code>createIterator()</code>.</li>
<li><b>Concrete Aggregate</b> — the ledger repository that produces its iterator.</li>
</ul>
<pre>// --- Concrete iterator: hides pagination behind hasNext/next ---
public final class PagedLedgerIterator implements LedgerIterator {
    private final LedgerRepository repo;
    private final String merchantId;
    private int page = 0;
    private Iterator&lt;LedgerEntry&gt; currentPage = Collections.emptyIterator();

    public PagedLedgerIterator(LedgerRepository repo, String merchantId) {
        this.repo = repo;
        this.merchantId = merchantId;
        fetchNextPage();
    }

    @Override
    public boolean hasNext() {
        if (currentPage.hasNext()) return true;
        fetchNextPage();
        return currentPage.hasNext();
    }

    @Override
    public LedgerEntry next() {
        if (!hasNext()) throw new NoSuchElementException();
        return currentPage.next();
    }

    private void fetchNextPage() {
        currentPage = repo.fetchPage(merchantId, page++).iterator();
    }
}</pre>
<p>Because the position lives in the iterator, not the collection, several independent traversals of the same aggregate can run at once.</p>` },
    { title: `Implementation flow and language support`, body: `<p>The traversal is driven entirely through the iterator's methods:</p>
<ol>
<li>Caller obtains one: <code>LedgerIterator it = ledger.entriesFor(merchantId)</code>.</li>
<li>It loops: <code>while (it.hasNext()) process(it.next())</code>.</li>
<li>The concrete iterator advances its cursor and, when a page is exhausted, transparently fetches the next page — so the loop is oblivious to pagination.</li>
</ol>
<pre>// --- Caller: simple loop, no knowledge of storage ---
public Money totalVolume(String merchantId) {
    Money total = Money.ZERO;
    LedgerIterator it = ledger.entriesFor(merchantId);
    while (it.hasNext()) {
        LedgerEntry entry = it.next();
        total = total.add(entry.amount());
    }
    return total;
}</pre>
<p>Java's enhanced for-loop and <code>Iterable&lt;T&gt;</code> interface bake this in. Generators in other languages implement Iterator directly, and make <em>lazy</em> sequences trivial — you compute each element only when asked.</p>` },
    { title: `Trade-offs`, body: `<p>Iterator decouples traversal from storage, supports multiple simultaneous and lazy traversals, and lets you change a collection's internal structure without breaking callers. The classic hazard is <b>iterator invalidation</b>: if the underlying collection is modified mid-traversal, the iterator may skip, repeat, or throw — many implementations fail fast on concurrent modification. There is also a small per-element overhead versus a raw indexed loop. It pairs naturally with <b>Composite</b>, where an iterator flattens a tree into a linear walk.</p>` },
  ],
  figures: [
    { id: "iterator-struct", svg: ITER_SVG, caption: "The iterator owns the traversal position and hides paging; the caller writes a simple loop over the ledger." },
  ],
  related: ["composite", "visitor", "reactive-streams", "read-replica-routing"],
});

export const meta = topic.meta;
export const content = topic.content;
