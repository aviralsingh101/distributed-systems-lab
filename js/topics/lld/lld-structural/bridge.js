// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const CLASS_SVG = `<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bridge class structure">
  <defs><marker id="fig-bridge-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="20" width="180" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="110" y="40" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Notification (abstraction)</text>
  <text x="110" y="58" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">- channel: Channel</text>
  <rect x="12" y="130" width="90" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.2"/>
  <text x="57" y="157" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Receipt</text>
  <rect x="118" y="130" width="98" height="46" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.2"/>
  <text x="167" y="157" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">RefundNotice</text>
  <line x1="57" y1="130" x2="100" y2="74" stroke="#5b9dff" stroke-width="1.2"/>
  <line x1="167" y1="130" x2="120" y2="74" stroke="#5b9dff" stroke-width="1.2"/>
  <rect x="400" y="20" width="180" height="52" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="490" y="40" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">«interface» Channel</text>
  <text x="490" y="58" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">+ send(to, body)</text>
  <rect x="388" y="130" width="60" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="418" y="157" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Email</text>
  <rect x="462" y="130" width="56" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="490" y="157" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">SMS</text>
  <rect x="532" y="130" width="56" height="46" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.2"/>
  <text x="560" y="157" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Push</text>
  <line x1="418" y1="130" x2="470" y2="74" stroke="#3ddc97" stroke-width="1.2"/>
  <line x1="490" y1="130" x2="490" y2="74" stroke="#3ddc97" stroke-width="1.2"/>
  <line x1="560" y1="130" x2="510" y2="74" stroke="#3ddc97" stroke-width="1.2"/>
  <line x1="200" y1="46" x2="398" y2="46" stroke="#7c5cff" stroke-width="1.8" marker-end="url(#fig-bridge-arr)"/>
  <text x="300" y="38" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">the bridge (has-a)</text>
</svg>`;

const topic = makeTopic({
  id: "bridge",
  title: "Bridge",
  category: "lld-structural",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Split one thing into two independent hierarchies — abstraction and implementation — so each can vary without multiplying subclasses.`,
  sections: [
    { title: `Intent and the combinatorial problem`, body: `<p><b>Bridge</b> decouples an abstraction from its implementation so that the two can vary independently. It is the answer to a subclass explosion: when a type varies along two orthogonal dimensions, single inheritance forces you to create a class for every combination.</p>
<p>Say a payment platform sends <em>notifications</em> — a receipt, a refund notice, a chargeback alert — over several <em>channels</em> — email, SMS, push. Model it with inheritance and you get <code>ReceiptEmail</code>, <code>ReceiptSMS</code>, <code>RefundNoticeEmail</code>, and so on: <em>m × n</em> classes, and a new channel forces you to add one subclass per notification type.</p>
<pre>// --- Implementor: the "how to deliver" dimension ---
public interface Channel {
    void send(String recipient, String body);
}</pre>` },
    { title: `Participants and structure`, figureAfter: "bridge-class", body: `<p>Bridge separates the two dimensions into two hierarchies linked by composition:</p>
<ul>
<li><b>Abstraction</b> — <code>Notification</code>, holds a reference to an Implementor and defines high-level operations.</li>
<li><b>Refined Abstraction</b> — <code>Receipt</code>, <code>RefundNotice</code>: what to say.</li>
<li><b>Implementor</b> — the <code>Channel</code> interface: how to deliver.</li>
<li><b>Concrete Implementor</b> — <code>EmailChannel</code>, <code>SmsChannel</code>, <code>PushChannel</code>.</li>
</ul>
<p>The "bridge" is the has-a reference from Abstraction to Implementor. Now the two hierarchies grow independently: <em>m + n</em> classes instead of <em>m × n</em>.</p>
<pre>// --- Abstraction: the "what to notify" dimension ---
public abstract class Notification {
    protected final Channel channel;  // the bridge

    protected Notification(Channel channel) {
        this.channel = channel;
    }

    public abstract void notify(Payment payment);
}

public final class Receipt extends Notification {
    public Receipt(Channel channel) { super(channel); }

    @Override
    public void notify(Payment payment) {
        String body = "Receipt for " + payment.id()
            + ": " + payment.amount().formatted();
        channel.send(payment.customerEmail(), body);
    }
}

public final class RefundNotice extends Notification {
    public RefundNotice(Channel channel) { super(channel); }

    @Override
    public void notify(Payment payment) {
        String body = "Refund issued for payment " + payment.id();
        channel.send(payment.customerEmail(), body);
    }
}</pre>` },
    { title: `Implementation and flow`, body: `<p>You compose the two sides at construction time and delegate across the bridge:</p>
<ol>
<li>Build the implementor: <code>Channel channel = new SmsChannel(twilioClient)</code>.</li>
<li>Build the abstraction with it: <code>Notification note = new Receipt(channel)</code>.</li>
<li>Call the high-level operation: <code>note.notify(payment)</code> formats the receipt, then delegates transport to <code>channel.send(to, body)</code>.</li>
</ol>
<pre>// --- Concrete implementors: each channel is independent ---
public final class EmailChannel implements Channel {
    private final MailSender mailSender;
    public EmailChannel(MailSender mailSender) { this.mailSender = mailSender; }

    @Override
    public void send(String recipient, String body) {
        mailSender.send(recipient, "Payment notification", body);
    }
}

public final class SmsChannel implements Channel {
    private final TwilioClient twilio;
    public SmsChannel(TwilioClient twilio) { this.twilio = twilio; }

    @Override
    public void send(String recipient, String body) {
        twilio.messages().create(recipient, body);
    }
}

// --- Composition at runtime: m + n, not m × n ---
Channel sms = new SmsChannel(twilio);
Notification receipt = new Receipt(sms);
receipt.notify(capturedPayment);  // formats receipt, sends via SMS</pre>
<p>Because <code>Receipt</code> knows nothing about Twilio, you can swap in a <code>PushChannel</code> at runtime, or add a brand-new notification type, without touching the delivery code.</p>` },
    { title: `Trade-offs and how it differs from Adapter`, body: `<p>Bridge adds indirection and only pays off when both dimensions genuinely vary; for a single fixed implementation it is over-engineering. The upside is that each hierarchy stays small and independently testable, and you can select implementations at runtime.</p>
<p>The key contrast is intent and timing:</p>
<ul>
<li><b>Adapter</b> is retrofitted to make an <em>existing</em> incompatible class fit an interface you already have.</li>
<li><b>Bridge</b> is designed <em>up front</em> to keep abstraction and implementation loosely coupled from the start.</li>
<li><b>Strategy</b> swaps one interchangeable algorithm inside an object; Bridge separates two whole class hierarchies.</li>
</ul>` },
  ],
  figures: [
    { id: "bridge-class", svg: CLASS_SVG, caption: "Two hierarchies joined by composition: what to notify varies on the left, how to deliver varies on the right, and they combine freely." },
  ],
  related: ["adapter", "decorator", "strategy", "proxy", "facade"],
});

export const meta = topic.meta;
export const content = topic.content;
