// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const CLASS_SVG = `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Command class structure">
  <defs><marker id="fig-command-arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="80" width="120" height="48" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="80" y="100" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">Invoker</text>
  <text x="80" y="116" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">queue / worker</text>
  <rect x="200" y="16" width="170" height="52" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="285" y="35" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">«interface» Command</text>
  <line x1="200" y1="44" x2="370" y2="44" stroke="#26324a"/>
  <text x="210" y="61" fill="#93a1bd" font-size="9" font-family="ui-monospace,monospace">+ execute() / + undo()</text>
  <rect x="200" y="120" width="170" height="56" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="285" y="140" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">RefundCommand</text>
  <text x="285" y="157" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="ui-monospace,monospace">receiver + paymentId + amount</text>
  <rect x="420" y="120" width="140" height="56" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="490" y="146" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger (receiver)</text>
  <text x="490" y="162" text-anchor="middle" fill="#93a1bd" font-size="8" font-family="system-ui">does the work</text>
  <line x1="140" y1="100" x2="198" y2="60" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-command-arr)"/>
  <text x="150" y="92" fill="#93a1bd" font-size="8" font-family="system-ui">holds</text>
  <line x1="285" y1="120" x2="285" y2="70" stroke="#3ddc97" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#fig-command-arr)"/>
  <line x1="370" y1="148" x2="418" y2="148" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-command-arr)"/>
  <text x="378" y="140" fill="#93a1bd" font-size="8" font-family="system-ui">calls</text>
</svg>`;

const topic = makeTopic({
  id: "command",
  title: "Command",
  category: "lld-behavioral",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Turn a request into a first-class object so it can be queued, logged, retried, and undone — decoupling who triggers an action from who performs it.`,
  sections: [
    { title: `Intent`, body: `<p><b>Command</b> encapsulates a request as an object. Once an action is a value rather than a method call, you can parameterize code with different requests, put them in a queue, log them for audit or replay, and support undo.</p>
<p>The decoupling is between the <em>invoker</em> (what triggers the action) and the <em>receiver</em> (what carries it out). A worker pulling <code>RefundCommand</code>, <code>CaptureCommand</code>, and <code>HoldCommand</code> objects off a queue does not need to know how a refund is performed — it just calls <code>execute()</code>.</p>
<pre>// --- Command: the request as a first-class object ---
public interface PaymentCommand {
    void execute();
    void undo();
}</pre>` },
    { title: `Participants and structure`, figureAfter: "command-class", body: `<p>Five roles:</p>
<ul>
<li><b>Command</b> — the interface, typically <code>execute()</code> and optionally <code>undo()</code>.</li>
<li><b>Concrete Command</b> — <code>RefundCommand</code>, binding a receiver plus the parameters (paymentId, amount).</li>
<li><b>Receiver</b> — the object that knows how to do the work (<code>Ledger</code>, <code>Wallet</code>).</li>
<li><b>Invoker</b> — holds and triggers commands (a queue processor or button handler).</li>
<li><b>Client</b> — creates the concrete command and wires it to its receiver.</li>
</ul>
<pre>// --- Concrete command: binds receiver + parameters ---
public final class ChargeCommand implements PaymentCommand {
    private final PaymentGateway gateway;
    private final ChargeRequest request;
    private ChargeResult result;  // captured for undo

    public ChargeCommand(PaymentGateway gateway, ChargeRequest request) {
        this.gateway = gateway;
        this.request = request;
    }

    @Override
    public void execute() {
        result = gateway.charge(request);
    }

    @Override
    public void undo() {
        if (result != null &amp;&amp; result.status() == ChargeStatus.CAPTURED) {
            gateway.refund(result.paymentId(), request.amount());
        }
    }
}</pre>` },
    { title: `Implementation flow`, body: `<p>The request becomes data that travels through the system:</p>
<ol>
<li>Client builds <code>new RefundCommand(ledger, paymentId, 1200)</code> and hands it to the invoker.</li>
<li>The invoker stores it — in memory, or serialized into a durable queue or outbox — decoupling submission from execution in time.</li>
<li>Later, the invoker calls <code>command.execute()</code>, which invokes the receiver; on failure it can retry the same object, and <code>undo()</code> can run a compensating action.</li>
</ol>
<pre>// --- Invoker: queues and executes commands ---
public final class PaymentCommandInvoker {
    private final Deque&lt;PaymentCommand&gt; history = new ArrayDeque&lt;&gt;();

    public void submit(PaymentCommand command) {
        command.execute();
        history.push(command);
    }

    public void undoLast() {
        if (!history.isEmpty()) {
            history.pop().undo();
        }
    }
}

// Client wires receiver into command, hands to invoker
PaymentCommand cmd = new ChargeCommand(gateway, chargeRequest);
invoker.submit(cmd);
// later: invoker.undoLast();  // compensating refund</pre>
<p>Because a command carries everything needed to run, it enables macro commands (a Composite of commands), transaction logs, and the write side of <b>CQRS</b>, where each command maps to a handler.</p>` },
    { title: `Trade-offs and Strategy contrast`, body: `<p>Command unlocks undo/redo, queuing, retries, scheduling, and auditability, at the price of a class (or object) per action. For undo you must capture enough state to reverse the effect, which is where <b>Memento</b> often pairs in.</p>
<p>It resembles <b>Strategy</b> — both wrap behaviour in an object — but the emphasis differs. Strategy encapsulates an <em>interchangeable algorithm</em> that a context runs now; Command encapsulates an <em>invocation as data</em> so it can be deferred, stored, replayed, and reversed. Strategy answers "how"; Command answers "do this, later, maybe undoably."</p>` },
  ],
  figures: [
    { id: "command-class", svg: CLASS_SVG, caption: "The invoker holds Command objects and calls execute(); each concrete command binds a receiver and its parameters." },
  ],
  related: ["strategy", "memento", "cqrs-handler-separation", "dead-letter-pattern", "transactional-outbox"],
});

export const meta = topic.meta;
export const content = topic.content;
