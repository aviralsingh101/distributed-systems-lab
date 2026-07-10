// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const topic = makeTopic({
  id: "kafka-vs-rabbitmq",
  title: "Kafka vs RabbitMQ",
  category: "hld-blocks",
  track: "hld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Log vs broker semantics for messaging.`,
  sections: [
    { title: `The decision`, body: `<p>Log vs broker semantics for messaging.</p><p>Neither <b>Kafka</b> nor <b>RabbitMQ</b> wins universally — constraints pick the winner. Open with the business constraint (scale, consistency, team, budget), not the technology name.</p>` },
    { title: `Kafka — when it wins`, body: `<p>Choose <b>Kafka</b> when simplicity, strong guarantees, or team familiarity matter more than infinite horizontal scale. Good fit for early stage or strict correctness paths.</p>
<p>List concrete strengths: operability, query flexibility, transaction support, or lower moving parts.</p>` },
    { title: `RabbitMQ — when it wins`, body: `<p>Choose <b>RabbitMQ</b> when scale, partition tolerance, or specialized access patterns dominate. Accept higher operational and migration cost.</p>
<p>List concrete strengths: partition tolerance, write throughput, schema flexibility, or geo distribution.</p>` },
    { title: `Comparison`, body: `<p>Compare latency (p50/p99), consistency, operability, cost, and migration risk. Prototype under realistic load — paper tradeoffs hide tail latency and ops toil.</p>
<p>Use a simple table in the interview: rows = criteria, columns = options, cells = short verdict.</p>`, figureAfter: "comparison" },
    { title: `Decision guide for Kafka vs RabbitMQ`, body: `<p>Start with the simpler option that meets SLOs. Escalate only when metrics prove pain: p99 breaches, unreconciled data, or ops blocking velocity.</p>
<p>Document the decision in an ADR; revisit when traffic 10× or team doubles.</p>` },
    { title: `Interview framing`, body: `<p>What interviewers probe for <b>Kafka vs RabbitMQ</b>:</p><ul><li>Treating <b>Kafka vs RabbitMQ</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>Saying "it depends" without decision criteria.</li><li>Not comparing operability and migration cost.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  figures: [
    { id: "request-flow", svg: `<svg viewBox="0 0 500 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kafka vs RabbitMQ flow"> <defs><marker id="fig-kafka-vs-rabbitmq-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs> <text x="250" y="18" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Request flow</text> <rect x="10" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/> <text x="46" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Client</text> <rect x="100" y="40" width="88" height="36" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/> <text x="144" y="52" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Kafka vs Rabbi</text><text x="144" y="68" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">this layer</text> <rect x="206" y="40" width="80" height="36" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/> <text x="246" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Order</text> <rect x="304" y="40" width="84" height="36" rx="6" fill="#1a2236" stroke="#ff8fab" stroke-width="1.5"/> <text x="346" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Gateway</text> <rect x="406" y="40" width="72" height="36" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/> <text x="442" y="62" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Ledger</text> <line x1="82" y1="58" x2="98" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-kafka-vs-rabbitmq-arr)"/> <line x1="188" y1="58" x2="204" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-kafka-vs-rabbitmq-arr)"/> <line x1="286" y1="58" x2="302" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-kafka-vs-rabbitmq-arr)"/> <line x1="388" y1="58" x2="404" y2="58" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#fig-kafka-vs-rabbitmq-arr)"/> </svg>`, caption: `Kafka vs RabbitMQ on the ingress path — client traffic flows through this layer to backend services.` },
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
