/**
 * Generate interview-grade HLD article sections per topic.
 * Used by rewrite-hld-articles.mjs — not generic production checklists.
 */
import { inferArchetype } from "./article-writer.mjs";

function pick(seed, arr) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

function figureIdFor(catId, archetype) {
  if (archetype === "tradeoff" || catId.startsWith("hld-tradeoffs")) return "comparison";
  if (archetype === "classic" || catId.startsWith("hld-classics")) return "architecture";
  if (catId.includes("data") || catId.includes("architecture")) return "architecture";
  if (catId.includes("theory") && (catId.includes("cap") || catId.includes("consistency"))) return "cap-triangle";
  if (catId.includes("cache")) return "cache-flow";
  return "request-flow";
}

function conceptPlacement(title, catId) {
  const placements = {
    "hld-networking": `<p>On the architecture diagram, <b>${title}</b> sits on the communication path between clients and services — or between services. Label connection type (sync/async), timeout budget, and retry policy on the arrow.</p><p>Show where TLS terminates and whether connections are pooled or per-request. Interviewers often ask how this choice affects tail latency under packet loss.</p>`,
    "hld-blocks": `<p><b>${title}</b> is infrastructure glue: draw it between clients and application tier, or between services and data/queue tiers. Mark whether it is stateful, horizontally scaled, and what fails independently.</p><p>Clarify single point of failure vs HA pair, and what config change requires drain vs hot reload.</p>`,
    "hld-theory": `<p><b>${title}</b> constrains how you draw data flows and consistency boundaries. Interviewers expect you to name which guarantee you sacrifice under partition and why.</p><p>Annotate the diagram with consistency level on each arrow — not every path needs linearizability.</p>`,
    "hld-data": `<p><b>${title}</b> belongs in the persistence/analytics layer. Show read vs write paths, replication, and which queries hit which store.</p><p>Separate OLTP hot path from batch/analytics; mark ETL or CDC if data is copied.</p>`,
    "hld-architecture": `<p><b>${title}</b> shapes service boundaries and event flows. Draw services as boxes; show command vs query paths and async boundaries explicitly.</p><p>Each box should own one write model; cross-box updates go through events or sagas.</p>`,
    "hld-reliability": `<p><b>${title}</b> spans the operational layer — health checks, deploy paths, observability hooks. Frame as design choices that affect architecture, not a post-launch runbook.</p>`,
    "hld-security": `<p><b>${title}</b> wraps trust boundaries: perimeter, service-to-service, and data-at-rest. Draw where tokens are validated and secrets never cross.</p>`,
    "hld-consistency": `<p><b>${title}</b> applies at read/write boundaries between replicas or regions. Mark R/W quorum or session stickiness on the diagram.</p>`,
    "hld-db-scaling": `<p><b>${title}</b> appears at the shard/replica layer. Show partition key, hot spots, and cross-shard paths.</p>`,
    "hld-performance": `<p><b>${title}</b> affects queueing and latency on the critical path — annotate p99 budget and backpressure points.</p>`,
    "hld-cache-strategies": `<p><b>${title}</b> sits between application and origin store. Draw cache hit/miss paths and invalidation triggers.</p>`,
    "hld-rate-limiting": `<p><b>${title}</b> guards ingress or shared resources. Show where tokens are checked relative to load balancer and service.</p>`,
    "hld-messaging-ops": `<p><b>${title}</b> lives in the async pipeline between producers and consumers. Mark DLQ, visibility, and rebalance behavior.</p>`,
    "hld-reliability-patterns": `<p><b>${title}</b> is a client-side or middleware resilience pattern on dependency calls — draw it on the caller side of the arrow.</p>`,
    consistency: `<p><b>${title}</b> applies at replica boundaries. Show read and write paths, staleness budget, and user-visible symptoms when violated.</p>`,
    "prod-eng": `<p><b>${title}</b> protects shared resources under load. Place at gateway edge or co-located with the service — never only in client SDK.</p>`,
  };
  for (const [prefix, text] of Object.entries(placements)) {
    if (catId.startsWith(prefix) || catId === prefix) return text;
  }
  return `<p><b>${title}</b> must appear explicitly on your HLD diagram with inputs, outputs, and failure domain — not as a floating buzzword.</p><p>Name the protocol, data format, and timeout on every arrow touching this component.</p>`;
}

