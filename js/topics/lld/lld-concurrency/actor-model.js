// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const ACTOR_SVG = `<svg viewBox="0 0 720 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Actor with mailbox">
  <defs><marker id="fig-actor-model-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="40" y="70" width="90" height="34" rx="5" fill="#1a2236" stroke="#5b9dff" stroke-width="1.4"/><text x="85" y="91" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">sender</text>
  <rect x="210" y="60" width="150" height="60" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="285" y="78" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">mailbox (FIFO)</text>
  <text x="285" y="98" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">m3 · m2 · m1 →</text>
  <rect x="430" y="45" width="230" height="90" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.6"/>
  <text x="545" y="70" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Actor</text>
  <text x="545" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">private state (no sharing)</text>
  <text x="545" y="108" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">handle 1 message at a time</text>
  <line x1="130" y1="87" x2="208" y2="87" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-actor-model-arr)"/>
  <line x1="360" y1="90" x2="428" y2="90" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-actor-model-arr)"/>
  <text x="285" y="150" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">async send — no shared memory, no locks</text>
</svg>`;

const topic = makeTopic({
  id: "actor-model",
  title: "Actor Model",
  category: "lld-concurrency",
  track: "lld",
  tier: "advanced",
  archetype: "concept",
  oneliner: `Concurrency without shared memory: independent actors own private state and communicate only by asynchronous messages delivered to per-actor mailboxes.`,
  sections: [
    { title: `The core idea`, body: `<p>The <b>actor model</b> replaces shared-memory-plus-locks with isolated units called <b>actors</b>. An actor has three things: private mutable state that nothing else can touch, a <b>mailbox</b> (an incoming message queue), and behavior that runs in response to messages. Actors never read or write each other's state — the only way to affect another actor is to <b>send it a message</b>. Remove shared mutable state and you remove data races and the need for locks entirely.</p>` },
    { title: `How it works`, figureAfter: "actor", body: `<p>Messages are sent <b>asynchronously</b>: the sender enqueues into the target's mailbox and continues without waiting. Each actor processes its mailbox <b>one message at a time</b>, sequentially. That single-threaded-per-actor guarantee is what makes the state safe — while handling a message an actor can freely mutate its own fields because no other message for it is running concurrently.</p>
<pre>// Akka-style wallet actor — serializes all debits per wallet
public class WalletActor extends AbstractBehavior&lt;WalletCommand&gt; {
    private long balanceCents;

    public static Behavior&lt;WalletCommand&gt; create(String walletId) {
        return Behaviors.setup(ctx -&gt; new WalletActor(ctx, walletId));
    }

    @Override
    public Receive&lt;WalletCommand&gt; createReceive() {
        return newReceiveBuilder()
            .onMessage(Debit.class, this::onDebit)
            .onMessage(GetBalance.class, this::onGetBalance)
            .build();
    }

    private Behavior&lt;WalletCommand&gt; onDebit(Debit cmd) {
        if (balanceCents &lt; cmd.amountCents()) {
            cmd.replyTo().tell(new DebitRejected("insufficient funds"));
        } else {
            balanceCents -= cmd.amountCents();
            cmd.replyTo().tell(new DebitAccepted(balanceCents));
        }
        return this;  // same actor, next message from mailbox
    }
}

// OrderService sends Debit — never touches balance directly
walletActor.tell(new Debit(amount, replyProbe.ref()));</pre>
<p>In response to a message an actor may do three things (Hewitt's axioms): (1) send messages to other actors, (2) create new actors, and (3) change how it will handle the <em>next</em> message (its state/behavior). There is no shared clock and no guaranteed global ordering — only per-sender/per-mailbox ordering, depending on the runtime.</p>
<pre>// Wallet actor: serializes all debits to one account — no locks
public final class WalletActor implements Runnable {
    private final BlockingQueue&lt;WalletMessage&gt; mailbox = new LinkedBlockingQueue&lt;&gt;();
    private Money balance = Money.ZERO;

    public void tell(WalletMessage msg) throws InterruptedException {
        mailbox.put(msg);  // async send — sender does not wait
    }

    @Override
    public void run() {
        while (true) {
            try {
                WalletMessage msg = mailbox.take();
                switch (msg) {
                    case DebitCommand(var amount, var replyTo) -&gt; {
                        if (balance.isLessThan(amount)) {
                            replyTo.tell(new DebitFailed("insufficient funds"));
                        } else {
                            balance = balance.subtract(amount);
                            replyTo.tell(new Debited(amount, balance));
                        }
                    }
                    case GetBalance(var replyTo) -&gt;
                        replyTo.tell(new BalanceReply(balance));
                }
            } catch (InterruptedException e) { break; }
        }
    }
}

sealed interface WalletMessage permits DebitCommand, GetBalance {}
record DebitCommand(Money amount, WalletActor replyTo) implements WalletMessage {}
record GetBalance(WalletActor replyTo) implements WalletMessage {}</pre>` },
    { title: `Supervision and resilience`, body: `<p>Actor systems (Erlang/OTP, Akka) organize actors into <b>supervision hierarchies</b>: a parent supervisor watches its children and, on failure, applies a strategy — restart the child, restart siblings, or escalate. This is the "let it crash" philosophy: rather than defensively handling every error inline, an actor crashes cleanly and its supervisor restores it to a known-good state. Because state is isolated, one actor crashing cannot corrupt another. <b>Location transparency</b> — an actor reference works the same whether the actor is local or on another node — lets the same programming model scale from one machine to a cluster.</p>` },
    { title: `Trade-offs`, body: `<p>Actors excel at stateful concurrent entities: a per-user session, a per-wallet balance actor that serializes all debits to one account, or a device shadow. Serializing all messages to one actor gives a natural single-writer per entity without explicit locks. The costs: message passing adds latency and copying versus a direct method call; reasoning about <b>asynchronous, out-of-order</b> flows is harder than sequential code; back-pressure must be designed in, since an unbounded mailbox can grow without limit if a slow actor is flooded. Use it when isolation and fault-tolerance matter more than the lowest possible in-process latency.</p>
<pre>// Supervision: parent restarts child wallet actor on failure
public final class WalletSupervisor {
    private volatile WalletActor child;

    public WalletSupervisor(String walletId, Money initialBalance) {
        spawnChild(walletId, initialBalance);
    }

    private void spawnChild(String walletId, Money balance) {
        child = new WalletActor(walletId, balance);
        Thread t = Thread.ofVirtual().name("wallet-" + walletId).start(child);
        t.setUncaughtExceptionHandler((thread, ex) -&gt; {
            log.error("Wallet actor crashed, restarting", ex);
            spawnChild(walletId, loadBalanceFromDb(walletId)); // let it crash, restore
        });
    }

    public void debit(Money amount) throws InterruptedException {
        child.tell(new DebitCommand(amount, ackActor));
    }
}</pre>` },
  ],
  figures: [
    { id: "actor", svg: ACTOR_SVG, caption: "Senders enqueue messages into an actor's mailbox; the actor processes them one at a time against its private, unshared state." },
  ],
  related: ["producer-consumer", "reactive-streams", "threads-vs-async", "message-queue"],
});

export const meta = topic.meta;
export const content = topic.content;
