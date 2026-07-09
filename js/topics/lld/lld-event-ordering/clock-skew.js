// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "clock-skew", title: "Clock Skew", category: "ordering" };

const SKEW_SVG = `<svg viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two machine clocks disagree, reversing true event order">
  <defs><marker id="fig-clock-skew-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="70" y="45" text-anchor="middle" fill="#5b9dff" font-size="10" font-family="system-ui">Node A</text>
  <text x="70" y="115" text-anchor="middle" fill="#7c5cff" font-size="10" font-family="system-ui">Node B</text>
  <line x1="110" y1="40" x2="680" y2="40" stroke="#93a1bd" stroke-width="1"/>
  <line x1="110" y1="110" x2="680" y2="110" stroke="#93a1bd" stroke-width="1"/>
  <circle cx="300" cy="40" r="5" fill="#3ddc97"/>
  <text x="300" y="28" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">write X  t=10.000</text>
  <circle cx="440" cy="110" r="5" fill="#ff6b6b"/>
  <text x="440" y="132" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">write X  t=9.980</text>
  <text x="600" y="75" text-anchor="middle" fill="#ff6b6b" font-size="10" font-family="system-ui">B's clock 40ms behind</text>
  <text x="600" y="90" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">later write looks earlier</text>
  <text x="360" y="150" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Last-writer-wins by timestamp keeps A's older value — B's update is lost</text>
</svg>`;

export const content = {
  oneliner: `Independent machine clocks never agree exactly; using wall-clock timestamps to order events across nodes silently corrupts causality and drops writes.`,
  archetype: "failure",
  figures: [
    { id: "skew-flow", svg: SKEW_SVG, caption: "B writes X 20ms after A in real time, but B's clock lags 40ms, so B's timestamp is smaller. Last-writer-wins by timestamp keeps A's value and discards B's newer write." },
  ],
  sections: [
    { title: `Symptom`, body: `<p>Ordering or conflict-resolution logic based on timestamps produces impossible or lossy results. A <b>last-writer-wins</b> store discards a newer write because it carries a smaller timestamp than an older one; a cache TTL expires "in the past"; distributed traces show a response arriving before its request; a token's <code>notBefore</code> check fails on a server whose clock drifted. Events appear to happen in an order that violates cause and effect, and the culprit is that two machines disagree on what time it is.</p>` },
    { title: `Root cause`, body: `<p>Every computer keeps time with a quartz oscillator that drifts — typically tens of parts per million, so an unsynchronized clock can wander seconds per day, more under heat. <b>NTP</b> corrects this but only approximately: it disciplines clocks to within milliseconds to tens of milliseconds over the internet, and it can <em>step</em> the clock backward when it finds it too far ahead, so wall time is not even monotonic. Virtualization adds pauses and clock jumps on migration. The result is <b>clock skew</b>: at any instant, node A's clock and node B's clock differ by an unknown, changing amount.</p>
<p>The fatal mistake is treating a wall-clock timestamp as a global ordering. If A writes at its 10.000s and B writes 20ms later at its 9.980s (B lags 40ms), a timestamp comparison concludes B happened first — reversing reality. There is no true "simultaneous" across machines, and no timestamp that is comparable across machines without bounded error.</p>` },
    { title: `Fixes`, body: `<p>Stop using raw wall-clock time to order events across nodes. Use ordering mechanisms that do not depend on synchronized clocks:</p>
<ul>
<li><b>Logical clocks.</b> Lamport clocks give a consistent total order from a counter; vector clocks distinguish causally-ordered from truly-concurrent events. Neither needs synchronized time.</li>
<li><b>Version numbers / sequence per entity.</b> A monotonic counter on the record is an unambiguous order for that record.</li>
<li><b>Server-assigned ordering.</b> Let a single authority (a primary, or the database's commit sequence) assign order, so one clock decides.</li>
<li><b>Bounded-uncertainty clocks.</b> Where you must use physical time, use a clock with an explicit error bound (Google TrueTime, hybrid logical clocks) and wait out the uncertainty interval before committing an order.</li>
</ul>
<p>If you must resolve conflicts by timestamp, at least attach a node id as a deterministic tiebreaker and accept that it is heuristic, not causal.</p>
<pre>// BROKEN: last-writer-wins by wall-clock across nodes
public void updateBalanceLww(String walletId, long newBalance, Instant ts) {
    Wallet w = repo.find(walletId);
    if (ts.isAfter(w.getUpdatedAt())) {  // B's clock may lag A's
        w.setBalance(newBalance);
        w.setUpdatedAt(ts);
    }
}

// FIXED: server-assigned monotonic version per wallet
@Entity
public class Wallet {
    @Id private String id;
    private long balanceCents;
    @Version private long version; // JPA increments on each commit
}

@Transactional
public void debitWithVersion(String walletId, long amount) {
    Wallet w = repo.findById(walletId).orElseThrow();
    if (w.getBalanceCents() &lt; amount) throw new InsufficientFundsException();
    w.setBalanceCents(w.getBalanceCents() - amount);
    // version checked at flush — stale writer gets OptimisticLockException
}</pre>` },
    { title: `Prevention`, body: `<p>Run NTP (or chrony / PTP for tighter bounds) on every host and <b>monitor clock offset</b>, alerting when skew exceeds a threshold — many "impossible ordering" incidents trace back to one machine whose NTP silently died. Design data models so correctness never rests on cross-node timestamp comparison: prefer per-entity versions, logical clocks, or a single sequencing authority. Treat any timestamp received from another machine as approximate, and never use it for security decisions (token expiry, nonce windows) without a generous tolerance. In short, physical clocks measure duration adequately but cannot order distributed events — use logical time for that.</p>` },
  ],
  related: ["lamport-clock", "vector-clock", "event-reordering", "out-of-order", "eventual-consistency", "crdt"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("clock-skew", stage, panel, stageEl);
}
