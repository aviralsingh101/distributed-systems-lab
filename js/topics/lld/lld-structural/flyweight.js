// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const FLY_SVG = `<svg viewBox="0 0 580 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flyweight sharing">
  <defs><marker id="fig-flyweight-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="120" y="20" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">millions of LedgerEntry (extrinsic)</text>
  <rect x="20" y="34" width="200" height="26" rx="4" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.1"/>
  <text x="30" y="51" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">amount=1200  currency→USD</text>
  <rect x="20" y="66" width="200" height="26" rx="4" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.1"/>
  <text x="30" y="83" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">amount=550   currency→USD</text>
  <rect x="20" y="98" width="200" height="26" rx="4" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.1"/>
  <text x="30" y="115" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">amount=9900  currency→EUR</text>
  <rect x="20" y="130" width="200" height="26" rx="4" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.1"/>
  <text x="30" y="147" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">amount=75    currency→USD</text>
  <rect x="360" y="40" width="200" height="44" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="460" y="60" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Currency("USD") shared</text>
  <text x="460" y="75" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">symbol="$" exponent=2</text>
  <rect x="360" y="120" width="200" height="44" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="460" y="140" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Currency("EUR") shared</text>
  <text x="460" y="155" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">symbol="€" exponent=2</text>
  <line x1="220" y1="47" x2="358" y2="60" stroke="#3ddc97" stroke-width="1.1" marker-end="url(#fig-flyweight-arr)"/>
  <line x1="220" y1="79" x2="358" y2="64" stroke="#3ddc97" stroke-width="1.1" marker-end="url(#fig-flyweight-arr)"/>
  <line x1="220" y1="143" x2="358" y2="68" stroke="#3ddc97" stroke-width="1.1" marker-end="url(#fig-flyweight-arr)"/>
  <line x1="220" y1="111" x2="358" y2="140" stroke="#7c5cff" stroke-width="1.1" marker-end="url(#fig-flyweight-arr)"/>
  <text x="290" y="196" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">CurrencyFactory returns one instance per code (intrinsic, immutable)</text>
</svg>`;

const topic = makeTopic({
  id: "flyweight",
  title: "Flyweight",
  category: "lld-structural",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Share one immutable instance for state that repeats across huge numbers of objects, and pass the per-object state in from outside.`,
  sections: [
    { title: `Intent`, body: `<p><b>Flyweight</b> uses sharing to support very large numbers of fine-grained objects efficiently. Its central move is to split an object's data into two parts: <b>intrinsic</b> state, which is shared and immutable, and <b>extrinsic</b> state, which varies per use and is passed in by the client.</p>
<p>Consider a ledger holding tens of millions of entries, each carrying a currency. Storing the ISO code, symbol, and minor-unit exponent on every entry duplicates the same handful of values millions of times. There are only ~180 currencies; the amount and account differ per row, but the currency metadata does not.</p>
<pre>// --- Flyweight: intrinsic state — shared, immutable ---
public final class Currency {
    private final String code;      // "USD"
    private final String symbol;    // "$"
    private final int exponent;     // 2 (cents)

    Currency(String code, String symbol, int exponent) {
        this.code = code;
        this.symbol = symbol;
        this.exponent = exponent;
    }

    public String format(long minorUnits) {
        long whole = minorUnits / (long) Math.pow(10, exponent);
        return symbol + whole;
    }
}</pre>` },
    { title: `Intrinsic vs extrinsic state`, figureAfter: "flyweight-share", body: `<p>The design pivots on which state is which:</p>
<ul>
<li><b>Intrinsic (shared)</b> — currency code, symbol, decimal exponent. Identical for every USD entry, so one <code>Currency("USD")</code> object can serve them all. It must be immutable.</li>
<li><b>Extrinsic (per object)</b> — the amount and the owning account. These live on the <code>LedgerEntry</code> and are supplied when an operation runs, e.g. <code>currency.format(amountMinor)</code>.</li>
</ul>
<pre>// --- Client: extrinsic state lives on each entry ---
public final class LedgerEntry {
    private final String accountId;   // extrinsic
    private final long amountMinor;   // extrinsic
    private final Currency currency;  // reference to shared flyweight

    public LedgerEntry(String accountId, long amountMinor, Currency currency) {
        this.accountId = accountId;
        this.amountMinor = amountMinor;
        this.currency = currency;
    }

    public String formattedAmount() {
        return currency.format(amountMinor);  // pass extrinsic to flyweight
    }
}</pre>
<p>Each ledger entry now holds a <em>reference</em> to a shared flyweight rather than its own copy of the metadata.</p>` },
    { title: `Participants and implementation flow`, body: `<p>The roles are Flyweight (the shared object), Flyweight Factory (owns the pool), and Client (keeps extrinsic state):</p>
<ol>
<li>Client asks the factory: <code>CurrencyFactory.of("USD")</code>.</li>
<li>The factory returns the cached instance if it exists, otherwise creates, stores, and returns it — so every "USD" reference points to the <em>same</em> object.</li>
<li>The client stores that reference plus its own extrinsic amount, and invokes operations passing extrinsic state as arguments.</li>
</ol>
<pre>// --- Flyweight factory: one instance per distinct intrinsic value ---
public final class CurrencyFactory {
    private static final Map&lt;String, Currency&gt; pool = new ConcurrentHashMap&lt;&gt;();

    private CurrencyFactory() {}

    public static Currency of(String code) {
        return pool.computeIfAbsent(code, c -&gt; loadCurrencyMetadata(c));
    }

    private static Currency loadCurrencyMetadata(String code) {
        return switch (code) {
            case "USD" -> new Currency("USD", "$", 2);
            case "EUR" -> new Currency("EUR", "€", 2);
            case "JPY" -> new Currency("JPY", "¥", 0);
            default -> throw new IllegalArgumentException("Unknown currency: " + code);
        };
    }
}

// Millions of entries, ~180 Currency instances
LedgerEntry entry = new LedgerEntry(
    "acct-42", 12_00, CurrencyFactory.of("USD"));</pre>
<p>This is exactly the "interning" you already know from Java's <code>String.intern()</code> and boxed <code>Integer</code> cache.</p>` },
    { title: `Trade-offs and when it applies`, body: `<p>Flyweight only pays off when three things hold: you have a huge object count, the intrinsic state is heavily duplicated, and the set of distinct intrinsic values is small. Then memory drops dramatically. The costs are a factory to manage, extra plumbing to pass extrinsic state, and a hard requirement that flyweights be immutable and therefore safe to share across threads.</p>
<p>It differs from <b>Singleton</b>: a singleton is one global instance of a type, while a flyweight is one instance <em>per distinct intrinsic value</em>. Do not reach for it before profiling — for small collections it is pure overhead.</p>` },
  ],
  figures: [
    { id: "flyweight-share", svg: FLY_SVG, caption: "Millions of ledger entries reference a few shared, immutable Currency flyweights instead of duplicating currency metadata." },
  ],
  related: ["singleton", "value-objects", "prototype", "lru-cache"],
});

export const meta = topic.meta;
export const content = topic.content;