function howItWorks(title, blurb, catId, id) {
  const extras = [
    `<p>Trace one end-to-end request through <b>${title}</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p>`,
    `<p>Define SLIs affected by <b>${title}</b> — latency, availability, error rate — and which dependency failure degrades each.</p>`,
    `<p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p>`,
  ];
  let core = `<p>${blurb}</p>${pick(id, extras)}<p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p>`;
  if (catId.includes("networking") || catId === "consistency") {
    core += `<p>Specify wire protocol, connection lifecycle, head-of-line blocking risks, and whether intermediaries (proxies, LBs) terminate or pass through. State default timeouts and retry idempotency requirements.</p>`;
  } else if (catId.includes("data")) {
    core += `<p>Clarify schema flexibility, query patterns, compaction, and how analytics workloads are isolated from OLTP. Name the partition or sort key that drives locality.</p>`;
  } else if (catId.includes("theory")) {
    core += `<p>State the formal guarantee (linearizable, sequential, causal) and give a concrete failure scenario where violating it hurts users — duplicate charge, lost message, or stale feed.</p>`;
  } else if (catId.includes("security")) {
    core += `<p>Map trust zones: public internet, DMZ, service mesh, data store. Show where authentication ends and authorization begins on every API.</p>`;
  } else if (catId.includes("rate-limiting") || catId === "prod-eng") {
    core += `<p>Explain algorithm behavior under burst vs sustained load, coordination across nodes (central Redis vs local token bucket), and what HTTP status / Retry-After the client receives.</p>`;
  } else if (catId.includes("cache")) {
    core += `<p>Detail read path (cache hit/miss), write path (invalidate vs write-through), and TTL as staleness backstop. What happens on cache cluster partition?</p>`;
  }
  return core;
}

function designDecisions(title, catId, id) {
  return `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>${title}</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
${catId.includes("tradeoffs") || id.includes("vs") ? `<p><b>Interview commit:</b> Pick a side, name one accepted downside, and one metric you would watch to validate the decision in week one.</p>` : ""}`;
}

function interviewPitfalls(title, catId, id) {
  const common = [
    `Treating <b>${title}</b> as a checkbox without explaining where it sits on the diagram.`,
    `Quoting buzzwords without tying them to latency, consistency, or cost constraints.`,
    `Ignoring failure modes — interviewers ask "what breaks first?"`,
    `Skipping capacity math before proposing shards or caches.`,
    `No clear data model or API contract for the component under discussion.`,
  ];
  const catSpecific = {
    "hld-classics": [`Under-scoping requirements (MVP vs scale).`, `No id generation or hot-key strategy.`, `Forgetting async fan-out (notifications, analytics).`],
    "hld-tradeoffs": [`Saying "it depends" without decision criteria.`, `Not comparing operability and migration cost.`, `Ignoring tail latency under load.`],
    "hld-theory": [`Confusing CAP partition scenario with normal operation.`, `Claiming exactly-once without idempotency.`],
    "hld-security": [`Storing secrets in code/repos.`, `Auth without authorization on every path.`],
    "hld-data": [`One database for everything.`, `No plan for backfill or schema migration.`],
    "hld-foundations": [`Jumping to microservices before requirements.`, `No back-of-envelope QPS/storage estimate.`, `Drawing databases before APIs.`],
    "hld-networking": [`Ignoring connection pooling and TLS overhead.`, `Choosing WebSockets when SSE or polling suffices.`],
    consistency: [`Claiming strong consistency everywhere without cost.`, `Not explaining user-visible staleness.`],
    "prod-eng": [`Rate limit only at app — attacker bypasses via direct IP.`, `No burst allowance for legitimate traffic spikes.`],
  };
  let extra = catSpecific[catId] || [];
  if (!extra.length) {
    for (const [k, v] of Object.entries(catSpecific)) {
      if (catId.startsWith(k)) { extra = v; break; }
    }
  }
  const items = [...common, ...extra].slice(0, 7);
  return `<p>What interviewers probe for <b>${title}</b>:</p><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>`;
}

