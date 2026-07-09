// @article-v2
// @sim-lab
import { makeTopic } from "../../_shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";
import { stateMachineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "consensus-raft-paxos",
  title: "Consensus (Raft / Paxos)",
  category: "hld-theory",
  track: "hld",
  tier: "advanced",
  archetype: "concept",
  oneliner: `Agree on one value despite failures.`,
  sections: [
    { title: `What is Consensus (Raft / Paxos)?`, body: `<p><b>Consensus (Raft / Paxos)</b> — Agree on one value despite failures.</p>
<p>In the payment platform topology, <b>Consensus (Raft / Paxos)</b> sits on the request or data path between Client/Order and shared infrastructure (Gateway, Ledger, Queue). Draw it explicitly on architecture diagrams with failure domains marked.</p>
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>` },
    { title: `How it works`, body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>Consensus (Raft / Paxos)</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>` },
    { title: `In production`, body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>Consensus (Raft / Paxos)</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>Consensus (Raft / Paxos)</b> configuration.</p>` },
    { title: `Common mistakes`, body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>` },
    { title: `Production checklist`, body: `<p>Before shipping <b>Consensus (Raft / Paxos)</b> changes to production:</p>
<ul>
<li>Add metrics and dashboards — error rate, p99 latency, and domain-specific counters (lag, depth, conflict rate).</li>
<li>Write a runbook entry with rollback steps and on-call escalation path.</li>
<li>Load-test with parallel requests on the same wallet or hot key — dev laptops hide races.</li>
<li>Correlate logs with <code>payment_id</code>, <code>wallet_id</code>, and <code>trace_id</code> across Order → Gateway → Ledger.</li>
<li>Link to related sidebar topics when planning architecture or incident postmortems.</li>
</ul>
<p>Interview tip: whiteboard the charge flow, mark where <b>Consensus (Raft / Paxos)</b> applies, and describe one real failure mode and its fix with concrete SQL or config.</p>` }
  ],
  figures: [
    { id: "consensus", svg: `<svg viewBox="0 0 500 185" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Consensus (Raft / Paxos) consensus"> <defs><marker id="fig-consensus-raft-paxos-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <circle cx="250" cy="100" r="70" fill="none" stroke="#93a1bd" stroke-width="1.5" stroke-dasharray="4 3"/> <rect x="220" y="12" width="60" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="250" y="24" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">L</text><text x="250" y="40" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">elected</text> <rect x="286.57395614066075" y="60.36881039375368" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="316.57395614066075" y="72.36881039375368" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F1</text><text x="316.57395614066075" y="88.36881039375368" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <rect x="261.1449676604731" y="138.63118960624632" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="291.1449676604731" y="150.63118960624632" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F2</text><text x="291.1449676604731" y="166.63118960624632" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <rect x="178.85503233952687" y="138.63118960624632" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="208.85503233952687" y="150.63118960624632" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F3</text><text x="208.85503233952687" y="166.63118960624632" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <rect x="153.42604385933925" y="60.36881039375366" width="60" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="183.42604385933925" y="72.36881039375366" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">F4</text><text x="183.42604385933925" y="88.36881039375366" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">follower</text> <line x1="250" y1="30" x2="316.57395614066075" y2="78.36881039375368" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <line x1="250" y1="30" x2="291.1449676604731" y2="156.63118960624632" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <line x1="250" y1="30" x2="208.85503233952687" y2="156.63118960624632" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <line x1="250" y1="30" x2="183.42604385933925" y2="78.36881039375366" stroke="#5b9dff" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#fig-consensus-raft-paxos-arr)"/> <text x="250" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Raft cluster — AppendEntries to quorum</text> </svg>`, caption: `Consensus (Raft / Paxos): one elected leader replicates log entries to a quorum of followers — partition blocks commit until a majority is reachable.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("consensus-raft-paxos", stage, panel, stageEl);
}