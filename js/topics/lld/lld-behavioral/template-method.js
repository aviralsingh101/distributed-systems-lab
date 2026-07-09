// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const SKEL_SVG = `<svg viewBox="0 0 560 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Template method skeleton">
  <defs><marker id="fig-template-method-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="20" width="230" height="170" rx="8" fill="#141b2c" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="145" y="40" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">PaymentProcessor.process()</text>
  <rect x="55" y="52" width="180" height="24" rx="4" fill="#1a2236" stroke="#9aa7c7" stroke-width="1"/>
  <text x="145" y="68" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">validate()  [fixed]</text>
  <rect x="55" y="82" width="180" height="24" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="145" y="98" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">authorize()  [abstract]</text>
  <rect x="55" y="112" width="180" height="24" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="145" y="128" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">capture()  [abstract]</text>
  <rect x="55" y="142" width="180" height="24" rx="4" fill="#1a2236" stroke="#9aa7c7" stroke-width="1"/>
  <text x="145" y="158" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="ui-monospace,monospace">record() + notify()  [fixed]</text>
  <rect x="340" y="40" width="190" height="52" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/>
  <text x="435" y="62" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">CardProcessor</text>
  <text x="435" y="78" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">overrides authorize/capture</text>
  <rect x="340" y="120" width="190" height="52" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.4"/>
  <text x="435" y="142" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">WalletProcessor</text>
  <text x="435" y="158" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">overrides authorize/capture</text>
  <line x1="340" y1="66" x2="262" y2="94" stroke="#7c5cff" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-template-method-arr)"/>
  <line x1="340" y1="146" x2="262" y2="124" stroke="#7c5cff" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-template-method-arr)"/>
</svg>`;

const topic = makeTopic({
  id: "template-method",
  title: "Template Method",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Fix the skeleton of an algorithm in a base method and let subclasses fill in the steps that vary — without changing the overall sequence.`,
  sections: [
    { title: `Intent`, body: `<p><b>Template Method</b> defines the skeleton of an algorithm in one method, deferring some steps to subclasses. Subclasses redefine those steps without changing the algorithm's structure or order.</p>
<p>The invariant here is the <em>sequence</em>. Every payment must be validated, then authorized, then captured, then recorded and notified — in that order. What differs between a card, a wallet, and a bank transfer is only <em>how</em> authorize and capture work, not the overall flow. Template Method locks the flow in the base class and opens just the steps that vary.</p>
<pre>// --- Abstract class: fixes the algorithm skeleton ---
public abstract class PaymentProcessor {
    // Template method — final so subclasses cannot reorder steps
    public final ChargeResult process(Payment payment) {
        validate(payment);
        Authorization auth = authorize(payment);
        CaptureResult capture = capture(payment, auth);
        record(payment, capture);
        notify(payment, capture);
        return capture.toChargeResult();
    }

    private void validate(Payment payment) { /* fixed */ }
    protected abstract Authorization authorize(Payment payment);
    protected abstract CaptureResult capture(Payment payment, Authorization auth);
    private void record(Payment payment, CaptureResult result) { /* fixed */ }
    private void notify(Payment payment, CaptureResult result) { /* fixed */ }
}</pre>` },
    { title: `Participants and structure`, figureAfter: "template-skeleton", body: `<p>Two roles, connected by inheritance:</p>
<ul>
<li><b>Abstract Class</b> — <code>PaymentProcessor</code>. Its <b>template method</b> <code>process()</code> is <code>final</code>-ish: it calls the steps in order. Some steps are concrete (<code>validate</code>, <code>record</code>), some are abstract <b>primitive operations</b> (<code>authorize</code>, <code>capture</code>), and some are optional <b>hooks</b> with default no-op behaviour.</li>
<li><b>Concrete Classes</b> — <code>CardProcessor</code>, <code>WalletProcessor</code>, override only the primitive operations.</li>
</ul>
<p>This is the <b>Hollywood Principle</b>: "don't call us, we'll call you." The base class calls down into the subclass's steps, not the other way around — control is inverted.</p>
<pre>public final class CardProcessor extends PaymentProcessor {
    private final PaymentGateway gateway;

    public CardProcessor(PaymentGateway gateway) { this.gateway = gateway; }

    @Override
    protected Authorization authorize(Payment payment) {
        return gateway.authorize(payment.toAuthRequest());
    }

    @Override
    protected CaptureResult capture(Payment payment, Authorization auth) {
        return gateway.capture(auth.id(), payment.amount());
    }
}</pre>` },
    { title: `Implementation flow`, body: `<p>The subclass never runs the sequence itself:</p>
<ol>
<li>Client calls <code>cardProcessor.process(payment)</code> — defined only in the base class.</li>
<li><code>process()</code> runs <code>validate()</code>, then calls the abstract <code>authorize()</code>, which dispatches to <code>CardProcessor.authorize()</code>.</li>
<li>It continues through <code>capture()</code>, then the fixed <code>record()</code> and <code>notify()</code> steps.</li>
</ol>
<pre>public final class WalletProcessor extends PaymentProcessor {
    private final WalletService wallet;

    public WalletProcessor(WalletService wallet) { this.wallet = wallet; }

    @Override
    protected Authorization authorize(Payment payment) {
        wallet.reserve(payment.walletId(), payment.amount());
        return Authorization.reserved(payment.id());
    }

    @Override
    protected CaptureResult capture(Payment payment, Authorization auth) {
        wallet.debit(payment.walletId(), payment.amount());
        return CaptureResult.captured(payment.id());
    }
}

// Client — never calls authorize/capture directly
ChargeResult result = cardProcessor.process(payment);</pre>
<p>A subclass cannot reorder or skip steps; it can only fill in the designated holes, which is exactly the guarantee you want for a regulated flow.</p>` },
    { title: `Template Method vs Strategy`, body: `<p>Both let an algorithm vary, but through opposite mechanisms. <b>Template Method</b> uses <em>inheritance</em>: variation is chosen at compile time by subclassing, and the whole algorithm shares one base skeleton. <b>Strategy</b> uses <em>composition</em>: variation is a pluggable object swapped at <em>runtime</em>, and each strategy is a complete standalone algorithm.</p>
<pre>// Template Method: subclass overrides steps (compile-time, inheritance)
CardProcessor processor = new CardProcessor(gateway);
processor.process(payment);

// Strategy: inject algorithm object (runtime, composition)
router.setStrategy(new CheapestRouting());
router.route(payment, gateways);</pre>
<p>Template Method's reuse of the invariant skeleton is its strength, but it inherits inheritance's problems: rigid class hierarchies, the fragile base class, and no runtime reconfiguration. When the varying steps are truly independent or need to change at runtime, prefer Strategy (composition over inheritance).</p>` },
  ],
  figures: [
    { id: "template-skeleton", svg: SKEL_SVG, caption: "The base class fixes the order and the surrounding steps; subclasses override only authorize() and capture()." },
  ],
  related: ["strategy", "factory-method", "state", "command"],
});

export const meta = topic.meta;
export const content = topic.content;
