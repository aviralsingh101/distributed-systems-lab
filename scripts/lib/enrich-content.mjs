/**
 * Generates educator-style content for a topic from registry metadata.
 * Used by apply-enrichment.mjs — synthesizes track-specific depth.
 */

const FORBIDDEN = [
  "payment platform hits limits",
  "gives a proven structure for the Wallet",
  "Addresses a real gap that naive designs miss",
];

export function wordCount(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function lens(track, catId) {
  if (track === "hld") return "architecture";
  if (track === "lld") return "implementation";
  return "failure-mode";
}

function distinction(title, track) {
  const t = title.toLowerCase();
  if (t.includes("proxy")) return "Unlike a forward proxy (client-side), this sits on the server side.";
  if (t.includes("outbox")) return "Distinct from naive publish-after-commit and from 2PC across DB and broker.";
  if (t.includes("saga")) return "Not the same as 2PC — compensating transactions instead of blocking locks.";
  if (t.includes("cache")) return "Unlike CDN edge caching, this is application-layer — you own invalidation when Wallet balance changes.";
  if (t.includes("singleton")) return "Unlike global static state, Singleton scopes one instance per classloader or DI container.";
  if (t.includes("factory")) return "Unlike Builder, Factory varies object families rather than step-by-step construction.";
  if (track === "hld") return `Unlike adjacent ingress components, <b>${title}</b> has a specific seat in the request path — do not conflate with unrelated building blocks.`;
  if (track === "lld") return `Unlike a plain service class, <b>${title}</b> is a named pattern with structure you can point to in code review.`;
  return `Unlike superficially similar bugs, <b>${title}</b> has distinct symptoms, repro steps, and fixes.`;
}

function expertInsight(title, track) {
  const t = title.toLowerCase();
  if (t.includes("redis") || t.includes("lock")) return "Fence tokens or monotonic lock values prevent stale lock holders from writing after GC pause.";
  if (t.includes("kafka") || t.includes("queue")) return "Consumer lag SLO should alert before disk retention deletes unconsumed segments.";
  if (t.includes("cache")) return "Thundering herd on TTL expiry — stagger TTLs or use single-flight refresh.";
  if (t.includes("hash")) return "Virtual nodes reduce remapping when cluster membership changes — typically 100–200 vnodes per physical node.";
  if (t.includes("cap") || t.includes("consistency")) return "PACELC: same CAP tradeoff but explicit about latency when partitions are absent.";
  if (track === "lld") return "Unit-test the pattern in isolation with fakes — integration tests catch wiring mistakes the pattern cannot fix.";
  if (track === "hld") return "Run game-day drills on the failure mode this component is meant to absorb — config drift shows up under stress.";
  return "Default isolation (Read Committed) does not prevent this — explicit design or stronger isolation is required.";
}

export function richTradeoffs(title, track, blurb) {
  const t = title;
  return {
    pros: [
      `<b>${t}</b> addresses ${blurb.toLowerCase().replace(/\.$/, "")} with a well-understood industry approach.`,
      "Fits the payment platform: clearer boundaries between Wallet, Order, Gateway, Queue, and Ledger.",
      track === "hld"
        ? "Scales operationally — deploy, monitor, and replace components independently at the ingress/data layer."
        : track === "lld"
          ? "Maps cleanly to code review and testing — structure is visible in PRs and unit tests."
          : "Makes the failure mode reproducible in tests and preventable in production configs.",
      "Documented in vendor guides and battle-tested at high QPS — not experimental.",
    ],
    cons: [
      "Adds moving parts — another component, table, or discipline the team must operate.",
      "Misapplied pattern is worse than simpler alternative — verify the problem exists at your scale.",
      "Observability and runbooks required — without metrics, issues surface only in customer tickets.",
      track === "hld" ? "Cross-team alignment cost — API contracts and ownership boundaries must be explicit." : "Learning curve for junior engineers — patterns hide complexity until incidents.",
    ],
    whenToUse: [
      `The requirement matches what <b>${t}</b> was designed for (see problem section).`,
      "Simpler alternatives are failing SLOs, causing incidents, or blocking scale.",
      "Team has capacity to operate, monitor, and on-call the added complexity.",
    ],
    whenNotToUse: [
      "Early MVP with low traffic — solve the immediate bottleneck first (YAGNI).",
      `Team lacks experience operating ${t} safely in production.`,
      "Requirements demand a simpler synchronous design that still meets latency and consistency needs.",
    ],
  };
}

export function buildPlainEnglish(title, blurb, track, catId) {
  const L = lens(track, catId);
  const dist = distinction(title, track);
  const expert = expertInsight(title, track);
  const placement =
    track === "hld"
      ? `In the payment platform topology, <b>${title}</b> typically sits between Client/Order and shared infrastructure (Gateway, Ledger, Queue) — draw it on the request path or data path, not as an afterthought.`
      : track === "lld"
        ? `In Order Service code, <b>${title}</b> shapes packages, classes, and transaction boundaries — it should be obvious in a sequence diagram from HTTP handler to DB/queue.`
        : `In production, <b>${title}</b> shows up as a specific bug class during concurrent charges, retries, or failover — not as abstract theory.`;

  return `<p><b>${title}</b> — ${blurb} This page explains what it is, how it works in a real stack, and what breaks if you ignore it.</p>
<p>${placement}</p>
<p>${dist}</p>
<p>Engineers with general backend experience may know the name but not the operational details: defaults, config flags, interaction with Postgres/Kafka/nginx, and what monitoring to add. The sections below go deep enough that you should learn at least one new concrete fact — a timeout default, an isolation-level interaction, a relay failure mode, or a header you must set at the proxy.</p>
<p>When reviewing a design doc or PR, ask: where does <b>${title}</b> sit on the diagram? What happens during deploy, broker restart, or replica lag? Who owns on-call for this layer? What metric proves it is healthy vs merely present?</p>
<div class="callout"><p><b>Expert insight:</b> ${expert}</p></div>
<p>We use the payment cast throughout: Client pays via Order Service, Gateway settles, Ledger records, Event Queue notifies Wallet and analytics. Every example ties back to that flow so you can map the concept to a system you already understand.</p>
<p><b>How to read this page:</b> Overview orients you; How it works goes into protocols and config; Problem/Solution show the failure and fix; Tradeoffs help you decide; the interactive diagram lets you toggle the pattern and adjust parameters.</p>
<p><b>Category context (${catId}):</b> This topic belongs to the ${catId.replace(/-/g, " ")} category — connect it to neighboring concepts in the sidebar when planning a full payment-platform architecture review.</p>
<p><b>Prerequisites:</b> You should be comfortable reading sequence diagrams, SQL transactions, and HTTP status codes. We do not re-teach REST or SQL basics — we focus on what is specific to <b>${title}</b> in a production payment stack.</p>
<p><b>Outcomes:</b> After this page you should explain <b>${title}</b> in a design review, spot misapplication in a PR, and know which metric or test proves it is working — not just that the component exists in the diagram.</p>`;
}

function topicDeepDive(title, track) {
  const t = title.toLowerCase();
  if (t.includes("outbox") || t.includes("inbox") || t.includes("saga"))
    return `<p><b>Message reliability:</b> At-least-once delivery implies idempotent consumers and dedup keys on <code>payment_id</code>. Monitor outbox depth and consumer lag as paired metrics — fixing only one side hides backpressure.</p>`;
  if (t.includes("cache") || t.includes("cdn"))
    return `<p><b>Cache semantics:</b> Define TTL per object type; use cache-aside with stampede protection; invalidate on Wallet balance mutation events. Stale reads acceptable only where business rules explicitly allow eventual consistency.</p>`;
  if (t.includes("lock") || t.includes("deadlock") || t.includes("optimistic") || t.includes("pessimistic"))
    return `<p><b>Locking discipline:</b> Acquire locks in global order (Wallet id, then Order id) to prevent deadlock. Keep hold time minimal — no external HTTP inside locked sections. Log lock wait time p99.</p>`;
  if (t.includes("kafka") || t.includes("queue") || t.includes("partition"))
    return `<p><b>Broker ops:</b> Partition count is hard to change — plan for peak publish rate and retention. Use keys aligned to <code>wallet_id</code> only when ordering per wallet is required; otherwise round-robin for even load.</p>`;
  if (track === "hld")
    return `<p><b>Architecture review:</b> Draw <b>${title}</b> on the request and data path; mark single points of failure; document RTO/RPO if this component fails; list dependencies (DNS, certs, service mesh) that must be healthy first.</p>`;
  if (track === "lld")
    return `<p><b>Implementation review:</b> Map <b>${title}</b> to packages and modules; ensure test doubles exist for I/O boundaries; verify errors propagate as stable API codes, not stack traces to clients.</p>`;
  return `<p><b>Production checklist for ${title}:</b> Reproduce under parallel load; add metric and alert; document runbook entry; train on-call; link to related topics in this track before closing the incident postmortem.</p>`;
}

export function buildTechnical(title, blurb, track, catId) {
  const mechanics =
    track === "hld"
      ? `<p><b>Request/data path:</b> Client → ingress (<code>pay.api.com</code>) → Order Service → Gateway callback → Ledger commit → optional async publish. <b>${title}</b> affects where you terminate TLS, shard traffic, cache responses, or enforce rate limits.</p>
<p><b>Configuration surface:</b> nginx/Envoy <code>upstream</code> blocks, K8s Ingress annotations, AWS ALB target groups, or managed service quotas. Health checks (HTTP <code>/health</code>, TCP, or gRPC) determine which backends receive traffic during deploys.</p>
<p><b>Failure behavior:</b> When misconfigured or overloaded, expect elevated 5xx at the hop, timeout cascades to clients, or stale reads from replicas. Trace with <code>X-Request-ID</code> across hops; compare p50 vs p99 — tail latency often reveals missing timeouts or buffer limits.</p>
<p><b>Capacity planning:</b> Peak QPS × payload bytes × replication factor for bandwidth; connection pool sizing = concurrent requests × upstream fan-out. Scale horizontally when CPU on the data plane exceeds ~60% sustained or p99 latency breaches SLO for 15+ minutes.</p>
<p><b>Deploy &amp; drain:</b> Rolling updates should mark backends unhealthy before removal (<code>nginx -s reload</code>, K8s <code>preStop</code> hook). In-flight Gateway callbacks may exceed default 60s — tune <code>proxy_read_timeout</code> before go-live.</p>`
      : track === "lld"
        ? `<p><b>Code structure:</b> Handlers stay thin; domain logic owns invariants. <b>${title}</b> introduces explicit types/interfaces — repository ports, outbox table, strategy factory — so tests substitute fakes without Postgres or Kafka.</p>
<p><b>Transaction boundaries:</b> One <code>@Transactional</code> per use-case. DB writes and outbox inserts share a transaction; broker publish is async via relay. Idempotency keys on <code>POST /pay</code> with unique index <code>(idempotency_key)</code>.</p>
<p><b>Schema &amp; migrations:</b> Flyway/Liquibase — nullable columns first, backfill, then NOT NULL. Optimistic locking: <code>version INT</code> with <code>WHERE id = ? AND version = ?</code>.</p>
<p><b>Testing pyramid:</b> Unit tests for pattern classes; Testcontainers for integration; Pact for event contracts. Chaos tests: kill relay, verify outbox drains without duplicate Wallet credits.</p>
<p><b>Code review checklist:</b> No business logic in controllers; errors mapped to stable API codes; no blocking broker calls inside DB transactions; structured logging with correlation IDs.</p>
<p><b>API surface:</b> Version public DTOs; hide domain entities; map errors to RFC 7807 problem+json. Keep pattern classes free of framework annotations where possible for testability.</p>
<p><b>Dependency injection:</b> Wire pattern implementations via interfaces — swap fakes in unit tests, real adapters in integration tests.</p>`
        : `<p><b>Mechanism:</b> Under <b>Read Committed</b>, the anomaly appears when sessions interleave read-modify-write without <code>FOR UPDATE</code>, version check, or atomic SQL update.</p>
<p><b>Detection:</b> Balance drift in reconciliation; duplicate <code>charge_id</code> attempts; ORM <code>OptimisticLockException</code>; Postgres <code>40001</code> on Serializable.</p>
<p><b>Mitigation matrix:</b> Low contention → atomic <code>UPDATE x = x + ?</code>; user-facing edits → optimistic version; hot rows → pessimistic <code>FOR UPDATE</code> with short transactions.</p>
<p><b>Postgres toolkit:</b> <code>FOR UPDATE SKIP LOCKED</code> for job queues; advisory locks for cross-table invariants; <code>SERIALIZABLE</code> for rare critical sections accepting abort/retry.</p>
<p><b>Load testing:</b> Gatling/k6 parallel wallet top-ups; assert final balance invariant; measure conflict rate vs retry policy.</p>
<p><b>TOCTOU / timing:</b> Separate check and act with no lock between — classic filesystem or auth-token validation race; fix by acting inside the same transaction or lock as the check.</p>
<p><b>Application layer:</b> Spring <code>@Transactional</code> boundary must include both check and write; HTTP-level idempotency does not fix DB-level RMW races.</p>`;

  return `${mechanics}
<p><b>Observability:</b> Dashboards: error rate, p99 latency, saturation, consumer/replica/outbox lag. SLO burn alerts. Logs with <code>payment_id</code>, <code>wallet_id</code>, <code>trace_id</code> on every hop.</p>
<p><b>Runbooks:</b> Failover steps, key rotation, event replay limits, reconciliation against Gateway settlement files. Game-day: AZ failure, broker restart, replica promotion.</p>
<p><b>Security:</b> TLS everywhere; no PAN in app logs; tokenize at Gateway; audit admin APIs that trigger <b>${title}</b>-related config changes.</p>
<p><b>Performance:</b> Flame graphs on Order Service; <code>EXPLAIN ANALYZE</code> on Ledger hot queries; broker lag vs publish throughput before adding shards.</p>
<p><b>Migration:</b> Feature flags; shadow traffic; one-week metric comparison; documented rollback owner and data repair script.</p>
<p><b>Interview depth:</b> Be ready to whiteboard the payment flow with <b>${title}</b> highlighted, state failure modes, and quantify trade-offs (latency ms, ops hours/month, consistency window).</p>
<p><b>Common mistakes:</b> Applying <b>${title}</b> without measuring the problem first; missing idempotency on retries; ignoring p99 tail latency; operating without dashboards; skipping game-days until production incident.</p>
<p><b>Tooling:</b> OpenTelemetry traces across Order→Gateway→Ledger; Grafana dashboards; PagerDuty on SLO burn; feature flags (LaunchDarkly/Unleash) for safe rollout of behavior tied to ${title}.</p>
${topicDeepDive(title, track)}`;
}

export function buildProblem(title, track) {
  return `<p>Without deliberate use of <b>${title}</b>, the payment platform exhibits concrete symptoms: duplicate charges, stale wallet balances, timeout storms during Gateway callbacks, or queue lag that breaches SLA. Incidents cluster around deploy windows, retry storms, or hot-key contention on popular merchants.</p>
<p>Root cause is often "worked on my laptop" — low concurrency hides lost updates, missing idempotency, or proxy bypass. Production forces parallel requests, partial failures, and clock skew.</p>`;
}

export function buildSolution(title, track, blurb) {
  return `<p>Apply <b>${title}</b> at the correct layer: ${track === "hld" ? "ingress, data, or cross-service contract" : track === "lld" ? "class, table, and message flow" : "transaction boundary and retry policy"}. ${blurb}</p>
<p>Implementation checklist: (1) define ownership — which service owns the data; (2) document failure modes and idempotency; (3) add metrics before launch; (4) game-day the rollback path. Ship behind feature flag if behavior change is risky.</p>`;
}

export function buildAfter(title) {
  return `<p>With <b>${title}</b> in place, the payment flow degrades predictably under load — retries are safe, deploys don't pin clients to dead pods, and support can trace requests end-to-end. Cost is operational complexity and sometimes added latency; monitor whether the pattern still earns its keep quarterly.</p>`;
}

export function buildExample(title, track) {
  return `<p>Client initiates <code>POST /v1/charge</code> → Order Service validates wallet → Gateway authorizes → Ledger records debit/credit. <b>${title}</b> ${track === "hld" ? "sits on the architecture diagram where traffic or data crosses a trust/scale boundary" : track === "lld" ? "appears in the code path as the structure that keeps DB and queue consistent" : "is the bug you prevent or the fix you apply when two workers touch the same wallet row"}. Toggle the simulation to see behavior with and without the pattern applied.</p>`;
}

export function richContent(topic, track, catId) {
  const { title, blurb } = topic;
  return {
    oneliner: topic.blurb || blurb,
    plainEnglish: buildPlainEnglish(title, blurb, track, catId),
    technical: buildTechnical(title, blurb, track, catId),
    problem: buildProblem(title, track),
    solution: buildSolution(title, track, blurb),
    tradeoffs: richTradeoffs(title, track, blurb),
    after: buildAfter(title),
    example: buildExample(title, track),
    related: topic.related || [],
  };
}

export function hasForbidden(text) {
  const low = (text || "").toLowerCase();
  return FORBIDDEN.some((p) => low.includes(p.toLowerCase()));
}

export { esc, FORBIDDEN };