function buildConceptSections(title, blurb, catId, id, archetype) {
  const figId = figureIdFor(catId, archetype);
  return [
    {
      title: `What is ${title}?`,
      body: `<p><b>${title}</b> — ${blurb}</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>${title}</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>`,
    },
    { title: "How it works", figureAfter: figId, body: howItWorks(title, blurb, catId, id) },
    { title: "HLD placement", body: conceptPlacement(title, catId) },
    { title: "Design decisions", body: designDecisions(title, catId, id) },
    { title: "Pitfalls & what interviewers probe", body: interviewPitfalls(title, catId, id) },
  ];
}

function classicRequirements(id, title, blurb) {
  const map = {
    "url-shortener": `<ul><li>Create short URL from long URL; redirect with 301/302.</li><li>Custom aliases (optional); analytics on clicks.</li><li>High read:write ratio (~100:1); low latency redirects (&lt;100ms).</li><li>URLs expire (optional); abuse/spam detection.</li></ul>`,
    "chat-system": `<ul><li>1:1 and group messaging; delivery order per conversation.</li><li>Online presence; read receipts (optional).</li><li>Millions of concurrent connections; message persistence.</li><li>Push notification for offline users.</li></ul>`,
    "news-feed": `<ul><li>Publish posts; fan-out to followers' feeds.</li><li>Timeline ranking; celebrity (high fan-out) handling.</li><li>Read-heavy; eventual consistency acceptable for feed lag.</li></ul>`,
    "notification-system": `<ul><li>Multi-channel: push, email, SMS.</li><li>Template + preference management; rate limits per user.</li><li>At-least-once delivery; idempotent sends.</li></ul>`,
    "payment-system-hld": `<ul><li>Authorize, capture, refund; idempotent payments.</li><li>PCI scope minimization; ledger-grade audit trail.</li><li>Strong consistency on balance; async settlement.</li></ul>`,
    "file-storage-s3": `<ul><li>Upload/download objects; metadata; versioning.</li><li>11 nines durability; multipart for large files.</li><li>Event notifications on object changes.</li></ul>`,
    "video-streaming": `<ul><li>Upload, transcode, adaptive bitrate streaming.</li><li>CDN distribution; resume playback.</li><li>Global latency &lt; 2s start time target.</li></ul>`,
    "search-autocomplete": `<ul><li>Prefix queries; sub-100ms suggestions.</li><li>Ranking by popularity/recency.</li><li>High QPS, small payload.</li></ul>`,
    "leaderboard": `<ul><li>Top-N scores; real-time or near-real-time updates.</li><li>High write rate from game events.</li><li>Tie-breaking; regional boards.</li></ul>`,
    "distributed-cron": `<ul><li>Exactly-once job execution per schedule slot.</li><li>Leader election; failure recovery.</li><li>No duplicate side effects.</li></ul>`,
    "collaborative-editor": `<ul><li>Concurrent edits; low latency sync.</li><li>Conflict resolution (OT/CRDT).</li><li>Offline edits merge on reconnect.</li></ul>`,
    "ride-sharing-dispatch": `<ul><li>Match riders/drivers; ETA; surge pricing.</li><li>Geospatial indexing; real-time location.</li><li>Strong consistency on trip state.</li></ul>`,
    "ticket-booking": `<ul><li>Seat inventory; prevent double booking.</li><li>Hold TTL; payment integration.</li><li>Peak flash-sale traffic.</li></ul>`,
    "rate-limiter-service": `<ul><li>Per-user/API token bucket or sliding window.</li><li>Distributed counters; low latency.</li><li>Sync with API gateway.</li></ul>`,
    "metrics-monitoring-system": `<ul><li>Ingest time-series; downsampling; alerting.</li><li>Cardinality control; long-term storage.</li><li>Query API for dashboards.</li></ul>`,
  };
  return map[id] || `<p>${blurb}</p><p>Enumerate functional requirements, estimate read/write ratio, and state latency/availability targets before drawing components. Call out MVP vs v2 explicitly.</p>`;
}

