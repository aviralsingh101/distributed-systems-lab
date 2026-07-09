// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const SCOPE_SVG = `<svg viewBox="0 0 540 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Module pattern closure scope">
  <defs><marker id="fig-module-pattern-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="20" width="250" height="160" rx="8" fill="#141b2c" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="145" y="40" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">closure scope (IIFE)</text>
  <rect x="40" y="54" width="210" height="34" rx="5" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.2"/>
  <text x="52" y="75" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">const balances = new Map()</text>
  <text x="145" y="104" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">private — unreachable from outside</text>
  <rect x="40" y="118" width="210" height="46" rx="5" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="52" y="136" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">return { debit, credit,</text>
  <text x="52" y="151" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">         balanceOf }</text>
  <rect x="360" y="86" width="160" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="440" y="108" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">caller</text>
  <text x="440" y="124" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">wallet.debit(id, 100)</text>
  <line x1="250" y1="140" x2="358" y2="112" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-module-pattern-arr)"/>
  <text x="300" y="160" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">only the returned API escapes</text>
</svg>`;

const topic = makeTopic({
  id: "module-pattern",
  title: "Module Pattern",
  category: "lld-structural",
  track: "lld",
  tier: "hidden-gem",
  archetype: "pattern",
  oneliner: `Use a function's closure to hide private state and expose only a curated public API — JavaScript's original way to get encapsulation.`,
  sections: [
    { title: `Intent and origin`, body: `<p>The <b>Module Pattern</b> uses a function scope to encapsulate private state and expose a deliberately small public interface. Variables declared inside the function are captured by <b>closure</b> and are unreachable from outside; only the object the function returns can be touched by callers.</p>
<p>It predates ES modules and class private fields. Before JavaScript had any real access modifiers, this was <em>the</em> idiom for information hiding — everything on an object was public, so developers used closures to make "private" mean "not in the returned object".</p>
<p>In Java, the equivalent is a <b>package-private class</b> with a <b>static factory</b> that returns a narrow public interface — private state stays inside the module, only the curated API escapes.</p>
<pre>// --- Public API: what callers see ---
public interface WalletStore {
    void debit(String walletId, long amountMinor);
    void credit(String walletId, long amountMinor);
    long balanceOf(String walletId);
}</pre>` },
    { title: `Structure`, figureAfter: "module-pattern-scope", body: `<p>The classic JavaScript form is an immediately-invoked function expression (IIFE) that returns an object of public methods. In Java, the same structure maps to a factory method on a holder class:</p>
<ul>
<li>Private bindings — the balance map, invisible outside the module.</li>
<li>Inner functions — close over private state and enforce invariants.</li>
<li>Returned public API — only <code>debit</code>, <code>credit</code>, <code>balanceOf</code> escape.</li>
</ul>
<pre>// --- Module implementation: private state + public factory ---
public final class WalletStoreModule {
    // Private — like the IIFE's closure scope
    private final Map&lt;String, Long&gt; balances = new HashMap&lt;&gt;();

    private WalletStoreModule() {}  // no direct construction

    public static WalletStore create() {
        WalletStoreModule module = new WalletStoreModule();
        return new WalletStore() {
            @Override
            public void debit(String walletId, long amountMinor) {
                long current = module.balances.getOrDefault(walletId, 0L);
                if (current &lt; amountMinor) {
                    throw new InsufficientFundsException(walletId);
                }
                module.balances.put(walletId, current - amountMinor);
            }

            @Override
            public void credit(String walletId, long amountMinor) {
                module.balances.merge(walletId, amountMinor, Long::sum);
            }

            @Override
            public long balanceOf(String walletId) {
                return module.balances.getOrDefault(walletId, 0L);
            }
        };
    }
}</pre>
<p>A common variant, the <b>revealing module pattern</b>, defines every function as a local and returns an object that simply maps public names to them, keeping the public/private split in one readable place.</p>` },
    { title: `Implementation flow`, body: `<p>A wallet store keeps its balance map private so no caller can corrupt it:</p>
<ol>
<li>The factory runs once: <code>WalletStore wallet = WalletStoreModule.create()</code>.</li>
<li>It defines <code>debit</code>, <code>credit</code>, and <code>balanceOf</code>, each of which validates the invariant (never let a balance go negative) before mutating the map.</li>
<li>Only the returned <code>WalletStore</code> interface escapes; the <code>balances</code> map itself is unreachable.</li>
</ol>
<pre>// --- Caller: uses only the public API ---
public class PaymentService {
    private final WalletStore wallet = WalletStoreModule.create();

    public void chargeWallet(String walletId, long amountMinor) {
        wallet.debit(walletId, amountMinor);
        // wallet.balances — compile error; map is private to the module
    }
}</pre>
<p>Callers can move money only through the vetted methods — there is no handle to reach in and set a balance directly, so the invariant holds by construction.</p>` },
    { title: `Trade-offs and the modern replacement`, body: `<p>The pattern gives genuinely private state and a clean public surface, and the returned object behaves like a singleton for that module. The costs: private internals are hard to unit-test in isolation, closures retain memory for the module's lifetime, and you get a single instance unless you wrap it in a factory that returns a fresh object per call.</p>
<p>Today, <b>ES modules</b> provide file-level encapsulation (only <code>export</code>ed names escape) and <b>class <code>#private</code> fields</b> give per-instance privacy with normal testing ergonomics. In Java, <code>private</code> fields on a class plus a public interface achieve the same goal with better tooling support.</p>` },
  ],
  figures: [
    { id: "module-pattern-scope", svg: SCOPE_SVG, caption: "Private state lives in the closure; only the returned methods are reachable, so callers must go through the vetted API." },
  ],
  related: ["singleton", "encapsulation", "facade", "value-objects"],
});

export const meta = topic.meta;
export const content = topic.content;
