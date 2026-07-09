// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const POLY_SVG = `<svg viewBox="0 0 500 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dynamic dispatch through a Notifier interface">
  <defs><marker id="fig-polymorphism-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="80" width="130" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="85" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">OrderService</text>
  <text x="85" y="117" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">n.send(msg)</text>
  <rect x="190" y="80" width="130" height="46" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="255" y="100" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">&lt;&lt;Notifier&gt;&gt;</text>
  <text x="255" y="117" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">send(msg)</text>
  <rect x="370" y="20" width="110" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="425" y="44" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">EmailNotifier</text>
  <rect x="370" y="85" width="110" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="425" y="109" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">SmsNotifier</text>
  <rect x="370" y="150" width="110" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="425" y="174" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">PushNotifier</text>
  <line x1="150" y1="103" x2="188" y2="103" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-polymorphism-arr)"/>
  <line x1="320" y1="98" x2="368" y2="44" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3"/>
  <line x1="320" y1="103" x2="368" y2="105" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3"/>
  <line x1="320" y1="108" x2="368" y2="168" stroke="#93a1bd" stroke-width="1.2" stroke-dasharray="4 3"/>
</svg>`;

const topic = makeTopic({
  id: "polymorphism",
  title: "Polymorphism",
  category: "lld-oop",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Let one call site invoke behavior that varies by the runtime type of the object, so callers stay ignorant of the concrete implementation.`,
  sections: [
    { title: `What polymorphism is`, body: `<p><b>Polymorphism</b> ("many forms") lets a single interface stand for several underlying types. The most important kind in OOP is <b>subtype polymorphism</b>: a variable typed as <code>PaymentNotifier</code> may hold an <code>EmailNotifier</code> or an <code>SmsNotifier</code>, and calling <code>notify()</code> runs the method belonging to the actual object at runtime.</p>
<p>Abstraction defines the contract; polymorphism is the mechanism that picks the correct implementation of that contract without the caller branching on type. Together they let you add a new notification channel by writing one new class, not by editing every call site.</p>` },
    { title: `How it works — dynamic dispatch`, figureAfter: "notifier-dispatch", body: `<p>Subtype polymorphism works by <b>dynamic dispatch</b> (virtual method invocation in the JVM). Each object carries a reference to its class's method table. A call such as <code>notifier.notify(event)</code> is resolved at runtime by looking up <code>notify</code> in the object's actual class — not the declared type of the variable. The same bytecode call site therefore executes different code depending on which object was injected.</p>
<pre>// The abstraction — one method, many forms
public interface PaymentNotifier {
    void notify(PaymentCapturedEvent event);
}

public record PaymentCapturedEvent(String paymentId, String walletId, Money amount) {}

// Concrete forms — each implements notify differently
public final class EmailNotifier implements PaymentNotifier {
    private final JavaMailSender mailSender;

    @Override
    public void notify(PaymentCapturedEvent event) {
        mailSender.send(buildReceiptEmail(event.walletId(), event.amount()));
    }
}

public final class SmsNotifier implements PaymentNotifier {
    private final TwilioClient twilio;

    @Override
    public void notify(PaymentCapturedEvent event) {
        twilio.messages().create("Payment of " + event.amount() + " captured.");
    }
}

public final class PushNotifier implements PaymentNotifier {
    private final FcmClient fcm;

    @Override
    public void notify(PaymentCapturedEvent event) {
        fcm.send(event.walletId(), "Payment confirmed", event.paymentId());
    }
}</pre>
<p>All three classes share the same method signature but different bodies. The JVM picks the right <code>notify</code> implementation when the call executes — no <code>if (type == EMAIL)</code> chain in the caller.</p>` },
    { title: `The caller — one loop, no type checks`, body: `<p><code>OrderService</code> holds a <code>List&lt;PaymentNotifier&gt;</code> injected at startup. After a successful charge it broadcasts to every channel without knowing which implementations are wired:</p>
<pre>public class OrderService {
    private final List&lt;PaymentNotifier&gt; notifiers;  // polymorphic list
    private final PaymentGateway gateway;
    private final LedgerRepository ledger;

    public OrderService(List&lt;PaymentNotifier&gt; notifiers,
                        PaymentGateway gateway,
                        LedgerRepository ledger) {
        this.notifiers = notifiers;
        this.gateway = gateway;
        this.ledger = ledger;
    }

    @Transactional
    public void capturePayment(String paymentId, String walletId, Money amount) {
        ChargeResult result = gateway.charge(new ChargeRequest(paymentId, walletId, amount, ...));
        if (result.status() != ChargeStatus.CAPTURED) return;

        ledger.recordDebit(walletId, amount, result.processorRef());

        PaymentCapturedEvent event = new PaymentCapturedEvent(paymentId, walletId, amount);
        for (PaymentNotifier notifier : notifiers) {
            notifier.notify(event);   // dynamic dispatch — Email, Sms, or Push at runtime
        }
    }
}

// Spring wires all PaymentNotifier beans into the list automatically
@Configuration
public class NotifierConfig {
    @Bean List&lt;PaymentNotifier&gt; notifiers(EmailNotifier email, SmsNotifier sms, PushNotifier push) {
        return List.of(email, sms, push);
    }
}</pre>
<p>Adding a Slack notifier means writing <code>SlackNotifier implements PaymentNotifier</code> and registering it as a Spring bean — <code>OrderService</code> never changes. That is the Open/Closed Principle in action, enabled by polymorphism.</p>` },
    { title: `Parametric polymorphism — generics`, body: `<p>Java's second major form is <b>parametric polymorphism</b> via generics. You write code once over a type parameter; the compiler enforces type safety at compile time (no casts, no <code>ClassCastException</code> at runtime for well-typed code).</p>
<pre>// One repository interface works for any aggregate type
public interface Repository&lt;T, ID&gt; {
    Optional&lt;T&gt; findById(ID id);
    T save(T entity);
    void delete(T entity);
}

public class JpaWalletRepository implements Repository&lt;Wallet, String&gt; {
    @PersistenceContext private EntityManager em;

    @Override public Optional&lt;Wallet&gt; findById(String id) {
        return Optional.ofNullable(em.find(Wallet.class, id));
    }
    @Override public Wallet save(Wallet wallet) { return em.merge(wallet); }
    @Override public void delete(Wallet wallet) { em.remove(wallet); }
}

public class JpaPaymentRepository implements Repository&lt;Payment, String&gt; {
    // same interface, different T — compile-time type safety
}</pre>
<p>Generics give polymorphism over <em>structure</em> (the same algorithm for any type) while interfaces give polymorphism over <em>behavior</em> (different algorithms behind the same method name). Production code uses both constantly.</p>` },
    { title: `Pitfalls`, body: `<p>Polymorphism only pays off when subtypes are truly substitutable — that is the Liskov Substitution Principle. A subtype that throws <code>UnsupportedOperationException</code> for a contract method, or narrows accepted inputs, breaks callers that trusted the interface.</p>
<pre>// LSP VIOLATION — callers expect notify() to always work
public class DisabledSmsNotifier implements PaymentNotifier {
    @Override
    public void notify(PaymentCapturedEvent event) {
        throw new UnsupportedOperationException("SMS disabled in this region");
    }
}

// BETTER — no-op or filter at wiring time, not at runtime surprise
public final class NoOpSmsNotifier implements PaymentNotifier {
    @Override public void notify(PaymentCapturedEvent event) { /* intentionally empty */ }
}</pre>
<p>Also beware calling overridable methods from a constructor (subclass override may run before subclass fields initialize), and replacing every <code>switch</code> with a class hierarchy when the case set is small and closed — a well-written <code>switch</code> on an enum is often clearer than seven strategy classes for seven payment statuses.</p>` },
  ],
  figures: [
    { id: "notifier-dispatch", svg: POLY_SVG, caption: `OrderService calls notify() on the PaymentNotifier interface; dynamic dispatch routes to Email, Sms, or Push at runtime.` },
  ],
  related: ["abstraction", "liskov-substitution-principle", "open-closed-principle", "strategy"],
});

export const meta = topic.meta;
export const content = topic.content;