function classicHld(id, title) {
  const map = {
    "url-shortener": `<p><b>Components:</b> API service, ID generator (base62 / snowflake), redirect service, analytics pipeline, SQL + cache for hot URLs.</p><p><b>Flow:</b> POST long URL → hash or counter ID → store mapping → GET /{id} → cache → 302 to long URL. Use separate read tier for redirects.</p><p><b>Key design choice:</b> counter-based IDs are fast but leak volume; hash-based need collision handling.</p>`,
    "chat-system": `<p><b>Components:</b> WebSocket gateway, chat service, message store (partitioned by conversation_id), presence service, push notification fan-out.</p><p>Clients maintain persistent connection; messages append to per-conversation log; delivery via sync + push for offline users.</p>`,
    "news-feed": `<p><b>Fan-out on write</b> for normal users; <b>fan-out on read</b> for celebrities. Feed cache per user; post store is source of truth. Ranker applies scoring on read path.</p>`,
    "payment-system-hld": `<p><b>Components:</b> API gateway, payment service, ledger DB (strong consistency), idempotency store, outbox → settlement worker, PSP adapter.</p><p>Never double-charge: idempotency key + unique constraint. Async capture/settlement off critical path where possible.</p>`,
    "file-storage-s3": `<p><b>Components:</b> metadata DB, blob store (object nodes), load balancer, background erasure coding/replication. Hash object key → partition. CDN for hot objects.</p>`,
    "video-streaming": `<p>Upload → transcode workers → segment store → CDN edge → client adaptive player. Separate control plane (metadata) from data plane (bytes).</p>`,
    "search-autocomplete": `<p>Trie or prefix index in memory (per shard); aggregator merges top-k. Popular queries cached at edge. Ingest pipeline updates counts asynchronously.</p>`,
    "leaderboard": `<p>Redis sorted sets per board shard; periodic snapshot to DB. Top-N via ZREVRANGE; score updates atomic. Shard by game or region.</p>`,
    "distributed-cron": `<p>Scheduler assigns slot to leader; workers claim jobs with DB lease/lock. Missed fire → next leader picks up; jobs must be idempotent.</p>`,
    "collaborative-editor": `<p>CRDT/OT document model; WebSocket sync; snapshot + op log in DB. Presence channel separate from document channel.</p>`,
    "ride-sharing-dispatch": `<p>Geohash index for drivers; matching service scores candidates; trip state machine; location stream via Kafka; surge as dynamic pricing service.</p>`,
    "ticket-booking": `<p>Seat map in DB with row lock or optimistic version; hold row with TTL; payment confirms booking. Queue for flash sales.</p>`,
    "rate-limiter-service": `<p>Token bucket per key in Redis cluster; local cache + async sync for edge; gateway enforces 429 with Retry-After header.</p>`,
    "notification-system": `<p>Event ingest → router by preference → per-channel workers (push/email/SMS) → delivery log for idempotency. Template service separate.</p>`,
    "metrics-monitoring-system": `<p>Agents push/pull → ingestion with label validation → TSDB shard by time → downsampler → alert evaluator → notification router.</p>`,
  };
  return map[id] || `<p>Draw clients, API layer, primary store, cache, async queue, and external dependencies. Label sync vs async edges and partition keys. Explain the hardest consistency or scale decision aloud.</p>`;
}

