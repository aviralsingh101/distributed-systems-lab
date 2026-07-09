// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "two-pc", title: "Two-Phase Commit (2PC)", category: "transactions" };

const FLOW_SVG = `<svg viewBox="0 0 720 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two-phase commit message flow">
  <defs><marker id="fig-two-pc-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="290" y="12" width="140" height="34" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="360" y="33" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Coordinator</text>
  <rect x="70" y="150" width="150" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="145" y="171" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger (RM 1)</text>
  <rect x="500" y="150" width="150" height="34" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="575" y="171" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Wallet (RM 2)</text>
  <text x="175" y="80" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Phase 1: PREPARE</text>
  <text x="175" y="120" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">vote YES (in-doubt, locks held)</text>
  <text x="560" y="80" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Phase 2: COMMIT</text>
  <text x="560" y="120" text-anchor="middle" fill="#3ddc97" font-size="10" font-family="system-ui">ack + release locks</text>
  <line x1="320" y1="46" x2="150" y2="148" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-two-pc-arr)"/>
  <line x1="200" y1="150" x2="330" y2="48" stroke="#3ddc97" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-two-pc-arr)"/>
  <line x1="400" y1="46" x2="570" y2="148" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-two-pc-arr)"/>
  <line x1="520" y1="150" x2="390" y2="48" stroke="#3ddc97" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#fig-two-pc-arr)"/>
</svg>`;

export const content = {
  oneliner: `An atomic-commit protocol that makes several independent databases commit all-or-nothing — at the cost of blocking if the coordinator dies.`,
  archetype: "pattern",
  figures: [
    { id: "2pc-flow", svg: FLOW_SVG, caption: "Coordinator drives a prepare round, then a commit round. Between its YES vote and the decision, each resource manager is in-doubt and holds locks." },
  ],
  sections: [
    { title: `What problem 2PC solves`, body: `<p>A local transaction is atomic because one database controls one write-ahead log. The problem appears when a single logical operation must update <b>two or more independent resource managers</b> — say the Ledger debits a wallet in one database while an Inventory service reserves stock in another. Each can commit locally, but there is no shared log, so a crash between the two local commits leaves the system half-applied: money moved, stock not reserved.</p>
<p><b>Two-Phase Commit (2PC)</b> is a distributed atomic-commit protocol that coordinates these independent participants so that either <em>all</em> of them commit or <em>all</em> of them abort. It is the classic implementation behind the XA / JTA standard used by application servers and distributed databases.</p>` },
    { title: `Roles and structure`, body: `<p>There are two roles. The <b>coordinator</b> (transaction manager) drives the protocol and owns the final decision. The <b>participants</b> (resource managers — each a database or queue) do the actual work and vote. Both sides keep a durable write-ahead log so decisions survive a crash.</p>
<p>The guarantee is <b>atomicity across participants</b>: the coordinator only decides COMMIT after every participant has durably promised it can commit.</p>
<pre>interface ResourceManager {          // one per participant (e.g. Wallet DB)
    Vote prepare(Xid xid);           // do work, flush redo/undo log, lock -> YES or NO
    void commit(Xid xid);            // apply and release locks
    void abort(Xid xid);             // roll back and release locks
}
// Coordinator, phase 1 then phase 2:
boolean allYes = participants.stream().allMatch(rm -&gt; rm.prepare(xid) == Vote.YES);
log.force(allYes ? Decision.COMMIT : Decision.ABORT);   // point of no return
participants.forEach(rm -&gt; { if (allYes) rm.commit(xid); else rm.abort(xid); });</pre>` },
    { title: `The two phases, step by step`, figureAfter: "2pc-flow", body: `<ol>
<li><b>Phase 1 — prepare / voting.</b> The coordinator sends <code>PREPARE</code> to every participant. Each participant does the work, flushes it to its redo/undo log, takes the necessary locks, and replies <code>VOTE-COMMIT</code> (yes) or <code>VOTE-ABORT</code> (no). After voting yes a participant enters the <b>prepared / in-doubt</b> state: it has given up the right to abort on its own and must wait for orders while holding its locks.</li>
<li><b>Phase 2 — commit / abort.</b> If all votes are yes, the coordinator writes a <code>COMMIT</code> record to its own log (this is the point of no return) and broadcasts <code>COMMIT</code>. Participants apply, release locks, and acknowledge. If any vote was no (or a timeout occurred), the coordinator broadcasts <code>ABORT</code> and everyone rolls back.</li>
</ol>
<p>Because a participant that voted yes has durably logged its intent, it can always honor the coordinator's later decision even after its own restart.</p>` },
    { title: `The blocking problem`, body: `<p>2PC's fatal weakness is the in-doubt window. Suppose every participant has voted yes and is holding locks, and then the <b>coordinator crashes before broadcasting the decision</b>. A prepared participant cannot unilaterally commit (another might have to abort) nor unilaterally abort (the coordinator may have already logged COMMIT). It must <b>block</b> — holding locks and refusing conflicting transactions — until the coordinator recovers and re-sends the decision. This is why 2PC is called a <em>blocking</em> protocol and why it does not tolerate coordinator failure or a network partition (it sacrifices availability, the CAP-style trade-off).</p>` },
    { title: `Costs and when to use it`, body: `<p>Every commit costs two network round trips plus forced log flushes, and locks are held across those round trips — so throughput drops and deadlock risk rises under contention. Latency of the whole transaction is bounded by the slowest participant.</p>
<p>Use 2PC when you genuinely need cross-resource atomicity and the participants are reliable, low-latency, and co-located (e.g. XA across shards of the same database, or a DB plus a transactional queue on the same network). Avoid it across service or datacenter boundaries where the coordinator can partition away — there, prefer a <b>saga</b> with compensations, or the <b>transactional outbox</b> to make one local commit publish reliable events. 3PC attempts to remove the blocking window but is rarely used in practice.</p>` },
  ],
  related: ["three-pc", "saga", "tcc", "transactional-outbox", "isolation-levels"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("two-pc", stage, panel, stageEl);
}
