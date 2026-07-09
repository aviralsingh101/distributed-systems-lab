// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "three-pc", title: "Three-Phase Commit (3PC)", category: "transactions" };

const FLOW_SVG = `<svg viewBox="0 0 720 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three-phase commit phases">
  <defs><marker id="fig-three-pc-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="55" width="180" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="120" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">1. canCommit?</text>
  <text x="120" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">vote yes/no — no locks yet</text>
  <rect x="270" y="55" width="180" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="360" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">2. preCommit</text>
  <text x="360" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">everyone knows decision = commit</text>
  <rect x="510" y="55" width="180" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="600" y="72" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">3. doCommit</text>
  <text x="600" y="87" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">apply + release</text>
  <line x1="210" y1="75" x2="268" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-three-pc-arr)"/>
  <line x1="450" y1="75" x2="508" y2="75" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-three-pc-arr)"/>
  <text x="360" y="128" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">The preCommit phase removes 2PC's in-doubt blocking — under a fail-stop, no-partition model.</text>
</svg>`;

export const content = {
  oneliner: `A non-blocking variant of 2PC that adds a pre-commit phase so participants can safely decide by timeout — but only under assumptions real networks violate.`,
  archetype: "pattern",
  figures: [
    { id: "3pc-flow", svg: FLOW_SVG, caption: "Three phases: canCommit (vote), preCommit (propagate the decision), doCommit (apply)." },
  ],
  sections: [
    { title: `Why 3PC exists`, body: `<p><b>Two-Phase Commit</b> can leave a participant that already voted yes <em>blocked</em>: if the coordinator crashes before announcing the outcome, the participant is in-doubt, holds locks, and cannot safely commit or abort on its own. <b>Three-Phase Commit (3PC)</b> attacks exactly that window by inserting an extra round so that the decision is fully propagated <em>before</em> anyone actually commits, letting survivors reach a consistent conclusion by timeout.</p>` },
    { title: `The three phases`, figureAfter: "3pc-flow", body: `<ol>
<li><b>canCommit?</b> — The coordinator asks each participant whether it <em>could</em> commit. Participants only validate; they do not yet lock resources or write undo logs. Each replies yes or no.</li>
<li><b>preCommit</b> — If all said yes, the coordinator sends <code>preCommit</code>. Now each participant prepares (logs, locks) and acknowledges. Crucially, receiving preCommit tells a participant that <em>every</em> participant voted yes, so the global decision is already "commit".</li>
<li><b>doCommit</b> — After the acks, the coordinator sends <code>doCommit</code>; participants apply and release locks.</li>
</ol>` },
    { title: `How the extra phase avoids blocking`, body: `<p>The safety argument rests on a simple invariant created by the middle phase: <b>no participant commits until it knows all participants have agreed to commit</b>. So after a coordinator failure a survivor can decide by timeout instead of blocking:</p>
<ul>
<li>If a participant has received <code>preCommit</code>, it (and by the invariant, everyone who is still up) may time out and <b>commit</b>.</li>
<li>If it has not received <code>preCommit</code>, no one can have committed yet, so it may time out and <b>abort</b>.</li>
</ul>
<pre>// survivor's decision after the coordinator disappears
void onCoordinatorTimeout() {
    if (localState == State.PRE_COMMIT) commit();  // all voted YES -> safe to commit
    else                                abort();    // nobody could have committed yet
}</pre>
<p>An elected recovery coordinator can query the survivors' states and drive them to a single outcome. This is what makes 3PC "non-blocking" in the textbook sense.</p>` },
    { title: `Why it is rarely used`, body: `<p>3PC's guarantee holds only under a <b>fail-stop model with bounded message delays and no network partitions</b>. Real networks partition, and a partition breaks the argument: two sides can time out into <em>different</em> decisions (one commits, the other aborts), corrupting the transaction — the exact atomicity 2PC was protecting. It also adds a third round trip, worsening latency for a benefit that evaporates precisely when you need it.</p>
<p>Because of this, production systems that need partition-tolerant agreement do not use 3PC. They rely on <b>consensus protocols (Paxos, Raft, Zab)</b> to agree on the commit decision, or they sidestep distributed commit entirely with <b>sagas</b> and compensations. 3PC is best understood as an instructive stepping stone from 2PC toward consensus, not a tool you reach for.</p>` },
  ],
  related: ["two-pc", "saga", "tcc", "quorum"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("three-pc", stage, panel, stageEl);
}