function buildClassicSections(title, blurb, catId, id) {
  const figId = figureIdFor(catId, "classic");
  return [
    { title: "Functional requirements", body: classicRequirements(id, title, blurb) },
    {
      title: "Capacity sketch",
      body: `<p>Estimate DAU → peak QPS, storage/day, and fan-out factor. For <b>${title}</b>, identify the dominant cost: bandwidth, storage, or compute.</p>
<p>Example math: 100M URLs/day × 500 bytes ≈ 50GB/day metadata before indexes. State assumptions aloud — interviewers correct wrong math faster than silent guessing.</p>
<p>Call out read:write ratio; it drives cache vs write-optimized store choice.</p>`,
    },
    { title: "High-level design", figureAfter: figId, body: classicHld(id, title) },
    {
      title: "Deep dives",
      body: `<p>Pick 2–3 areas interviewers probe: data model, partitioning, caching, consistency. For <b>${title}</b>, explain id generation, hot keys, and what fails under 10× load.</p>
<p>Prepare one API contract (request/response) and one table schema or object key layout — depth beats breadth.</p>`,
    },
    {
      title: "Bottlenecks and scaling",
      body: `<p>First bottlenecks: DB write ceiling, hot partition, connection limits, or fan-out storms. Mitigate with cache, queue, shard, or read replicas — in that order of simplicity.</p>
<p>Describe horizontal scale path: what is stateless, what is sharded, what must remain centralized.</p>`,
    },
    { title: "Interview pitfalls", body: interviewPitfalls(title, catId, id) },
  ];
}

function splitTradeoff(title) {
  const parts = title.split(/\s+vs\s+/i);
  if (parts.length >= 2) return { a: parts[0].trim(), b: parts.slice(1).join(" vs ").trim() };
  return { a: "Option A", b: "Option B" };
}

function buildTradeoffSections(title, blurb, id) {
  const { a, b } = splitTradeoff(title);
  return [
    {
      title: "The decision",
      body: `<p>${blurb}</p><p>Neither <b>${a}</b> nor <b>${b}</b> wins universally — constraints pick the winner. Open with the business constraint (scale, consistency, team, budget), not the technology name.</p>`,
    },
    {
      title: `${a} — when it wins`,
      body: `<p>Choose <b>${a}</b> when simplicity, strong guarantees, or team familiarity matter more than infinite horizontal scale. Good fit for early stage or strict correctness paths.</p>
<p>List concrete strengths: operability, query flexibility, transaction support, or lower moving parts.</p>`,
    },
    {
      title: `${b} — when it wins`,
      body: `<p>Choose <b>${b}</b> when scale, partition tolerance, or specialized access patterns dominate. Accept higher operational and migration cost.</p>
<p>List concrete strengths: partition tolerance, write throughput, schema flexibility, or geo distribution.</p>`,
    },
    {
      title: "Comparison",
      figureAfter: "comparison",
      body: `<p>Compare latency (p50/p99), consistency, operability, cost, and migration risk. Prototype under realistic load — paper tradeoffs hide tail latency and ops toil.</p>
<p>Use a simple table in the interview: rows = criteria, columns = options, cells = short verdict.</p>`,
    },
    {
      title: `Decision guide for ${title}`,
      body: `<p>Start with the simpler option that meets SLOs. Escalate only when metrics prove pain: p99 breaches, unreconciled data, or ops blocking velocity.</p>
<p>Document the decision in an ADR; revisit when traffic 10× or team doubles.</p>`,
    },
    { title: "Interview framing", body: interviewPitfalls(title, "hld-tradeoffs", id) },
  ];
}

