// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "tcc", title: "TCC (Try / Confirm / Cancel)", category: "transactions" };

const FLOW_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Try-Confirm-Cancel flow">
  <defs><marker id="fig-tcc-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="65" width="120" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="80" y="82" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Try</text>
  <text x="80" y="97" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">reserve / hold</text>
  <rect x="300" y="20" width="150" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="375" y="37" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Confirm</text>
  <text x="375" y="52" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">use reservation (all Try ok)</text>
  <rect x="300" y="110" width="150" height="40" rx="6" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="375" y="127" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Cancel</text>
  <text x="375" y="142" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">release reservation (any Try failed)</text>
  <line x1="140" y1="78" x2="298" y2="45" stroke="#3ddc97" stroke-width="1.5" marker-end="url(#fig-tcc-arr)"/>
  <line x1="140" y1="92" x2="298" y2="125" stroke="#ff6b6b" stroke-width="1.5" marker-end="url(#fig-tcc-arr)"/>
  <text x="560" y="82" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Each op is idempotent;</text>
  <text x="560" y="98" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">reservation gives isolation.</text>
</svg>`;

export const content = {
  oneliner: `A business-layer distributed transaction: every service exposes Try, Confirm, and Cancel so a coordinator can reserve resources first and commit or release them together.`,
  archetype: "pattern",
  figures: [
    { id: "tcc-flow", svg: FLOW_SVG, caption: "Try reserves on every service; if all succeed the coordinator Confirms all, otherwise it Cancels all." },
  ],
  sections: [
    { title: `The idea`, body: `<p><b>TCC (Try-Confirm-Cancel)</b> implements a distributed transaction at the <em>application</em> layer instead of the database layer. Each participating service exposes three explicit operations for a business action, and a coordinator invokes them in two rounds — much like 2PC, but the "prepare" is a real business reservation and the rollback is a compensating call, not a database undo.</p>
<p>It fits money movement well: a payment that must debit a Wallet, charge through a Gateway, and credit a Ledger — all owned by different services — commits as a unit or not at all, without holding database locks across the network.</p>` },
    { title: `The three operations`, figureAfter: "tcc-flow", body: `<ul>
<li><b>Try</b> — validate business rules and <b>reserve</b> the resources needed, without applying the final effect. For a wallet debit, Try does not remove money; it moves the amount into a <em>frozen / held</em> balance so no other transaction can spend it.</li>
<li><b>Confirm</b> — perform the real effect using only what Try reserved (turn the hold into an actual debit). Confirm must not re-check business rules — Try already guaranteed feasibility — and it must be idempotent.</li>
<li><b>Cancel</b> — release the reservation made by Try (unfreeze the held funds). Also idempotent.</li>
</ul>
<pre>public interface TccParticipant {
    // Phase 1: reserve, validate rules, DO NOT apply the final effect
    Reservation tryReserve(TxnId txn, Money amount);
    // Phase 2a: turn the hold into the real effect (idempotent)
    void confirm(TxnId txn);
    // Phase 2b: release the hold (idempotent)
    void cancel(TxnId txn);
}</pre>` },
    { title: `Coordinator flow`, body: `<p>The structure of the orchestration mirrors 2PC's two phases:</p>
<ol>
<li><b>Try phase.</b> The coordinator calls <code>Try</code> on every service. Each success returns a reservation the service will honor for a bounded time.</li>
<li><b>Confirm or Cancel phase.</b> If <em>all</em> Try calls succeeded, the coordinator calls <code>Confirm</code> on all services. If <em>any</em> Try failed or timed out, it calls <code>Cancel</code> on all services that were tried.</li>
</ol>
<p>The coordinator persists its decision and retries Confirm/Cancel until every service acknowledges, because those calls can fail transiently.</p>` },
    { title: `Why reservations beat a plain saga`, body: `<p>A plain choreographed <b>saga</b> applies each step for real and compensates afterward, so between steps other transactions can observe and act on half-finished state (a classic isolation anomaly — someone spends money that a later step will claw back). TCC's Try holds resources instead of applying them, giving you a reservation-based form of isolation without database-level distributed locks. Compared to <b>2PC</b>, TCC never leaves a database in-doubt holding row locks, so it scales across services and datacenters.</p>` },
    { title: `Hard parts to get right`, body: `<p>TCC pushes real complexity onto developers. Every operation must be <b>idempotent</b> because retries are unavoidable. You must handle two ordering hazards: the <b>empty confirm/cancel</b> (a Cancel arrives for a Try that was never received or already timed out — record it so a late Try is rejected) and the <b>hanging Try</b> (a delayed Try arrives after its Cancel — it must become a no-op). Reservations need timeouts so a crashed coordinator does not freeze funds forever, and you need a recovery job that reconciles reservations left dangling. Use TCC when you need cross-service atomicity with isolation and are willing to write and test all three paths per action.</p>` },
  ],
  related: ["saga", "two-pc", "three-pc", "idempotency-key", "transactional-outbox"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("tcc", stage, panel, stageEl);
}
