/**
 * Generate article-v2 sections from topic metadata — topic-specific, not identical boilerplate.
 * Used by migrate-to-article-v2.mjs only. Does NOT stamp forbidden phrases.
 */
import { wordCount } from "./article-quality.mjs";

const FAILURE_CATS = new Set(["concurrency", "locking", "retry", "cache", "messaging", "failure", "prod-eng"]);
const PATTERN_CATS = new Set([
  "lld-dist-patterns", "lld-creational", "lld-structural", "lld-behavioral",
  "lld-concurrency-strategies", "lld-transactions", "lld-dist-locks", "lld-idempotency",
]);
const TRADEOFF_CATS = new Set(["lld-tradeoffs", "hld-tradeoffs"]);

export function inferArchetype(track, catId, title) {
  if (track === "failures" || FAILURE_CATS.has(catId)) return "failure";
  if (PATTERN_CATS.has(catId)) return "pattern";
  if (TRADEOFF_CATS.has(catId)) return "tradeoff";
  const t = title.toLowerCase();
  if (t.includes(" vs ") || t.includes("versus")) return "tradeoff";
  if (catId.startsWith("hld-classic") || t.includes("design")) return "classic";
  return track === "lld" ? "pattern" : "concept";
}

function esc(s) {
  return (s || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function domainMechanics(title, catId, track) {
  const t = title.toLowerCase();
  const chunks = [];

  if (t.includes("dns") || catId.includes("networking")) {
    chunks.push(`<p><b>${title}</b> operates at the naming and routing layer. Resolution chains through stub resolver → recursive resolver → authoritative NS. TTL controls cache horizon; geo/latency policies return different answers per client location.</p>`);
  } else if (t.includes("cdn") || t.includes("cache")) {
    chunks.push(`<p>Edge caches store responses closer to clients. Cache keys typically include hostname, path, and query string. Purge APIs and short TTLs on dynamic payment status endpoints prevent stale balance displays.</p>`);
  } else if (t.includes("load balanc") || t.includes("proxy") || t.includes("gateway")) {
    chunks.push(`<p>Traffic distribution uses health-checked backends. Algorithms include round-robin, least-connections, consistent hash on <code>wallet_id</code>, and geographic routing. Connection draining during deploy prevents in-flight charge requests from hitting removed pods.</p>`);
  } else if (t.includes("kafka") || t.includes("queue") || t.includes("message") || catId.includes("messaging")) {
    chunks.push(`<p>Messages flow through brokers with partitions for parallelism. Consumer groups rebalance on member join/leave. At-least-once delivery requires idempotent handlers keyed on <code>payment_id</code> or <code>event_id</code>.</p>`);
  } else if (t.includes("shard") || t.includes("partition") || catId.includes("db-scaling") || catId.includes("data")) {
    chunks.push(`<p>Data is split across shards by hash or range key. Hot partitions concentrate traffic on one node — monitor per-shard QPS. Cross-shard transactions need two-phase commit or sagas; prefer single-shard wallet aggregates when possible.</p>`);
  } else if (t.includes("cap") || t.includes("consistency") || t.includes("quorum") || catId.includes("consistency")) {
    chunks.push(`<p>Under network partition, systems choose between strong consistency and availability. Quorum reads/writes use <code>R + W > N</code>. Payment ledgers often favor CP on the primary write path with async replica convergence for analytics.</p>`);
  } else if (t.includes("lock") || t.includes("deadlock") || t.includes("optimistic") || t.includes("pessimistic")) {
    chunks.push(`<p>Concurrency control prevents conflicting wallet updates. Row-level locks block concurrent writers; version columns enable optimistic retry; distributed locks (Redis, etcd) coordinate cross-service critical sections with fencing tokens.</p>`);
  } else if (t.includes("retry") || t.includes("backoff") || t.includes("herd") || t.includes("stampede")) {
    chunks.push(`<p>Retries amplify load when backends are degraded. Exponential backoff with full jitter spreads retry timing. Circuit breakers stop retry storms; single-flight refresh prevents cache stampede on hot merchant config keys.</p>`);
  } else if (t.includes("saga") || t.includes("outbox") || t.includes("2pc") || t.includes("transaction") || catId.includes("transactions")) {
    chunks.push(`<p>Distributed transactions split into local ACID commits plus compensating actions. Outbox pattern atomically writes business row and event intent; saga orchestrator tracks forward steps and compensation handlers per failed step.</p>`);
  } else if (track === "lld" || catId.startsWith("lld")) {
    chunks.push(`<p>In Order Service code, <b>${title}</b> structures classes and boundaries so wallet debits, Gateway calls, and outbox inserts remain testable. Handlers stay thin; domain services own invariants; repositories hide SQL.</p>`);
  } else if (track === "hld" || catId.startsWith("hld")) {
    chunks.push(`<p><b>${title}</b> is a building block in distributed system design — place it explicitly on architecture diagrams between clients, services, data stores, and async pipelines. Define its inputs, outputs, consistency expectations, and failure domain before sizing capacity.</p>`);
  } else {
    chunks.push(`<p><b>${title}</b> affects how concurrent payment requests interact with Wallet, Order Service, Gateway, and Ledger under production load — not just in single-threaded dev environments.</p>`);
  }
  return chunks.join("");
}

function failureSections(title, blurb, catId) {
  return [
    {
      title: "Symptom",
      body: `<p>${blurb} In production this surfaces as customer-visible errors, reconciliation drift, or SLO burn without an obvious code exception — support tickets reference wrong balances, duplicate charges, or timeouts during peak checkout.</p>
<p>Metrics to watch: error rate spike on affected endpoints, p99 latency increase, consumer lag, or reconciliation job failures comparing Ledger totals to Wallet projections.</p>`,
    },
    {
      title: "Root cause",
      body: `<p><b>${title}</b> occurs when the system assumes single-threaded or always-success execution. Under parallel charges, retries, or partial outages, that assumption breaks.</p>
${domainMechanics(title, catId, "failures")}
<p>Default database isolation (Read Committed) and naive application patterns do not prevent this without explicit design — the bug is often invisible in unit tests.</p>`,
    },
    {
      title: "How the failure unfolds",
      body: `<p>Two or more workers interleave operations on the same wallet or shared resource. Each step looks valid in isolation; the combined timeline violates an invariant (balance, idempotency, ordering, or lock discipline).</p>
<p>Reproduce with parallel load tests on the same <code>wallet_id</code> — low concurrency in dev hides the race until Black Friday traffic.</p>`,
    },
    {
      title: "Fixes",
      body: `<p>Choose a fix matching contention and UX:</p>
<ul>
<li><b>Atomic operations</b> — express updates in single SQL statements where possible (<code>UPDATE ... SET x = x + ?</code>).</li>
<li><b>Explicit locking</b> — <code>SELECT ... FOR UPDATE</code> or distributed lock with fencing token for cross-service sections.</li>
<li><b>Idempotency</b> — deduplicate retried requests with <code>Idempotency-Key</code> and unique constraints.</li>
<li><b>Isolation upgrade</b> — Serializable or explicit version columns with bounded retry on conflict.</li>
</ul>
<p>Document the chosen fix in the service runbook and add an integration test that fails without it.</p>`,
    },
    {
      title: "Prevention",
      body: `<p>Add alerts before customers notice: reconciliation jobs, conflict counters, lock wait time p99, retry rate dashboards. Run game-days with parallel charge scripts. Code review checklist: no read-modify-write without version check; no external HTTP inside DB transactions; lock ordering documented.</p>`,
    },
  ];
}

function conceptSections(title, blurb, catId, track) {
  return [
    {
      title: `What is ${title}?`,
      body: `<p><b>${title}</b> — ${blurb}</p>
${domainMechanics(title, catId, track)}
<p>Unlike a generic "best practice" label, it has a specific seat in the payment platform architecture with defined inputs, outputs, and failure modes.</p>`,
    },
    {
      title: "How it works",
      body: `<p>At runtime, components interact in a defined order with configurable timeouts, health checks, and backoff policies. Trace a single <code>POST /v1/charge</code> with <code>X-Request-ID</code> to see where <b>${title}</b> applies.</p>
<p>Configuration lives in infrastructure-as-code (Terraform, Helm) or edge config (nginx, Envoy, Cloudflare). Changes propagate through deploy pipelines — treat config drift as an incident precursor.</p>
<p>Capacity planning: measure peak QPS, payload size, and fan-out before scaling horizontally. Tail latency (p99) often reveals misconfiguration before mean latency moves.</p>`,
    },
    {
      title: "In production",
      body: `<p>Operate with dashboards: error rate, p99 latency, saturation, and dependency health. Runbooks cover failover, key rotation, and rollback. Game-day exercises validate that <b>${title}</b> behaves correctly during AZ failure or broker restart.</p>
<p>Security: TLS on public paths; no PAN in application logs; audit admin APIs that change <b>${title}</b> configuration.</p>`,
    },
    {
      title: "Common mistakes",
      body: `<ul>
<li>Deploying without measuring the problem the component solves.</li>
<li>Missing health checks — traffic routes to broken backends until manual intervention.</li>
<li>Ignoring cache TTL and DNS caching during migrations.</li>
<li>Operating without correlation IDs across Order → Gateway → Ledger.</li>
</ul>`,
    },
  ];
}

function patternSections(title, blurb, catId, track) {
  return [
    {
      title: "Motivation",
      body: `<p>${blurb}</p>
<p>Without <b>${title}</b>, Order Service code accrues ad-hoc fixes — duplicate event handlers, tangled dependencies, and untestable static calls that break under parallel payment load.</p>`,
    },
    {
      title: "Structure",
      body: `${domainMechanics(title, catId, track)}
<p>Map the pattern to packages: domain interfaces, infrastructure adapters, and thin HTTP handlers. Unit tests use fakes; integration tests use Testcontainers for Postgres and Kafka.</p>`,
    },
    {
      title: "Implementation flow",
      body: `<p>Typical charge flow with <b>${title}</b>:</p>
<ol>
<li>HTTP handler validates request and idempotency key.</li>
<li>Domain service applies business rules inside a transaction boundary.</li>
<li>Ledger write and optional outbox insert commit atomically.</li>
<li>Async relay publishes events; consumers deduplicate by <code>event_id</code>.</li>
</ol>
<p>Keep broker publish outside the DB transaction — use outbox for reliability.</p>`,
    },
    {
      title: "Tradeoffs",
      body: `<p><b>Benefits:</b> clearer code structure, testability, and explicit boundaries between Wallet, Gateway, and Queue integration.</p>
<p><b>Costs:</b> more classes and indirection; team must understand the pattern; misuse (pattern for pattern's sake) adds complexity without solving a real problem.</p>
<p><b>Use when:</b> the problem shape matches what <b>${title}</b> was designed for and simpler code is failing reviews or incidents.</p>`,
    },
  ];
}

function classicSections(title, blurb, catId) {
  return [
    {
      title: "Functional requirements",
      body: `<p>${blurb}</p>
<p>Clarify scope before drawing boxes: core user flows, read vs write ratio, latency targets, consistency needs, and what is explicitly out of scope for v1. Interviewers deduct points when you jump to databases without requirements.</p>`,
    },
    {
      title: "Capacity sketch",
      body: `<p>Back-of-envelope: daily active users → peak QPS, average payload size, storage growth per day, and fan-out to downstream services. <b>${title}</b> design choices (caching, sharding, async) should trace back to these numbers.</p>`,
    },
    {
      title: "High-level design",
      body: `${domainMechanics(title, catId, "hld")}
<p>Draw clients, API tier, data stores, caches, queues, and external dependencies. Mark sync vs async paths and which components are stateful. This is the diagram interviewers expect you to produce in 10–15 minutes.</p>`,
    },
    {
      title: "Deep dives",
      body: `<p>Pick 2–3 areas interviewers probe: data model, hot-path API design, partitioning strategy, caching, or consistency model. For <b>${title}</b>, explain the tradeoff behind each choice — not just the technology name.</p>`,
    },
    {
      title: "Bottlenecks and scaling",
      body: `<p>Identify the first three bottlenecks: single hot partition, DB write ceiling, fan-out to notification services, or storage cost. Describe horizontal scale path and what breaks if traffic 10× overnight.</p>`,
    },
    {
      title: "Interview pitfalls",
      body: `<p>Common mistakes in <b>${title}</b> interviews: skipping requirements, over-engineering microservices on day one, ignoring failure modes, or picking trendy tech without tying it to constraints. Practice narrating one scaling decision and one consistency tradeoff aloud.</p>`,
    },
  ];
}

function foundationSections(title, blurb) {
  return [
    {
      title: "Framework overview",
      body: `<p>${blurb}</p>
<p>A repeatable system design process reduces panic in interviews and design reviews: clarify requirements → estimate capacity → propose high-level design → deep-dive critical paths → discuss tradeoffs and failure modes.</p>`,
    },
    {
      title: "When to apply",
      body: `<p>Use <b>${title}</b> at the start of any greenfield design or major redesign — before committing to databases or service boundaries. Skip heavy process for small refactors; use full framework for cross-team architecture decisions.</p>`,
    },
    {
      title: "Example walkthrough",
      body: `<p>Walk through a concrete system (URL shortener, feed, or payment flow): state assumptions aloud, draw boxes left-to-right (client → edge → services → data), then drill into the highest-risk component. Interviewers reward structured thinking over memorized buzzwords.</p>`,
    },
    {
      title: "Common mistakes",
      body: `<ul>
<li>Jumping to sharding before defining read/write ratio.</li>
<li>Listing technologies without explaining why they fit constraints.</li>
<li>Ignoring non-functional requirements (availability, latency, cost).</li>
<li>Never discussing what happens when a dependency fails.</li>
</ul>`,
    },
  ];
}

function tradeoffSections(title, blurb) {
  return [
    {
      title: "The decision",
      body: `<p>${blurb} This is an architectural fork — not a universal winner. The right choice depends on consistency requirements, team expertise, operational budget, and how your payment platform scales.</p>
<p>Document the decision in an ADR: context, options considered, chosen option, and consequences. Revisit when SLOs breach or team composition changes.</p>`,
    },
    {
      title: "Option A — when it wins",
      body: `<p>The first path optimizes for simplicity and time-to-market. Fewer moving parts mean faster onboarding for engineers and lower operational surface area. Strong fit when traffic is moderate, consistency needs are straightforward, and the team is small.</p>
<p>Trade-off: may hit scaling ceilings — hot wallet rows, broker lag, or regional failover complexity appear as QPS grows.</p>`,
    },
    {
      title: "Option B — when it wins",
      body: `<p>The second path optimizes for scale, isolation, or specialized workloads. Higher upfront complexity buys headroom: independent deploy units, partition tolerance, or workload-specific storage engines.</p>
<p>Trade-off: more components to operate, monitor, and debug. Incidents require deeper runbooks and cross-team coordination.</p>`,
    },
    {
      title: "Comparison",
      body: `<p>Evaluate latency (p50 and p99), consistency guarantees, operability, migration cost, and hiring pool. Payment platforms often need strong correctness on the Ledger write path with relaxed consistency on analytics and loyalty projections.</p>
<p>Prototype both paths under realistic parallel charge load before committing — paper comparisons miss tail latency, retry storms, and reconciliation toil.</p>`,
    },
    {
      title: "Decision guide for " + title,
      body: `<p>Choose the simpler option that meets current SLOs. Escalate complexity only when metrics prove failure: duplicate charges, unreconciled settlements, p99 breaches during peak, or ops toil blocking feature velocity.</p>
<p>Regardless of choice, instrument <b>${title}</b> with metrics, run game-days, and keep rollback documented before any migration.</p>`,
    },
    {
      title: "Interview framing",
      body: `<p>When asked about <b>${title}</b> in an interview, state the constraint first (consistency, latency, ops cost), compare both sides with a concrete example, then commit to a choice and list one downside you accept. Avoid "it depends" without criteria.</p>`,
    },
  ];
}

export function buildSections(title, blurb, track, catId) {
  const archetype = inferArchetype(track, catId, title);
  let sections;
  switch (archetype) {
    case "failure": sections = failureSections(title, blurb, catId); break;
    case "pattern": sections = patternSections(title, blurb, catId, track); break;
    case "tradeoff": sections = tradeoffSections(title, blurb); break;
    case "classic": sections = classicSections(title, blurb, catId); break;
    default:
      if (track === "hld" && catId.startsWith("hld-foundations")) {
        sections = foundationSections(title, blurb);
      } else {
        sections = conceptSections(title, blurb, catId, track);
      }
  }
  return { archetype, sections };
}

export function formatSectionsJs(sections) {
  const items = sections.map((s) => {
    const body = esc(s.body);
    const title = esc(s.title);
    return `    { title: \`${title}\`, body: \`${body}\` }`;
  });
  return `[\n${items.join(",\n")}\n  ]`;
}