function buildFoundationSections(title, blurb, id) {
  return [
    {
      title: "Framework overview",
      body: `<p>${blurb}</p>
<p>Structured design process: (1) clarify requirements and out-of-scope, (2) back-of-envelope capacity, (3) high-level diagram, (4) deep-dive 2–3 components, (5) tradeoffs and failure modes. This order keeps interviews coherent under time pressure.</p>
<p><b>${title}</b> is the meta-skill — interviewers grade communication and prioritization, not memorized architectures.</p>`,
    },
    {
      title: "How it works in an interview",
      body: `<p>Spend first 5 minutes on requirements — functional, scale, latency, consistency. Next 10 minutes on diagram. Remaining time on deep dives and "what if" probes.</p>
<p>Ask clarifying questions aloud: mobile vs web? global? strong consistency required? write-heavy? These answers change the diagram.</p>`,
    },
    {
      title: "When to apply",
      body: `<p>Use <b>${title}</b> at the start of greenfield designs and major refactors — before picking databases or service counts. Skip heavy process for small bugfixes.</p>
<p>In design reviews, use the same structure so reviewers can follow your reasoning.</p>`,
    },
    {
      title: "Example walkthrough",
      body: `<p>Practice on a classic (URL shortener, feed, chat): state assumptions, draw left-to-right (client → edge → services → data), deep-dive the riskiest box (fan-out, id generation, or consistency), articulate one tradeoff you accept.</p>
<p>Time-box: 45 minutes total simulates a senior loop round.</p>`,
    },
    { title: "Common mistakes", body: interviewPitfalls(title, "hld-foundations", id) },
  ];
}

const SKIP_IDS = new Set(["dns", "reverse-proxy", "cache-aside", "write-through"]);

/** Shallow template markers — must never ship on HLD topics */
export const SHALLOW_HLD_MARKERS = [
  "Option A — when it wins",
  "Option B — when it wins",
  "Treating <b>",
  "Strong answer pattern:</b> requirements → diagram",
  "Example math: 100M URLs/day",
];

export function isShallowHldContent(raw) {
  if (raw.includes("@hld-gold")) return false;
  const hits = SHALLOW_HLD_MARKERS.filter((m) => raw.includes(m)).length;
  const hasPreOrCode = /<(pre|code)>/.test(raw);
  const hasTable = /<table>/.test(raw);
  return hits >= 2 && !hasPreOrCode && !hasTable;
}

export function shouldSkipHldRewrite(id, raw, force = false) {
  if (SKIP_IDS.has(id)) return true;
  if (raw.includes("@hld-gold")) return true;
  if (force) return false;
  if (raw.includes("Pitfalls & what interviewers probe") && !raw.includes("Correlate logs with payment_id")) return true;
  if (raw.includes("Interview pitfalls") && !raw.includes("Correlate logs with payment_id")) return true;
  if (raw.includes("Interview framing") && !raw.includes("Correlate logs with payment_id")) return true;
  return false;
}

export function buildHldSections({ id, title, blurb, catId, archetype: archetypeIn }) {
  const archetype = archetypeIn || inferArchetype("hld", catId, title);
  let sections;
  if (archetype === "classic" || catId.startsWith("hld-classics")) {
    sections = buildClassicSections(title, blurb, catId, id);
  } else if (archetype === "tradeoff" || catId.startsWith("hld-tradeoffs")) {
    sections = buildTradeoffSections(title, blurb, id);
  } else if (catId.startsWith("hld-foundations")) {
    sections = buildFoundationSections(title, blurb, id);
  } else {
    sections = buildConceptSections(title, blurb, catId, id, archetype);
  }
  return { archetype, sections };
}

export function formatHldSectionsJs(sections) {
  const esc = (s) => (s || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  const items = sections.map((s) => {
    const fig = s.figureAfter ? `, figureAfter: "${s.figureAfter}"` : "";
    return `    { title: \`${esc(s.title)}\`, body: \`${esc(s.body)}\`${fig} }`;
  });
  return `[\n${items.join(",\n")}\n  ]`;
}
