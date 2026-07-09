// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const DS_SVG = `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="LRU cache hashmap and doubly linked list">
  <defs><marker id="fig-lru-cache-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <text x="70" y="30" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">HashMap</text>
  <rect x="20" y="40" width="100" height="120" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="70" y="70" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">"a" ─▶</text>
  <text x="70" y="100" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">"b" ─▶</text>
  <text x="70" y="130" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">"c" ─▶</text>
  <text x="400" y="30" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Doubly linked list (MRU ⟷ LRU)</text>
  <rect x="180" y="80" width="90" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="225" y="100" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">HEAD</text>
  <text x="225" y="115" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">most recent</text>
  <rect x="300" y="80" width="90" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="345" y="105" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">node b</text>
  <rect x="420" y="80" width="90" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="465" y="105" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">node c</text>
  <rect x="540" y="80" width="90" height="44" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="585" y="100" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">TAIL</text>
  <text x="585" y="115" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">evict here</text>
  <line x1="270" y1="102" x2="298" y2="102" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-lru-cache-arr)"/>
  <line x1="390" y1="102" x2="418" y2="102" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-lru-cache-arr)"/>
  <line x1="510" y1="102" x2="538" y2="102" stroke="#93a1bd" stroke-width="1.4" marker-end="url(#fig-lru-cache-arr)"/>
  <line x1="120" y1="95" x2="298" y2="95" stroke="#5b9dff" stroke-width="1" stroke-dasharray="3 3"/>
</svg>`;

const topic = makeTopic({
  id: "lru-cache",
  title: "LRU Cache",
  category: "lld-classics",
  track: "lld",
  tier: "essential",
  archetype: "classic",
  oneliner: `Bound a cache to K entries and evict the least-recently-used one — with O(1) get and put by pairing a hash map with a doubly linked list.`,
  figures: [
    { id: "lru-structure", svg: DS_SVG, caption: "Hash map gives O(1) lookup to a node; the doubly linked list orders nodes by recency so the tail is always the eviction victim." },
  ],
  sections: [
    { title: `The requirement and why the obvious approaches fail`, body: `<p>Build a fixed-capacity key→value cache with two operations, both <b>O(1)</b>: <code>get(key)</code> returns the value and marks it most-recently-used; <code>put(key, value)</code> inserts/updates and, if over capacity, evicts the <b>least-recently-used</b> entry. The naïve implementations each break one requirement: a plain hash map gives O(1) access but no recency order, so eviction is O(n) to find the oldest; a queue orders by recency but makes "move this existing key to the front on access" an O(n) search-and-remove.</p>` },
    { title: `The winning combination`, figureAfter: "lru-structure", body: `<p>The classic answer combines both: a <b>hash map</b> from key to a <b>node</b>, and a <b>doubly linked list</b> of those nodes ordered by recency. The head is the most-recently-used end; the tail is the least. The map buys O(1) lookup <em>to the node</em>; the doubly linked list buys O(1) removal and re-insertion because a node carries pointers to both neighbours — you never have to scan to find or unlink it.</p>
<p>The doubly-ness is essential: to move a node to the head you must splice it out of the middle, which needs its <code>prev</code> pointer. A singly linked list would force an O(n) walk to find the predecessor.</p>
<pre>// Node in the doubly linked list
static final class Node&lt;K, V&gt; {
    K key;
    V value;
    Node&lt;K, V&gt; prev;
    Node&lt;K, V&gt; next;

    Node(K key, V value) {
        this.key = key;
        this.value = value;
    }
}</pre>` },
    { title: `Full LRUCache implementation`, body: `<p>Sentinel head/tail nodes eliminate null-checks for empty or single-element lists:</p>
<pre>public final class LRUCache&lt;K, V&gt; {
    private final int capacity;
    private final Map&lt;K, Node&lt;K, V&gt;&gt; map = new HashMap&lt;&gt;();
    private final Node&lt;K, V&gt; head = new Node&lt;&gt;(null, null);  // sentinel MRU
    private final Node&lt;K, V&gt; tail = new Node&lt;&gt;(null, null);  // sentinel LRU

    public LRUCache(int capacity) {
        if (capacity &lt;= 0) throw new IllegalArgumentException("capacity must be positive");
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public synchronized V get(K key) {
        Node&lt;K, V&gt; node = map.get(key);
        if (node == null) return null;
        moveToFront(node);
        return node.value;
    }

    public synchronized void put(K key, V value) {
        Node&lt;K, V&gt; existing = map.get(key);
        if (existing != null) {
            existing.value = value;
            moveToFront(existing);
            return;
        }
        if (map.size() == capacity) {
            Node&lt;K, V&gt; lru = tail.prev;
            remove(lru);
            map.remove(lru.key);
        }
        Node&lt;K, V&gt; node = new Node&lt;&gt;(key, value);
        addToFront(node);
        map.put(key, node);
    }

    private void moveToFront(Node&lt;K, V&gt; node) {
        remove(node);
        addToFront(node);
    }

    private void addToFront(Node&lt;K, V&gt; node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void remove(Node&lt;K, V&gt; node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
}</pre>
<p><b>get</b>: hash-lookup the node, unlink it, and re-insert at head — O(1). <b>put</b> (existing key): update value, move to head. <b>put</b> (new key at capacity): remove <code>tail.prev</code>, delete its key from the map, then add the new node at head.</p>` },
    { title: `Real-world variants`, body: `<p>A payment platform might cache wallet balances with a short TTL on top of LRU eviction:</p>
<pre>public final class WalletBalanceCache {
    private final LRUCache&lt;String, CachedBalance&gt; cache;
    private final Duration ttl;

    public WalletBalanceCache(int maxWallets, Duration ttl) {
        this.cache = new LRUCache&lt;&gt;(maxWallets);
        this.ttl = ttl;
    }

    public Optional&lt;Long&gt; getBalanceCents(String walletId) {
        CachedBalance cached = cache.get(walletId);
        if (cached == null || cached.isExpired(ttl)) return Optional.empty();
        return Optional.of(cached.balanceCents());
    }

    public void put(String walletId, long balanceCents) {
        cache.put(walletId, new CachedBalance(balanceCents, Instant.now()));
    }

    record CachedBalance(long balanceCents, Instant fetchedAt) {
        boolean isExpired(Duration ttl) {
            return fetchedAt.plus(ttl).isBefore(Instant.now());
        }
    }
}</pre>
<p>Production caches refine the base design: <b>LRU-K</b> and <b>segmented LRU</b> track the last K accesses to resist a large scan flushing the whole cache; <b>LFU</b> evicts by frequency; and libraries like Caffeine use <b>TinyLFU</b> admission plus <b>W-TinyLFU</b> to beat plain LRU on real hit rates. For a shared cache you also need <b>thread safety</b> — the map-plus-list mutation must be atomic, via a lock or striped locks, since two threads reordering the list can corrupt the pointers.</p>` },
  ],
  related: ["rate-limiter-in-process", "in-memory-pub-sub", "indexing-strategies"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("lru-cache", stage, panel, stageEl);
}
