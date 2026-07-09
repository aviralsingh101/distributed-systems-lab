/**
 * Factory builders for per-topic lab configs (clickFlow, state, algorithm, race, metrics, queue).
 */
import { C, withAlpha } from "../primitives.js";
import { METRICS_LAYOUT, layoutRow, layoutStates } from "./layout.js";
import { getMetricsMode } from "./metricsModes.mjs";

function titleCase(slug) {
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const clientSvcDb = (title, svcTitle, storeTitle = "Store") => {
  const slots = layoutRow(3, { y: 240, w: 130, h: 56, margin: 70 });
  return {
    components: [
      { id: "client", ...slots[0], title: "Client", color: C.client },
      { id: "svc", ...slots[1], title: svcTitle || title, color: C.service },
      { id: "db", ...slots[2], title: storeTitle, color: C.ledger, kind: "db" },
    ],
  };
};

function cacheFlowConfig(id, title, { hitLabel, missLabel, hitStatus, missStatus, warmKey = "warmCache", writeMode = false }) {
  const flowKey = writeMode ? "write" : "read";
  return {
    note: `${title}: ${writeMode ? "write" : "read"} key — toggle cache state to see hit vs miss path.`,
    toggles: [{ key: warmKey, label: writeMode ? "Key cached (dirty)" : "Key in cache", kind: "ok", value: false }],
    components: [
      { id: "app", x: 100, y: 250, title: "App", color: C.client },
      { id: "cache", x: 350, y: 200, title: "Cache", color: C.accent },
      { id: "db", x: 350, y: 320, title: "DB", color: C.ledger, kind: "db" },
    ],
    initialValues: { cache: "empty", db: "user:42" },
    actions: [{
      id: "read",
      label: writeMode ? "Write key" : "Read key",
      primary: true,
      flowKey,
      onClick(ctx) {
        ctx.state.hit = !!ctx.toggles[warmKey];
        ctx.state.lastTarget = ctx.toggles[warmKey] ? "cache" : "db";
      },
    }],
    flows: {
      read: (ctx) => (ctx.toggles[warmKey]
        ? [{ from: "app", to: "cache", set: { cache: hitLabel } }]
        : [
          { from: "app", to: "cache", color: C.warn, set: { cache: "MISS" } },
          { from: "cache", to: "db", set: { db: missLabel, cache: id.startsWith("write") ? "invalidated" : "populated" } },
        ]),
      write: (ctx) => (ctx.toggles[warmKey]
        ? [
          { from: "app", to: "cache", set: { cache: hitLabel } },
          { from: "app", to: "db", set: { db: missLabel } },
        ]
        : [{ from: "app", to: "db", set: { db: missLabel, cache: "bypassed" } }]),
    },
    status: (ctx) => ({
      text: ctx.state.lastTarget === "cache" ? hitStatus : missStatus,
      cls: ctx.state.lastTarget === "cache" ? "ok" : "warn",
    }),
  };
}

const LOST_UPDATE_STEPS = [
  { id: "t1r", worker: "T1", action: "read", value: "100" },
  { id: "t2r", worker: "T2", action: "read", value: "100" },
  { id: "t1w", worker: "T1", action: "write", value: "120" },
  { id: "t2w", worker: "T2", action: "write", value: "130", stale: true },
];

const LOCK_STEPS = {
  "redis-lock": [
    { id: "a1", worker: "A", action: "acquire", value: "A" },
    { id: "b1", worker: "B", action: "wait", value: "A" },
    { id: "a2", worker: "A", action: "work", value: "hold" },
    { id: "a3", worker: "A", action: "release", value: "A" },
    { id: "b2", worker: "B", action: "acquire", value: "A" },
  ],
  redlock: [
    { id: "r1", worker: "Client", action: "SET", value: "R1" },
    { id: "r2", worker: "Client", action: "SET", value: "R2" },
    { id: "r3", worker: "Client", action: "SET", value: "R3" },
    { id: "r4", worker: "Client", action: "SET", value: "R4" },
    { id: "r5", worker: "Client", action: "SET", value: "R5" },
    { id: "quorum", worker: "Client", action: "quorum", value: "3/5" },
    { id: "work", worker: "Client", action: "work", value: "hold" },
    { id: "rel", worker: "Client", action: "unlock", value: "all" },
  ],
  deadlock: [
    { id: "t1l", worker: "T1", action: "lock", value: "A" },
    { id: "t2l", worker: "T2", action: "lock", value: "B" },
    { id: "t1w", worker: "T1", action: "wait", value: "B", stale: true },
    { id: "t2w", worker: "T2", action: "wait", value: "A", stale: true },
  ],
  "lock-contention": [
    { id: "t1l", worker: "T1", action: "lock", value: "hot" },
    { id: "t2w", worker: "T2", action: "wait", value: "hot" },
    { id: "t3w", worker: "T3", action: "wait", value: "hot" },
    { id: "t1r", worker: "T1", action: "release", value: "hot" },
    { id: "t2l", worker: "T2", action: "lock", value: "hot" },
  ],
  "lock-convoy": [
    { id: "t1l", worker: "T1", action: "lock", value: "mutex" },
    { id: "t2w", worker: "T2", action: "wait", value: "mutex" },
    { id: "t3w", worker: "T3", action: "wait", value: "mutex" },
    { id: "t1r", worker: "T1", action: "release", value: "mutex" },
    { id: "t2l", worker: "T2", action: "lock", value: "mutex" },
    { id: "t3w2", worker: "T3", action: "wait", value: "mutex", stale: true },
  ],
  "priority-inversion": [
    { id: "lowl", worker: "Low", action: "lock", value: "bus" },
    { id: "highw", worker: "High", action: "wait", value: "bus", stale: true },
    { id: "medl", worker: "Med", action: "lock", value: "cpu" },
    { id: "loww", worker: "Low", action: "wait", value: "cpu" },
  ],
  livelock: [
    { id: "a1", worker: "A", action: "try", value: "yield" },
    { id: "b1", worker: "B", action: "try", value: "yield" },
    { id: "a2", worker: "A", action: "try", value: "yield" },
    { id: "b2", worker: "B", action: "try", value: "yield", stale: true },
  ],
  starvation: [
    { id: "h1", worker: "High", action: "acquire", value: "cpu" },
    { id: "h2", worker: "High", action: "acquire", value: "cpu" },
    { id: "h3", worker: "High", action: "acquire", value: "cpu" },
    { id: "lw", worker: "Low", action: "wait", value: "cpu", stale: true },
  ],
  "zookeeper-lock": [
    { id: "c1", worker: "C1", action: "create", value: "seq-001" },
    { id: "c2", worker: "C2", action: "create", value: "seq-002" },
    { id: "w1", worker: "C2", action: "watch", value: "seq-001" },
    { id: "rel", worker: "C1", action: "delete", value: "seq-001" },
    { id: "acq", worker: "C2", action: "acquire", value: "seq-002" },
  ],
  "etcd-lease": [
    { id: "grant", worker: "Client", action: "grant", value: "TTL=10s" },
    { id: "put", worker: "Client", action: "put", value: "key=leader" },
    { id: "keep", worker: "Client", action: "keepalive", value: "refresh" },
    { id: "expire", worker: "Client", action: "expire", value: "revoked", stale: true },
  ],
  "lease-expiration": [
    { id: "hold", worker: "Primary", action: "hold", value: "lease ok" },
    { id: "ttl", worker: "Clock", action: "tick", value: "TTL elapsed" },
    { id: "stale", worker: "Primary", action: "write", value: "stale", stale: true },
    { id: "new", worker: "NewPrimary", action: "acquire", value: "lease ok" },
  ],
  "fencing-tokens": [
    { id: "old", worker: "OldPrimary", action: "write", value: "token=5", stale: true },
    { id: "fence", worker: "Storage", action: "reject", value: "token stale" },
    { id: "new", worker: "NewPrimary", action: "write", value: "token=6" },
    { id: "ok", worker: "Storage", action: "accept", value: "token=6" },
  ],
};

function raceStepsFor(topicId, title) {
  if (LOCK_STEPS[topicId]) {
    const lockTopics = new Set(["deadlock", "lock-contention", "lock-convoy", "priority-inversion", "livelock", "starvation", "redis-lock"]);
    const resourceMap = {
      deadlock: ["A", "B"],
      "lock-contention": ["hot"],
      "lock-convoy": ["mutex"],
      "priority-inversion": ["bus", "cpu"],
      starvation: ["cpu"],
      "redis-lock": ["A"],
    };
    return {
      mode: lockTopics.has(topicId) ? "locks" : undefined,
      resources: resourceMap[topicId],
      steps: LOCK_STEPS[topicId],
      resourceLabel: topicId === "redlock" ? "Redis nodes" : topicId.includes("lease") || topicId === "fencing-tokens" ? "Lease / storage" : "Locks",
      failMessage: `${title} — ${topicId === "deadlock" ? "circular wait" : topicId === "redlock" ? "quorum lock acquired" : topicId === "fencing-tokens" ? "stale primary fenced out" : topicId === "lease-expiration" ? "lease expired — stale write rejected" : "race condition demonstrated"}`,
      failBadge: topicId === "fencing-tokens" ? "Fenced — token too old" : topicId === "lease-expiration" ? "Lease expired — write rejected" : topicId === "starvation" ? "Low priority starved" : topicId === "livelock" ? "Livelock — no progress" : undefined,
    };
  }
  if (topicId === "aba") {
    return {
      steps: [
        { id: "pop", worker: "T1", action: "pop", value: "A" },
        { id: "swap", worker: "T2", action: "push/pop", value: "A→B→A" },
        { id: "cas", worker: "T1", action: "CAS", value: "A", stale: true },
      ],
      resourceLabel: "Lock-free stack",
      failMessage: "ABA problem — pointer looked unchanged but structure changed",
      failBadge: "CAS succeeded on recycled node — unsafe",
    };
  }
  if (topicId === "double-spend") {
    return {
      steps: [
        { id: "t1r", worker: "T1", action: "read", value: "$100" },
        { id: "t2r", worker: "T2", action: "read", value: "$100" },
        { id: "t1w", worker: "T1", action: "spend", value: "$80" },
        { id: "t2w", worker: "T2", action: "spend", value: "$90", stale: true },
      ],
      resourceLabel: "Account balance",
      initialBalance: 100,
      expectedBalance: 100,
      failMessage: "Double spend — both transactions committed on same balance",
      failBadge: "Balance should be $10, got -$70",
    };
  }
  if (topicId === "write-skew") {
    return {
      steps: [
        { id: "t1r", worker: "Dr A", action: "read", value: "on-call=yes" },
        { id: "t2r", worker: "Dr B", action: "read", value: "on-call=yes" },
        { id: "t1w", worker: "Dr A", action: "off", value: "off" },
        { id: "t2w", worker: "Dr B", action: "off", value: "off", stale: true },
      ],
      resourceLabel: "On-call constraint",
      initialBalance: 2,
      expectedBalance: 1,
      failMessage: "Write skew — both doctors off duty, constraint violated",
      failBadge: "0 doctors on call — invariant broken",
    };
  }
  if (topicId === "dirty-read") {
    return {
      steps: [
        { id: "t1w", worker: "T1", action: "write", value: "uncommitted" },
        { id: "t2r", worker: "T2", action: "read", value: "dirty", stale: true },
        { id: "t1a", worker: "T1", action: "rollback", value: "aborted" },
      ],
      resourceLabel: "Row",
      failMessage: "Dirty read — T2 saw uncommitted data",
    };
  }
  if (topicId === "phantom-read") {
    return {
      steps: [
        { id: "t1r", worker: "T1", action: "scan", value: "rows=3" },
        { id: "t2i", worker: "T2", action: "insert", value: "row4" },
        { id: "t1r2", worker: "T1", action: "re-scan", value: "rows=4", stale: true },
      ],
      resourceLabel: "Table range",
      failMessage: "Phantom read — new row appeared in T1's range",
    };
  }
  if (topicId === "non-repeatable-read") {
    return {
      steps: [
        { id: "t1r", worker: "T1", action: "read", value: "v=10" },
        { id: "t2w", worker: "T2", action: "write", value: "v=20" },
        { id: "t1r2", worker: "T1", action: "re-read", value: "v=20", stale: true },
      ],
      resourceLabel: "Row",
      failMessage: "Non-repeatable read — value changed between reads",
    };
  }
  if (topicId === "read-skew") {
    return {
      steps: [
        { id: "t1r1", worker: "T1", action: "read", value: "A=100" },
        { id: "t1r2", worker: "T1", action: "read", value: "B=100" },
        { id: "t2w", worker: "T2", action: "transfer", value: "A→B" },
        { id: "t1sum", worker: "T1", action: "sum", value: "200≠150", stale: true },
      ],
      resourceLabel: "Accounts A+B",
      failMessage: "Read skew — inconsistent snapshot across rows",
    };
  }
  if (topicId === "idempotency-key" || topicId === "deduplication") {
    return {
      steps: [
        { id: "req1", worker: "C1", action: "POST", value: "id=abc" },
        { id: "req2", worker: "C2", action: "retry", value: "id=abc" },
        { id: "dedup", worker: "API", action: "dedupe", value: "cached", stale: false },
      ],
      resourceLabel: "Idempotency store",
      failMessage: `${title} — duplicate side effect prevented`,
    };
  }
  if (topicId === "exactly-once") {
    return {
      steps: [
        { id: "send", worker: "P", action: "produce", value: "evt" },
        { id: "ack", worker: "B", action: "process", value: "once" },
        { id: "retry", worker: "P", action: "redeliver", value: "skip", stale: true },
      ],
      resourceLabel: "Consumer offset",
      failMessage: "Exactly-once — redelivery deduplicated",
    };
  }
  return {
    steps: LOST_UPDATE_STEPS,
    resourceLabel: topicId.includes("lock") ? "Lock row" : "Shared row",
    failMessage: `${title} — stale write or race detected`,
  };
}

export function buildMetricsConfig(topicId, title) {
  const herdCapacityDefault = Math.max(12, Math.floor(METRICS_LAYOUT.bucket.w / 12));
  const herdRefillDefault = Math.max(1, Math.floor(METRICS_LAYOUT.dropped.h / 30));
  const stampedeCapacityDefault = Math.max(10, Math.floor(METRICS_LAYOUT.bucket.h / 8));
  const stampedeRefillDefault = Math.max(1, Math.floor(METRICS_LAYOUT.dropped.h / 36));
  const stampedeVisualHint = METRICS_LAYOUT.bucket.x < METRICS_LAYOUT.accepted.x
    ? "Watch the left cache budget, right counters, and bottom chart."
    : "Watch the right cache budget, left counters, and bottom chart.";

  const OVERRIDES = {
    "retry-storm": {
      note: "Retries amplify load. Burst traffic triggers cascading retries.",
      burstLabel: "Retry wave",
      capacityLabel: "Backend capacity",
      refillLabel: "Recovery rate",
      bucketLabel: "Retry budget",
      acceptedLabel: "SERVED",
      droppedLabel: "THROTTLED",
      acceptedSeriesLabel: "Served req/s",
      droppedSeriesLabel: "Throttled req/s",
      chartTitle: "Retry outcomes (req/s)",
    },
    "thundering-herd": {
      note: "Many clients wake at once. Burst simulates stampede on cold cache.",
      burstLabel: "Thundering herd",
      capacityDefault: herdCapacityDefault,
      refillDefault: herdRefillDefault,
    },
    "cache-stampede": {
      note: `Cache miss causes parallel origin fetches. ${stampedeVisualHint}`,
      burstLabel: "Stampede on miss",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Origin capacity",
      refillLabel: "Cache refill",
      bucketLabel: "Miss budget",
      acceptedLabel: "SERVED",
      droppedLabel: "MISSED",
      sendActionLabel: "Cache miss",
      acceptedSeriesLabel: "Served req/s",
      droppedSeriesLabel: "Missed req/s",
      chartTitle: "Cache stampede pressure (req/s)",
      droppedAlertLabel: "ORIGIN OVERLOAD — PARALLEL FETCHES",
      fanoutHint: "Many clients → parallel origin fetch",
      fanoutNodePrefix: "C",
    },
    dogpile: {
      note: `Many workers detect the same cache miss and fetch origin in parallel. ${stampedeVisualHint}`,
      burstLabel: "Dogpile on miss",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Origin capacity",
      refillLabel: "Cache refill",
      bucketLabel: "Origin fetch budget",
      acceptedLabel: "FETCHED",
      droppedLabel: "OVERLOAD",
      sendActionLabel: "Cache miss",
      acceptedSeriesLabel: "Origin fetches/s",
      droppedSeriesLabel: "Overloaded req/s",
      chartTitle: "Dogpile origin pressure (req/s)",
      droppedAlertLabel: "ORIGIN OVERLOAD — PARALLEL FETCHES",
      fanoutHint: "Many workers → parallel origin fetch",
      fanoutNodePrefix: "W",
    },
    "hot-key": {
      note: `One viral key lands on a single cache shard — millions of reads saturate it while other shards idle. ${stampedeVisualHint}`,
      burstLabel: "Viral key traffic",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Hot shard capacity",
      refillLabel: "Replica refill",
      bucketLabel: "Shard budget",
      acceptedLabel: "SERVED",
      droppedLabel: "REJECTED",
      sendActionLabel: "Read hot key",
      acceptedSeriesLabel: "Served reads/s",
      droppedSeriesLabel: "Rejected reads/s",
      chartTitle: "Hot shard pressure (reads/s)",
      droppedAlertLabel: "HOT SHARD SATURATED — READ REJECTED",
      fanoutHint: "All reads → single hot shard",
      fanoutNodePrefix: "R",
      drawMode: "hot-shard",
    },
    "shuffle-sharding": {
      note: "Tenant 1 is the noisy neighbor. Enable shuffle sharding to limit blast radius to a small overlapping subset.",
      drawMode: "shuffle-shard",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Shard capacity",
      refillLabel: "Recovery rate",
      bucketLabel: "Shard budget",
      burstLabel: "Noisy tenant traffic",
      sendActionLabel: "Send tenant traffic",
      acceptedLabel: "SERVED",
      droppedLabel: "OVERLOADED",
      acceptedSeriesLabel: "Served req/s",
      droppedSeriesLabel: "Overloaded req/s",
      chartTitle: "Shard pressure (req/s)",
      droppedAlertLabel: "SHARD OVERLOAD — TENANT DEGRADED",
      fanoutHint: "Each tenant maps to a shard subset",
      toggles: [
        { key: "shuffle", label: "Shuffle sharding", kind: "ok", value: false },
        { key: "burst", label: "Noisy tenant traffic", kind: "warn", value: false },
      ],
    },
    "connection-pooling": {
      mode: "pool",
      note: "Pool has limited connections. Each send checks out a slot; release rate returns connections to the pool.",
      capacityDefault: 12,
      refillDefault: 4,
      burstLabel: "Connection spike",
      capacityLabel: "Pool size",
      refillLabel: "Release rate",
      bucketLabel: "Connection pool",
      sendActionLabel: "Send query",
      acceptedLabel: "ACQUIRED",
      droppedLabel: "WAIT-REJECT",
      acceptedSeriesLabel: "Acquired conn/s",
      droppedSeriesLabel: "Wait/reject req/s",
      chartTitle: "Pool pressure (req/s)",
      droppedAlertLabel: "POOL EXHAUSTED — WAIT OR REJECT",
    },
    "connection-pool-exhaustion": {
      mode: "pool",
      note: "Slow queries hold every connection — pool fills and new checkout requests are rejected immediately.",
      capacityDefault: 8,
      capacityMax: 16,
      refillDefault: 1,
      refillMax: 5,
      burstLabel: "Peak checkout traffic",
      capacityLabel: "Max connections",
      refillLabel: "Query hold factor",
      bucketLabel: "DB connection pool",
      sendActionLabel: "Checkout connection",
      acceptedLabel: "ACQUIRED",
      droppedLabel: "REJECTED",
      acceptedSeriesLabel: "Acquired conn/s",
      droppedSeriesLabel: "Rejected req/s",
      chartTitle: "Pool checkout outcomes (req/s)",
      droppedAlertLabel: "POOL EXHAUSTED — CONNECTION REJECTED",
    },
    "littles-law": {
      note: "L = λW — increase arrival rate and watch queue depth vs drain rate.",
      burstLabel: "High arrival rate",
      capacityLabel: "Max queue depth",
      refillLabel: "Service rate",
      bucketLabel: "Queue depth",
      chartTitle: "Arrivals vs service (req/s)",
    },
    "queue-buildup": {
      note: "Producer faster than consumer — queue grows until backpressure.",
      capacityLabel: "Queue capacity",
      refillLabel: "Consumer rate",
      bucketLabel: "Queue depth",
    },
    "gc-pause": {
      mode: "timeline",
      drawMode: "timeline",
      timelineVariant: "gc",
      note: "Stop-the-world GC pauses stall all request threads.",
      burstLabel: "Allocation spike",
      capacityDefault: 70,
      capacityMin: 30,
      capacityMax: 100,
      capacityLabel: "Heap threshold",
      refillDefault: 2,
      refillMin: 1,
      refillMax: 8,
      refillLabel: "GC sweep rate",
      bucketLabel: "Stop-the-world timeline",
      sendActionLabel: "Allocate / request",
      acceptedLabel: "SERVED",
      droppedLabel: "PAUSED",
      acceptedSeriesLabel: "Served req/s",
      droppedSeriesLabel: "Paused req/s",
      chartTitle: "Request outcomes during GC (req/s)",
      droppedAlertLabel: "STOP-THE-WORLD — ALL THREADS PAUSED",
    },
    "n-plus-one": {
      mode: "amplification",
      drawMode: "amplification",
      note: "One list fetch triggers 1 + N row lookups — classic ORM N+1 amplification.",
      burstLabel: "Large list fetch",
      capacityDefault: 8,
      capacityMin: 2,
      capacityMax: 20,
      capacityLabel: "List size (N)",
      refillLabel: "Batch size",
      sendActionLabel: "Fetch list",
      acceptedLabel: "QUERIES",
      droppedLabel: "TIMEOUT",
      acceptedSeriesLabel: "Queries/s",
      droppedSeriesLabel: "Timeouts/s",
      chartTitle: "Query rate (queries/s)",
      droppedAlertLabel: "DB TIMEOUT — N+1 AMPLIFICATION",
      amplificationKind: "n-plus-one",
    },
    "load-shedding": {
      note: "Overload — excess requests dropped at admission.",
      burstLabel: "Overload traffic",
      capacityDefault: 20,
      capacityLabel: "Service capacity",
      refillLabel: "Recovery rate",
      bucketLabel: "Admission slots",
      sendActionLabel: "Send request",
      acceptedLabel: "ACCEPTED",
      droppedLabel: "SHED",
      acceptedSeriesLabel: "Accepted req/s",
      droppedSeriesLabel: "Shed req/s",
      chartTitle: "Admission outcomes (req/s)",
      droppedAlertLabel: "SHED — ADMISSION REJECTED",
    },
    "tail-latency": {
      mode: "latency",
      note: "Tail latency (p99) dominates user experience — averages hide the slow requests users feel. Send requests or enable burst to spike the tail.",
      burstLabel: "Traffic spike",
      capacityDefault: 150,
      capacityMin: 50,
      capacityMax: 300,
      refillDefault: 40,
      refillMin: 10,
      refillMax: 80,
      capacityLabel: "SLO target",
      capacityUnit: "ms",
      refillLabel: "Recovery rate",
      refillUnit: " ms/s",
      bucketLabel: "p99 latency",
      sendActionLabel: "Send request",
      acceptedLabel: "WITHIN SLO",
      droppedLabel: "SLO BREACH",
      acceptedSeriesLabel: "Healthy req/s",
      droppedSeriesLabel: "Tail breach req/s",
      chartTitle: "Tail latency outcomes (req/s)",
      droppedAlertLabel: "SLO BREACH — p99 exceeded",
    },
    "hedged-requests": {
      note: "Client sends a backup request when the primary is slow. Tail latency triggers hedged fan-out to replicas.",
      drawMode: "hedged",
      burstLabel: "Tail latency spike",
      capacityDefault: 150,
      capacityLabel: "Hedge threshold (ms)",
      refillLabel: "Recovery rate",
      bucketLabel: "Hedge fan-out",
      sendActionLabel: "Send request",
      acceptedLabel: "RESOLVED",
      droppedLabel: "HEDGED",
      acceptedSeriesLabel: "Resolved req/s",
      droppedSeriesLabel: "Hedged duplicates/s",
      chartTitle: "Hedged request fan-out (req/s)",
      droppedAlertLabel: "HEDGE FIRED — BACKUP SENT",
      fanoutHint: "Primary slow → backup to replica",
      fanoutNodePrefix: "R",
    },
    "exponential-backoff": {
      note: "Failed requests retry with exponentially increasing wait. Click retry to advance the backoff step.",
      burstLabel: "Retry storm",
      sendActionLabel: "Retry request",
      capacityDefault: 6,
      refillDefault: 1,
      capacityLabel: "Max backoff step",
      refillLabel: "Cooldown rate",
      bucketLabel: "Backoff steps",
      acceptedLabel: "RETRIES",
      droppedLabel: "GAVE UP",
      acceptedSeriesLabel: "Retries/s",
      droppedSeriesLabel: "Abandoned/s",
      chartTitle: "Retry rate (req/s)",
      droppedAlertLabel: "MAX RETRIES — GAVE UP",
    },
    "adaptive-concurrency": {
      note: "Concurrency limit adapts to observed latency. Burst fills in-flight slots; excess requests are rejected.",
      burstLabel: "Latency spike / traffic surge",
      capacityDefault: 10,
      refillDefault: 2,
      capacityLabel: "Concurrency limit",
      refillLabel: "Completion rate",
      bucketLabel: "In-flight requests",
      acceptedLabel: "ADMITTED",
      droppedLabel: "REJECTED",
      acceptedSeriesLabel: "Admitted req/s",
      droppedSeriesLabel: "Rejected req/s",
      chartTitle: "Adaptive concurrency (req/s)",
      droppedAlertLabel: "REJECTED — CONCURRENCY LIMIT",
      queueStatusNote: "in-flight vs concurrency limit",
    },
    "retry-amplification": {
      note: "Each client retries on timeout — N clients × R retries multiplies load on a degraded backend.",
      burstLabel: "Retry storm",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Backend capacity",
      refillLabel: "Recovery rate",
      bucketLabel: "Retry budget",
      sendActionLabel: "Trigger retry",
      acceptedLabel: "SERVED",
      droppedLabel: "OVERLOAD",
      acceptedSeriesLabel: "Served req/s",
      droppedSeriesLabel: "Overloaded req/s",
      chartTitle: "Retry amplification pressure (req/s)",
      droppedAlertLabel: "BACKEND OVERLOAD — RETRIES MULTIPLY",
      fanoutHint: "N clients × R retries → backend",
      fanoutNodePrefix: "C",
    },
    "coordinated-omission": {
      mode: "latency",
      note: "Load generators wait for responses before sending the next request — benchmark hides stalls and reports artificially low p99.",
      burstLabel: "Hidden stall (coordinated omission)",
      capacityDefault: 100,
      capacityMin: 50,
      capacityMax: 250,
      refillDefault: 30,
      capacityLabel: "Reported p99 SLO",
      capacityUnit: "ms",
      refillLabel: "Recovery rate",
      refillUnit: " ms/s",
      bucketLabel: "True p99 latency",
      sendActionLabel: "Send benchmark request",
      acceptedLabel: "REPORTED OK",
      droppedLabel: "STALL HIDDEN",
      acceptedSeriesLabel: "Reported req/s",
      droppedSeriesLabel: "Omitted stalls/s",
      chartTitle: "Benchmark vs true latency (req/s)",
      droppedAlertLabel: "COORDINATED OMISSION — STALL NOT MEASURED",
    },
    "coordinated-omission-perf": {
      mode: "latency",
      note: "Performance benchmarks that omit coordinated delays report optimistic throughput — true tail latency is much worse.",
      burstLabel: "Coordinated omission ON",
      capacityDefault: 100,
      capacityMin: 50,
      capacityMax: 250,
      refillDefault: 30,
      capacityLabel: "Benchmark SLO",
      capacityUnit: "ms",
      refillLabel: "Recovery rate",
      refillUnit: " ms/s",
      bucketLabel: "True p99 latency",
      sendActionLabel: "Run benchmark",
      acceptedLabel: "REPORTED OK",
      droppedLabel: "STALL HIDDEN",
      acceptedSeriesLabel: "Reported req/s",
      droppedSeriesLabel: "Omitted stalls/s",
      chartTitle: "Benchmark vs true latency (req/s)",
      droppedAlertLabel: "COORDINATED OMISSION — TAIL HIDDEN",
    },
    "cache-invalidation": {
      note: "Write triggers invalidation fan-out to every cache node — burst of updates overwhelms invalidation capacity.",
      burstLabel: "Invalidation burst",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Invalidation throughput",
      refillLabel: "Purge rate",
      bucketLabel: "Invalidation budget",
      sendActionLabel: "Invalidate key",
      acceptedLabel: "PURGED",
      droppedLabel: "STALE",
      acceptedSeriesLabel: "Purged keys/s",
      droppedSeriesLabel: "Stale reads/s",
      chartTitle: "Cache invalidation pressure (keys/s)",
      droppedAlertLabel: "STALE CACHE — INVALIDATION LAG",
      fanoutHint: "Write → fan-out purge to cache nodes",
      fanoutNodePrefix: "N",
    },
    "cache-consistency": {
      note: "DB write succeeds but cache update fails — readers see stale values until TTL expires or manual purge.",
      burstLabel: "Write + cache miss storm",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Cache write capacity",
      refillLabel: "Reconcile rate",
      bucketLabel: "Coherence budget",
      sendActionLabel: "Write + read",
      acceptedLabel: "CONSISTENT",
      droppedLabel: "STALE READ",
      acceptedSeriesLabel: "Consistent reads/s",
      droppedSeriesLabel: "Stale reads/s",
      chartTitle: "Cache coherence outcomes (reads/s)",
      droppedAlertLabel: "STALE READ — CACHE BEHIND DB",
      fanoutHint: "Readers hit stale cache after DB write",
      fanoutNodePrefix: "R",
    },
    "cache-pollution": {
      note: "Low-value keys flood the cache and evict hot entries — hit rate collapses under scan or crawler traffic.",
      burstLabel: "Scan / crawler traffic",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Cache capacity",
      refillLabel: "Eviction rate",
      bucketLabel: "Useful entries",
      sendActionLabel: "Insert junk key",
      acceptedLabel: "HIT",
      droppedLabel: "EVICTED",
      acceptedSeriesLabel: "Cache hits/s",
      droppedSeriesLabel: "Evictions/s",
      chartTitle: "Cache pollution pressure (ops/s)",
      droppedAlertLabel: "HOT KEY EVICTED — CACHE POLLUTED",
      fanoutHint: "Junk keys evict useful entries",
      fanoutNodePrefix: "K",
    },
    "ephemeral-port-exhaustion": {
      mode: "pool",
      note: "Short-lived connections leave sockets in TIME_WAIT — ephemeral port range exhausts and new outbound dials fail.",
      capacityDefault: 10,
      capacityMax: 20,
      refillDefault: 1,
      refillMax: 4,
      burstLabel: "Connection churn spike",
      capacityLabel: "Ephemeral port pool",
      refillLabel: "TIME_WAIT release rate",
      bucketLabel: "Available ports",
      sendActionLabel: "Open connection",
      acceptedLabel: "BOUND",
      droppedLabel: "EADDRINUSE",
      acceptedSeriesLabel: "Bound ports/s",
      droppedSeriesLabel: "Failed dials/s",
      chartTitle: "Ephemeral port pressure (conn/s)",
      droppedAlertLabel: "PORT EXHAUSTED — CANNOT DIAL",
    },
    "slow-query-amplification": {
      mode: "amplification",
      drawMode: "amplification",
      note: "One slow query holds connections and blocks the pool — waiting threads amplify into a DB saturation event.",
      burstLabel: "Slow query storm",
      capacityDefault: 6,
      capacityMin: 2,
      capacityMax: 15,
      capacityLabel: "Blocked threads",
      refillLabel: "Query timeout rate",
      sendActionLabel: "Run slow query",
      acceptedLabel: "QUERIES",
      droppedLabel: "TIMEOUT",
      acceptedSeriesLabel: "Queries/s",
      droppedSeriesLabel: "Timeouts/s",
      chartTitle: "Query amplification (queries/s)",
      droppedAlertLabel: "DB SATURATED — SLOW QUERY AMPLIFICATION",
    },
    "noisy-neighbor": {
      mode: "queue",
      note: "One tenant's traffic fills the shared queue — other tenants see elevated latency and timeouts.",
      burstLabel: "Noisy tenant traffic",
      capacityDefault: 12,
      refillDefault: 2,
      capacityLabel: "Shared queue depth",
      refillLabel: "Fair-share drain rate",
      bucketLabel: "Tenant queue depth",
      sendActionLabel: "Send tenant request",
      acceptedLabel: "SERVED",
      droppedLabel: "STARVED",
      acceptedSeriesLabel: "Served req/s",
      droppedSeriesLabel: "Starved req/s",
      chartTitle: "Noisy neighbor pressure (req/s)",
      droppedAlertLabel: "NEIGHBOR STARVED — QUEUE FULL",
      queueStatusNote: "noisy tenant fills shared queue",
    },
    "priority-queue-starvation": {
      mode: "queue",
      note: "Strict priority scheduling always serves HIGH — LOW-priority jobs never run if HIGH traffic never drains.",
      burstLabel: "Continuous HIGH traffic",
      capacityDefault: 10,
      refillDefault: 3,
      capacityLabel: "Queue capacity",
      refillLabel: "LOW-tier service rate",
      bucketLabel: "LOW-priority backlog",
      sendActionLabel: "Enqueue LOW job",
      acceptedLabel: "SERVED",
      droppedLabel: "STARVED",
      acceptedSeriesLabel: "Served jobs/s",
      droppedSeriesLabel: "Starved jobs/s",
      chartTitle: "Priority queue outcomes (jobs/s)",
      droppedAlertLabel: "LOW PRIORITY STARVED",
      queueStatusNote: "HIGH traffic blocks LOW jobs",
    },
    "request-coalescing": {
      mode: "latency",
      note: "Duplicate in-flight requests for the same key are merged — one backend fetch serves many callers.",
      burstLabel: "Duplicate request burst",
      capacityDefault: 80,
      capacityMin: 30,
      capacityMax: 200,
      refillDefault: 25,
      capacityLabel: "Coalesce window",
      capacityUnit: "ms",
      refillLabel: "Merge rate",
      refillUnit: " ms/s",
      bucketLabel: "In-flight duplicates",
      sendActionLabel: "Send duplicate request",
      acceptedLabel: "COALESCED",
      droppedLabel: "DUPLICATE",
      acceptedSeriesLabel: "Coalesced req/s",
      droppedSeriesLabel: "Duplicate fetches/s",
      chartTitle: "Request coalescing (req/s)",
      droppedAlertLabel: "DUPLICATE FETCH — COALESCE MISSED",
    },
    "admission-control": {
      drawMode: "admission",
      note: "Gateway rejects requests when in-flight count exceeds capacity — protects downstream from overload.",
      burstLabel: "Admission overload",
      capacityDefault: 15,
      refillDefault: 4,
      capacityLabel: "Max in-flight",
      refillLabel: "Completion rate",
      bucketLabel: "Admission slots",
      sendActionLabel: "Send request",
      acceptedLabel: "ADMITTED",
      droppedLabel: "REJECTED",
      acceptedSeriesLabel: "Admitted req/s",
      droppedSeriesLabel: "Rejected req/s",
      chartTitle: "Gateway admission (req/s)",
      droppedAlertLabel: "REJECTED — ADMISSION GATE CLOSED",
    },
    "sticky-sessions": {
      note: "Session affinity routes all traffic to one backend — hot node overload while peers stay idle.",
      burstLabel: "Sticky session surge",
      capacityDefault: stampedeCapacityDefault,
      refillDefault: stampedeRefillDefault,
      capacityLabel: "Hot node capacity",
      refillLabel: "Failover rate",
      bucketLabel: "Session node budget",
      sendActionLabel: "Send session request",
      acceptedLabel: "ROUTED",
      droppedLabel: "OVERLOAD",
      acceptedSeriesLabel: "Routed req/s",
      droppedSeriesLabel: "Overloaded req/s",
      chartTitle: "Sticky session pressure (req/s)",
      droppedAlertLabel: "HOT NODE OVERLOAD — PEERS IDLE",
      fanoutHint: "All sessions → single backend node",
      fanoutNodePrefix: "S",
    },
    watermarking: {
      mode: "queue",
      note: "Event-time watermark lags behind processing time — late events are dropped or sent to a side output.",
      burstLabel: "Late event burst",
      capacityDefault: 14,
      refillDefault: 2,
      capacityLabel: "Watermark lag",
      refillLabel: "Advance rate",
      bucketLabel: "Late event backlog",
      sendActionLabel: "Emit late event",
      acceptedLabel: "ON TIME",
      droppedLabel: "LATE",
      acceptedSeriesLabel: "On-time events/s",
      droppedSeriesLabel: "Late events/s",
      chartTitle: "Watermark lag (events/s)",
      droppedAlertLabel: "LATE EVENT — BEHIND WATERMARK",
      queueStatusNote: "events behind watermark lag",
    },
  };
  const o = OVERRIDES[topicId] || {};
  const mode = o.mode || getMetricsMode(topicId);
  return {
    mode,
    note: o.note || `${title}: interact with the model. Toggle burst for sustained load.`,
    capacityDefault: o.capacityDefault ?? (topicId.includes("leaky") ? 20 : 35),
    refillDefault: o.refillDefault ?? 3,
    burstLabel: o.burstLabel || "Burst traffic",
    capacityLabel: o.capacityLabel || "Bucket capacity",
    refillLabel: o.refillLabel || "Refill rate",
    bucketLabel: o.bucketLabel || "Tokens",
    acceptedLabel: o.acceptedLabel || "ACCEPTED",
    droppedLabel: o.droppedLabel || "DROPPED",
    acceptedSeriesLabel: o.acceptedSeriesLabel || "Accepted req/s",
    droppedSeriesLabel: o.droppedSeriesLabel || "Dropped req/s",
    chartTitle: o.chartTitle || "Request rate (req/s)",
    sendActionLabel: o.sendActionLabel,
    droppedAlertLabel: o.droppedAlertLabel,
    fanoutHint: o.fanoutHint,
    fanoutNodePrefix: o.fanoutNodePrefix,
    drawMode: o.drawMode,
    timelineVariant: o.timelineVariant,
    toggles: o.toggles,
    init: o.init,
    capacityMin: o.capacityMin,
    capacityMax: o.capacityMax,
    capacityUnit: o.capacityUnit,
    refillMin: o.refillMin,
    refillMax: o.refillMax,
    refillUnit: o.refillUnit,
    queueStatusNote: o.queueStatusNote,
    amplificationKind: o.amplificationKind,
  };
}

export function buildQueueConfig(topicId, title) {
  const PAYMENT_MSGS = [
    { id: 1, label: "OrderPaid", type: "valid" },
    { id: 2, label: "PaymentCap", type: "valid" },
    { id: 3, label: "BadRefund", type: "poison" },
    { id: 4, label: "LedgerPost", type: "valid" },
    { id: 5, label: "WalletSync", type: "valid" },
  ];
  const HOL_MSGS = [
    { id: 1, label: "BadRefund", type: "poison" },
    { id: 2, label: "LedgerPost", type: "valid" },
    { id: 3, label: "WalletSync", type: "valid" },
  ];
  const PIPELINE_MSGS = [
    { id: 1, label: "ChargeReq", type: "valid" },
    { id: 2, label: "Invoice", type: "valid" },
    { id: 3, label: "Notify", type: "valid" },
    { id: 4, label: "Receipt", type: "valid" },
    { id: 5, label: "Webhook", type: "valid" },
    { id: 6, label: "Ledger", type: "valid" },
  ];
  const TASK_MSGS = [
    { id: 1, label: "Receipt", type: "valid" },
    { id: 2, label: "Settlement", type: "valid" },
    { id: 3, label: "Refund", type: "valid" },
    { id: 4, label: "Notify", type: "valid" },
  ];
  const LAG_MSGS = [
    { id: 1, label: "ChargeEvt", type: "valid" },
    { id: 2, label: "Invoice", type: "valid" },
    { id: 3, label: "Notify", type: "valid" },
    { id: 4, label: "Receipt", type: "valid" },
  ];

  const OVERRIDES = {
    "poison-message": {
      variant: "poison-dlq",
      note: "Wallet consumer crashes on BadRefund. Without DLQ the poison event retries forever and blocks events behind it.",
      explainer: 'Click "Start Processing". Toggle mode to compare infinite retry vs DLQ offload.',
      messages: PAYMENT_MSGS,
    },
    backpressure: {
      variant: "backpressure",
      note: "Producer outpaces a slow consumer. Toggle bounded queue — producer pauses when full instead of growing without limit.",
      explainer: 'Click "Run pipeline". Toggle bounded queue to see backpressure pause the producer.',
      messages: PIPELINE_MSGS,
      queueCapacity: 4,
      showModeSelect: false,
      startLabel: "Run pipeline",
      toggles: [
        { key: "bounded", label: "Bounded queue (backpressure)", kind: "ok", value: true },
      ],
    },
    "slow-consumer": {
      variant: "slow-consumer",
      note: "Producer keeps publishing while a single slow consumer falls behind. Toggle scale-out to add workers.",
      explainer: 'Click "Start pipeline". Watch lag grow, then toggle "Scale out workers" and reset to compare.',
      messages: LAG_MSGS,
      publishCount: 8,
      showModeSelect: false,
      startLabel: "Start pipeline",
      toggles: [
        { key: "scaleOut", label: "Scale out workers", kind: "ok", value: false },
      ],
    },
    "head-of-line-blocking": {
      variant: "poison-dlq",
      note: "BadRefund sits at the queue head — every message behind it waits. DLQ offload unblocks the line.",
      explainer: 'Click "Start Processing". Compare DLQ vs infinite retry on a head-of-line poison message.',
      messages: HOL_MSGS,
    },
    "dead-letter-queue": {
      variant: "poison-dlq",
      note: "After max retries, poison payment events move to the DLQ so the main queue keeps draining.",
      explainer: 'Click "Start Processing". With DLQ enabled, BadRefund is parked after 3 failures.',
      messages: PAYMENT_MSGS,
    },
    "visibility-timeout": {
      variant: "visibility-timeout",
      note: "SQS-style visibility: message is hidden while in-flight. If the worker crashes before ack, it reappears for redelivery.",
      explainer: 'Click "Receive message". Toggle ack-before-timeout vs let visibility expire.',
      messages: [{ id: 1, label: "ChargeEvt", type: "valid" }],
      showModeSelect: false,
      startLabel: "Receive message",
      toggles: [
        { key: "ackInTime", label: "Ack before timeout", kind: "ok", value: true },
      ],
    },
    "consumer-rebalancing": {
      variant: "consumer-rebalancing",
      note: "Kafka consumer group rebalance: partitions revoke, reassignment pauses consumption. Toggle a new member joining.",
      explainer: 'Click "Rebalance group". Toggle "New consumer joins" to see partitions split three ways.',
      showModeSelect: false,
      startLabel: "Rebalance group",
      toggles: [
        { key: "newConsumer", label: "New consumer joins", kind: "ok", value: false },
      ],
    },
    "pub-sub-pattern": {
      variant: "pub-sub",
      note: "One PaymentCaptured publish fans out to Ledger, Notify, and Fraud — each subscriber gets its own copy.",
      explainer: 'Click "Publish event". Toggle durable subscriptions vs ephemeral (offline subscriber misses).',
      messages: [{ id: 1, label: "PaymentCaptured", type: "valid" }],
      topicLabel: "payment.captured",
      subscribers: ["Ledger", "Notify", "Fraud"],
      showModeSelect: false,
      startLabel: "Publish event",
      toggles: [
        { key: "durable", label: "Durable subscriptions", kind: "ok", value: true },
      ],
    },
    "work-queue": {
      variant: "work-queue",
      note: "Shared durable task queue with competing consumers. More workers pull in parallel and drain backlog faster.",
      explainer: 'Click "Start workers". Toggle two workers to see competing consumers load-balance.',
      messages: TASK_MSGS,
      showModeSelect: false,
      startLabel: "Start workers",
      toggles: [
        { key: "twoWorkers", label: "Two competing workers", kind: "ok", value: false },
      ],
    },
    "dead-letter-pattern": {
      variant: "poison-dlq",
      note: "Dead letter pattern: bounded retries then route poison tasks to a DLQ so workers stay available.",
      explainer: 'Click "Start Processing". After 3 failures BadRefund is quarantined in the DLQ.',
      messages: PAYMENT_MSGS,
      maxRetries: 3,
    },
    "backpressure-pattern": {
      variant: "backpressure",
      note: "Pull-based backpressure: bound the buffer and pause the producer when the queue is full — unbounded queues hide overload until OOM.",
      explainer: 'Click "Run pipeline". Bounded buffer applies backpressure; unbounded lets backlog grow.',
      messages: PIPELINE_MSGS,
      queueCapacity: 3,
      showModeSelect: false,
      startLabel: "Run pipeline",
      toggles: [
        { key: "bounded", label: "Bounded buffer", kind: "ok", value: true },
      ],
    },
    "outbox-inbox-combo": {
      variant: "outbox-inbox",
      note: "Transactional outbox relays events; inbox dedupes on event_id so at-least-once delivery does not double-apply.",
      explainer: 'Click "Relay from outbox". Toggle duplicate delivery to see inbox skip the second copy.',
      messages: [
        { id: 1, label: "PaymentCaptured", type: "valid", eventId: "evt-7f3a" },
        { id: 2, label: "LedgerPosted", type: "valid", eventId: "evt-9b21" },
      ],
      showModeSelect: false,
      startLabel: "Relay from outbox",
      toggles: [
        { key: "duplicateDelivery", label: "Duplicate delivery", kind: "warn", value: false },
      ],
    },
  };
  const o = OVERRIDES[topicId] || {};
  return {
    variant: o.variant || "poison-dlq",
    note: o.note || `${title}: process messages. Message 3 is poison — compare with/without DLQ.`,
    showModeSelect: o.showModeSelect,
    messages: o.messages,
    explainer: o.explainer,
    toggles: o.toggles,
    selects: o.selects,
    maxRetries: o.maxRetries,
    queueCapacity: o.queueCapacity,
    startLabel: o.startLabel,
    queueTitle: o.queueTitle,
    workerTitle: o.workerTitle,
    processedTitle: o.processedTitle,
    dlqTitle: o.dlqTitle,
    topicLabel: o.topicLabel,
    publishCount: o.publishCount,
    producerRate: o.producerRate,
    consumerSlowMs: o.consumerSlowMs,
    consumerFastMs: o.consumerFastMs,
    subscribers: o.subscribers,
  };
}

export function buildClickFlowConfig(topicId, title) {
  const [grpcClientSlot, grpcServerSlot] = layoutRow(2, { y: 230, w: 150, h: 64, margin: 170 });
  const [httpClientSlot, httpServerSlot] = layoutRow(2, { y: 220, w: 150, h: 72, margin: 170 });
  const HTTP_REQ_COLORS = [C.accent, C.service, C.ok];
  const HTTP_REQ_LANES = [httpClientSlot.y + 14, httpClientSlot.y + 34, httpClientSlot.y + 54];

  const MAP = {
    "http-evolution": {
      note: "HTTP/1.1 queues requests on one connection; HTTP/2 multiplexes concurrent streams. Toggle HTTP/2, then send 3 requests.",
      toggles: [{ key: "http2", label: "HTTP/2 multiplexing", kind: "ok", value: false }],
      components: [
        { ...httpClientSlot, id: "client", title: "Browser", color: C.client },
        { ...httpServerSlot, id: "server", title: "HTTP Server", color: C.service },
      ],
      initialValues: { client: "idle", server: "listening" },
      actions: [{
        id: "send", label: "Send 3 requests", primary: true, flowKey: "multiplex",
        onClick(ctx) {
          ctx.state.lastResult = ctx.toggles.http2 ? "h2" : "h1";
          ctx.state.values.client = "sending…";
          ctx.state.values.server = "idle";
        },
      }],
      flows: {
        multiplex: (ctx) => ctx.toggles.http2
          ? [
            { from: "client", to: "server", color: HTTP_REQ_COLORS[0], set: { server: "stream 1" } },
            { from: "client", to: "server", color: HTTP_REQ_COLORS[1] },
            { from: "client", to: "server", color: HTTP_REQ_COLORS[2], set: { server: "3 streams active" } },
            { from: "server", to: "client", color: HTTP_REQ_COLORS[0] },
            { from: "server", to: "client", color: HTTP_REQ_COLORS[1] },
            { from: "server", to: "client", color: HTTP_REQ_COLORS[2], set: { client: "3 responses ✓", server: "idle" } },
          ]
          : [
            { from: "client", to: "server", color: HTTP_REQ_COLORS[0], set: { server: "req 1" } },
            { from: "server", to: "client", color: HTTP_REQ_COLORS[0], set: { client: "resp 1 ✓" } },
            { from: "client", to: "server", color: HTTP_REQ_COLORS[1], set: { server: "req 2 (queued)" } },
            { from: "server", to: "client", color: HTTP_REQ_COLORS[1], set: { client: "resp 2 ✓" } },
            { from: "client", to: "server", color: HTTP_REQ_COLORS[2], set: { server: "req 3 (queued)" } },
            { from: "server", to: "client", color: HTTP_REQ_COLORS[2], set: { client: "3 done ✓", server: "idle" } },
          ],
      },
      draw(ctx, d) {
        const fromX = httpClientSlot.x + httpClientSlot.w;
        const toX = httpServerSlot.x;
        const channelMid = (fromX + toX) / 2;
        const connLabel = ctx.toggles.http2
          ? "HTTP/2 — 1 TCP connection, multiplexed streams"
          : "HTTP/1.1 — 1 connection, sequential requests";
        d.text(channelMid, httpClientSlot.y - 30, connLabel, { align: "center", size: 11, color: C.muted });

        if (ctx.toggles.http2) {
          HTTP_REQ_LANES.forEach((y, i) => {
            d.arrow(fromX, y, toX, y, {
              color: HTTP_REQ_COLORS[i],
              dashed: true,
              width: 1.6,
              label: i === 0 ? "Streams 1–3" : "",
              alpha: 0.85 - i * 0.15,
            });
            d.arrow(toX, y + 8, fromX, y + 8, {
              color: HTTP_REQ_COLORS[i],
              dashed: true,
              width: 1.4,
              alpha: 0.55 - i * 0.1,
            });
          });
        } else {
          const midY = HTTP_REQ_LANES[1];
          d.arrow(fromX, midY, toX, midY, { color: C.muted, label: "one at a time", width: 2 });
          if (ctx.state.lastResult === "h1") {
            d.badge(channelMid, httpClientSlot.y - 52, "Head-of-line blocking", { color: C.warn, filled: false, align: "center" });
          }
        }
      },
      status: (ctx) => ({
        text: ctx.state.lastResult === "h2"
          ? "HTTP/2 — 3 streams multiplexed on one connection"
          : ctx.state.lastResult === "h1"
            ? "HTTP/1.1 — requests queued (head-of-line blocking)"
            : "Click Send 3 requests",
        cls: ctx.state.lastResult ? "ok" : "",
      }),
    },
    grpc: {
      note: "Unary RPC vs server streaming. Toggle streaming for multiple responses.",
      toggles: [{ key: "streaming", label: "Server streaming", kind: "ok", value: false }],
      components: [
        { ...grpcClientSlot, id: "client", title: "gRPC Client", color: C.client },
        { ...grpcServerSlot, id: "server", title: "gRPC Server", color: C.service },
      ],
      initialValues: { client: "stub ready", server: "idle" },
      actions: [{
        id: "call", label: "Invoke RPC", primary: true, flowKey: "rpc",
        onClick(ctx) {
          ctx.state.lastResult = ctx.toggles.streaming ? "stream" : "unary";
          ctx.state.values.server = ctx.toggles.streaming ? "streaming…" : "unary OK";
          ctx.state.values.client = ctx.toggles.streaming ? "receiving…" : "done";
        },
      }],
      flows: {
        rpc: (ctx) => ctx.toggles.streaming
          ? [
            { from: "client", to: "server", set: { server: "stream open" } },
            { from: "server", to: "client" },
            { from: "server", to: "client" },
            { from: "server", to: "client", set: { client: "stream complete" } },
          ]
          : [
            { from: "client", to: "server" },
            { from: "server", to: "client", set: { server: "unary handled", client: "response ✓" } },
          ],
      },
      draw(ctx, d) {
        const reqY = grpcClientSlot.y + 22;
        const respY = grpcClientSlot.y + grpcClientSlot.h - 18;
        const fromX = grpcClientSlot.x + grpcClientSlot.w;
        const toX = grpcServerSlot.x;
        const channelMid = (fromX + toX) / 2;

        d.text(channelMid, grpcClientSlot.y - 26, "HTTP/2 channel", { align: "center", size: 11, color: C.muted });
        if (ctx.state.lastResult === "stream") {
          d.arrow(fromX, reqY, toX, reqY, { color: C.service, label: "Stream request", width: 2 });
          [0, 1, 2].forEach((i) => {
            d.arrow(toX, respY + i * 14, fromX, respY + i * 14, {
              color: C.accent,
              dashed: true,
              width: 1.8,
              label: i === 0 ? "Streaming responses" : "",
              alpha: 0.9 - i * 0.2,
            });
          });
          return;
        }
        d.arrow(fromX, reqY, toX, reqY, { color: C.service, label: "Unary request", width: 2 });
        d.arrow(toX, respY, fromX, respY, { color: C.ok, label: "Unary response", width: 2 });
      },
      status: (ctx) => ({ text: ctx.state.lastResult === "stream" ? "Server streaming responses" : "Unary call complete", cls: "ok" }),
    },
    websockets: {
      note: "WebSocket: upgrade connection, then push messages bidirectionally. Toggle disconnect to simulate drop.",
      toggles: [{ key: "disconnected", label: "Connection dropped", kind: "err", value: false }],
      components: (() => {
        const [browser, ws] = layoutRow(2, { y: 230, w: 150, h: 64, margin: 170 });
        return [
          { ...browser, id: "browser", title: "Browser", color: C.client },
          { ...ws, id: "ws", title: "WS Server", color: C.accent },
        ];
      })(),
      initialValues: { browser: "idle", ws: "listening" },
      actions: [{
        id: "send", label: "Send message", primary: true, flowKey: "push",
        onClick(ctx) {
          ctx.state.lastResult = ctx.toggles.disconnected ? "failed" : "delivered";
          ctx.state.lastTarget = ctx.toggles.disconnected ? "browser" : "ws";
        },
      }],
      flows: {
        push: (ctx) => ctx.toggles.disconnected
          ? [{ from: "browser", to: "ws", color: C.err, stale: true }]
          : [
            { from: "browser", to: "ws", set: { ws: "message received" } },
            { from: "ws", to: "browser", set: { browser: "pushed ✓" } },
          ],
      },
      draw(ctx, d) {
        const upgraded = ctx.state.values.ws !== "listening" || ctx.state.lastResult === "delivered";
        if (upgraded && !ctx.toggles.disconnected) {
          d.text(400, 200, "wss:// — persistent connection", { align: "center", size: 11, color: C.ok });
        }
      },
      status: (ctx) => ({ text: ctx.state.lastResult === "failed" ? "Send failed — connection closed" : ctx.state.lastResult === "delivered" ? "Message pushed over WebSocket" : "Click Send message", cls: ctx.state.lastResult === "failed" ? "err" : ctx.state.lastResult ? "ok" : "" }),
    },
    "cache-aside": {
      note: "Read key — cache miss goes to DB, hit serves from cache.",
      toggles: [{ key: "warmCache", label: "Key in cache", kind: "ok", value: false }],
      components: [
        { id: "app", x: 100, y: 250, title: "App", color: C.client },
        { id: "cache", x: 350, y: 200, title: "Cache", color: C.accent },
        { id: "db", x: 350, y: 320, title: "DB", color: C.ledger, kind: "db" },
      ],
      initialValues: { cache: "empty", db: "user:42" },
      actions: [{
        id: "read", label: "Read user:42", primary: true,
        onClick(ctx) {
          if (ctx.toggles.warmCache) {
            ctx.state.values.cache = "HIT user:42";
            ctx.state.lastTarget = "cache";
          } else {
            ctx.state.values.db = "loaded user:42";
            ctx.state.values.cache = "populated";
            ctx.state.lastTarget = "db";
          }
        },
      }],
      status: (ctx) => ({ text: ctx.state.lastTarget === "cache" ? "Cache hit" : "Cache miss — loaded from DB", cls: "ok" }),
    },
    quorum: {
      note: "Quorum read R=2/3 — contact two replicas on the ring. Toggle lag to read a stale minority.",
      toggles: [{ key: "lag", label: "Replica R2 lagging", kind: "warn", value: false }],
      components: (() => {
        const ring = { cx: 500, cy: 300, r: 155 };
        const slot = (i, total, w = 100, h = 44) => {
          const a = ((i / total) * 360 - 90) * Math.PI / 180;
          return { x: ring.cx + ring.r * Math.cos(a) - w / 2, y: ring.cy + ring.r * Math.sin(a) - h / 2, w, h };
        };
        return [
          { id: "client", x: 80, y: 280, w: 110, h: 56, title: "Client", color: C.client },
          { id: "r1", ...slot(0, 3), title: "R1", color: C.ok, kind: "db" },
          { id: "r2", ...slot(1, 3), title: "R2", color: C.warn, kind: "db" },
          { id: "r3", ...slot(2, 3), title: "R3", color: C.ok, kind: "db" },
        ];
      })(),
      initialValues: { r1: "v=5", r2: "v=3", r3: "v=5" },
      actions: [{
        id: "read",
        label: "Quorum read (R=2)",
        primary: true,
        flowKey: "read",
        onClick(ctx) {
          ctx.state.stale = ctx.toggles.lag;
          ctx.state.lastResult = ctx.toggles.lag ? "v=3" : "v=5";
          ctx.state.lastTarget = ctx.toggles.lag ? "r2" : "r1";
        },
      }],
      flows: {
        read: (ctx) => (ctx.toggles.lag
          ? [
            { from: "client", to: "r2", color: C.warn, set: { r2: "v=3 ack" } },
            { from: "client", to: "r3", color: C.ok, set: { r3: "v=5 ack" } },
          ]
          : [
            { from: "client", to: "r1", color: C.ok, set: { r1: "v=5 ack" } },
            { from: "client", to: "r3", color: C.ok, set: { r3: "v=5 ack" } },
          ]),
      },
      draw(ctx, d) {
        const c = d.ctx;
        c.save();
        c.strokeStyle = C.faint;
        c.lineWidth = 2;
        c.setLineDash([7, 6]);
        c.beginPath();
        c.arc(500, 300, 155, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        d.text(500, 300, "replica ring", { size: 11, align: "center", color: C.faint });
        d.badge(500, 108, "R = 2 of 3", { color: C.muted, align: "center" });
        if (ctx.toggles.lag) {
          d.badge(500, 430, "R2 stale — quorum may return old value", { color: C.warn, align: "center" });
        }
      },
      status: (ctx) => ({
        text: ctx.state.stale ? "Stale read v=3 — lagging replica in quorum set" : "Consistent read v=5 — overlapping quorum",
        cls: ctx.state.stale ? "err" : "ok",
      }),
    },
    crdt: (() => {
      const [replicaASlot, replicaBSlot] = layoutRow(2, { y: 250, w: 150, h: 64, margin: 170 });
      const formatView = (v) => `[A:${v[0]}, B:${v[1]}]`;
      const syncValues = (ctx) => {
        ctx.state.values.replicaA = formatView(ctx.state.views.A);
        ctx.state.values.replicaB = formatView(ctx.state.views.B);
      };
      const mergeViews = (ctx) => {
        const merged = [
          Math.max(ctx.state.views.A[0], ctx.state.views.B[0]),
          Math.max(ctx.state.views.A[1], ctx.state.views.B[1]),
        ];
        ctx.state.views.A = [...merged];
        ctx.state.views.B = [...merged];
        syncValues(ctx);
        ctx.state.merged = true;
        ctx.state.diverged = false;
      };
      return {
        note: "G-Counter CRDT: two replicas edit locally while partitioned, then merge by max — no conflict.",
        toggles: [{ key: "concurrent", label: "Concurrent edit", kind: "warn", value: false }],
        components: [
          { ...replicaASlot, id: "replicaA", title: "Replica A", color: C.service, kind: "db" },
          { ...replicaBSlot, id: "replicaB", title: "Replica B", color: C.accent, kind: "db" },
        ],
        initialValues: { replicaA: "[A:0, B:0]", replicaB: "[A:0, B:0]" },
        init(ctx) {
          ctx.state.views = { A: [0, 0], B: [0, 0] };
          ctx.state.diverged = false;
          ctx.state.merged = false;
        },
        actions: [
          {
            id: "write",
            label: "Local write",
            primary: true,
            flowKey: "write",
            onClick(ctx) {
              ctx.state.merged = false;
              if (ctx.toggles.concurrent) {
                ctx.state.views.A[0] += 1;
                ctx.state.views.B[1] += 1;
                ctx.state.diverged = true;
              } else {
                ctx.state.views.A[0] += 1;
                ctx.state.views.B = [...ctx.state.views.A];
                ctx.state.diverged = false;
              }
              syncValues(ctx);
            },
          },
          {
            id: "merge",
            label: "Sync & merge",
            flowKey: "merge",
            disabled: (ctx) => !ctx.toggles.concurrent || !ctx.state.diverged,
            onClick(ctx) {
              ctx.state.pendingMerge = true;
            },
          },
        ],
        flows: {
          write: (ctx) => (ctx.toggles.concurrent
            ? [
              { from: "replicaA", to: "replicaB", color: C.err, set: { replicaA: formatView(ctx.state.views.A), replicaB: formatView(ctx.state.views.B) } },
            ]
            : [
              { from: "replicaA", to: "replicaB", color: C.ok, set: { replicaB: formatView(ctx.state.views.B) } },
            ]),
          merge: [
            { from: "replicaA", to: "replicaB", color: C.accent },
            {
              from: "replicaB",
              to: "replicaA",
              color: C.ok,
              onArrive(ctx) {
                if (ctx.state.pendingMerge) mergeViews(ctx);
                ctx.state.pendingMerge = false;
              },
            },
          ],
        },
        draw(ctx, d) {
          const midX = (replicaASlot.x + replicaASlot.w + replicaBSlot.x) / 2;
          const topY = replicaASlot.y - 36;
          d.text(midX, topY, "G-Counter (grow-only)", { align: "center", size: 11, color: C.muted });
          if (ctx.toggles.concurrent && ctx.state.diverged && !ctx.state.merged) {
            d.text(midX, topY + 18, "partitioned — views diverged", { align: "center", size: 10, color: C.warn });
            d.arrow(replicaASlot.x + replicaASlot.w / 2, replicaASlot.y - 8, replicaBSlot.x + replicaBSlot.w / 2, replicaBSlot.y - 8, {
              color: C.err, dashed: true, width: 1.5, label: "no sync",
            });
          } else if (ctx.state.merged) {
            d.text(midX, topY + 18, "merged: max(A,B) per slot", { align: "center", size: 10, color: C.ok });
          }
        },
        status: (ctx) => {
          if (ctx.state.merged) {
            return { text: "CRDT merge complete — max per counter, no conflict", cls: "ok" };
          }
          if (ctx.toggles.concurrent && ctx.state.diverged) {
            return { text: "Concurrent writes diverged — click Sync & merge", cls: "warn" };
          }
          if (ctx.toggles.concurrent) {
            return { text: "Concurrent edit — each replica increments its own counter", cls: "warn" };
          }
          return { text: "Sequential write — replicas stay in sync", cls: "ok" };
        },
      };
    })(),
    "read-replica-routing": {
      note: "Route read to replica. Toggle stale replica.",
      toggles: [{ key: "stale", label: "Replica stale", kind: "warn", value: false }],
      components: [
        { id: "app", x: 100, y: 250, title: "App", color: C.client },
        { id: "router", x: 320, y: 250, title: "Router", color: C.accent },
        { id: "primary", x: 520, y: 180, title: "Primary", color: C.ok, kind: "db" },
        { id: "replica", x: 520, y: 320, title: "Replica", color: C.service, kind: "db" },
      ],
      initialValues: { primary: "v=10", replica: "v=8" },
      actions: [{
        id: "read", label: "Read", primary: true,
        onClick(ctx) {
          ctx.state.routedTo = ctx.toggles.stale ? "replica" : "primary";
        },
      }],
      status: (ctx) => ({ text: ctx.state.routedTo === "replica" ? "Stale read from replica" : "Fresh read from primary", cls: ctx.state.routedTo === "replica" ? "warn" : "ok" }),
    },
    singleton: {
      note: "getInstance() — handlers share one registry. Toggle multi-process to break singleton guarantee.",
      toggles: [{ key: "multiProcess", label: "Multi-process deploy", kind: "err", value: false }],
      components: [
        { id: "handlerA", x: 120, y: 180, w: 120, title: "Handler 1", color: C.client },
        { id: "handlerB", x: 120, y: 320, w: 120, title: "Handler 2", color: C.client },
        { id: "registry", x: 420, y: 250, w: 150, title: "MetricsRegistry", color: C.ok },
      ],
      initialValues: { handlerA: "idle", handlerB: "idle", registry: "—" },
      actions: [{
        id: "get",
        label: "getInstance()",
        primary: true,
        flowKey: "get",
        onClick(ctx) {
          ctx.state.duplicate = ctx.toggles.multiProcess;
          if (ctx.toggles.multiProcess) {
            ctx.state.values.handlerA = "Registry@A";
            ctx.state.values.handlerB = "Registry@B";
            ctx.state.values.registry = "split ✗";
          } else {
            ctx.state.values.handlerA = "→ shared";
            ctx.state.values.handlerB = "→ shared";
            ctx.state.values.registry = "single instance ✓";
          }
        },
      }],
      flows: {
        get: (ctx) => (ctx.toggles.multiProcess
          ? [
            { from: "handlerA", to: "registry", color: C.err, set: { registry: "Registry@A" } },
            { from: "handlerB", to: "registry", color: C.err, set: { registry: "split ✗" } },
          ]
          : [
            { from: "handlerA", to: "registry", color: C.ok },
            { from: "handlerB", to: "registry", color: C.ok, set: { registry: "single instance ✓" } },
          ]),
      },
      draw(ctx, d) {
        if (ctx.state.duplicate) {
          d.badge(495, 180, "NOT a singleton", { color: C.err, filled: true, align: "center" });
        } else if (ctx.state.values.registry.includes("single")) {
          d.badge(495, 180, "one instance per JVM", { color: C.ok, align: "center" });
        }
      },
      status: (ctx) => ({
        text: ctx.state.duplicate ? "Two instances — not a singleton!" : "Single shared instance",
        cls: ctx.state.duplicate ? "err" : "ok",
      }),
    },
    observer: {
      note: "Subject publishes — all observers notified. Toggle async for fire-and-forget delivery.",
      toggles: [{ key: "async", label: "Async notify", kind: "warn", value: false }],
      components: [
        { id: "subject", x: 180, y: 250, w: 130, title: "Subject", color: C.accent },
        { id: "obsA", x: 450, y: 180, w: 120, title: "Observer A", color: C.service },
        { id: "obsB", x: 450, y: 320, w: 120, title: "Observer B", color: C.service },
      ],
      initialValues: { obsA: "idle", obsB: "idle" },
      actions: [{
        id: "notify",
        label: "notify()",
        primary: true,
        flowKey: "notify",
        onClick(ctx) {
          ctx.state.async = ctx.toggles.async;
        },
      }],
      flows: {
        notify: (ctx) => (ctx.toggles.async
          ? [
            { from: "subject", to: "obsA", color: C.accent, set: { obsA: "queued" } },
            { from: "subject", to: "obsB", color: C.accent, set: { obsB: "queued" } },
          ]
          : [
            { from: "subject", to: "obsA", color: C.ok, set: { obsA: "sync ✓" } },
            { from: "subject", to: "obsB", color: C.ok, set: { obsB: "sync ✓" } },
          ]),
      },
      draw(ctx, d) {
        const midX = 315;
        d.text(midX, 210, ctx.toggles.async ? "async fan-out" : "sync fan-out", { align: "center", size: 10, color: C.muted });
        if (ctx.state.async) {
          d.badge(midX, 190, "observers may lag", { color: C.warn, align: "center" });
        }
      },
      status: (ctx) => ({
        text: ctx.state.async ? "Observers queued — async delivery" : "All observers notified synchronously",
        cls: "ok",
      }),
    },
    strategy: {
      note: "Context delegates to interchangeable strategy — toggle premium to swap routing algorithm.",
      toggles: [{ key: "premium", label: "Premium strategy", kind: "ok", value: false }],
      components: [
        { id: "ctx", x: 120, y: 250, w: 120, title: "Context", color: C.client },
        { id: "strategy", x: 340, y: 250, w: 120, title: "Strategy", color: C.accent },
        { id: "algo", x: 560, y: 250, w: 130, title: "Algorithm", color: C.ok },
      ],
      initialValues: { strategy: "StandardStrategy", algo: "idle" },
      actions: [{
        id: "run",
        label: "execute()",
        primary: true,
        flowKey: "execute",
        onClick(ctx) {
          ctx.state.premium = ctx.toggles.premium;
          ctx.state.values.strategy = ctx.toggles.premium ? "PremiumStrategy" : "StandardStrategy";
          ctx.state.values.algo = ctx.toggles.premium ? "premium route ✓" : "standard route ✓";
        },
      }],
      flows: {
        execute: (ctx) => [
          { from: "ctx", to: "strategy", color: C.service },
          {
            from: "strategy",
            to: "algo",
            color: ctx.toggles.premium ? C.ok : C.accent,
            set: {
              algo: ctx.toggles.premium ? "premium route ✓" : "standard route ✓",
              strategy: ctx.toggles.premium ? "PremiumStrategy" : "StandardStrategy",
            },
          },
        ],
      },
      draw(ctx, d) {
        d.text(450, 210, ctx.toggles.premium ? "PremiumStrategy selected" : "StandardStrategy selected", {
          align: "center", size: 10, color: C.muted,
        });
      },
      status: (ctx) => ({
        text: ctx.state.premium ? "Premium strategy — fast-lane routing" : "Standard strategy — default routing",
        cls: "ok",
      }),
    },
    state: {
      note: "State pattern — context delegates transitions to state objects.",
      components: [
        { id: "orderCtx", x: 160, y: 250, w: 140, title: "OrderContext", color: C.client },
        { id: "stateObj", x: 440, y: 250, w: 120, title: "State", color: C.accent },
      ],
      initialValues: { stateObj: "DraftState" },
      init(ctx) {
        ctx.state.phase = "draft";
      },
      actions: [
        {
          id: "submit",
          label: "submit()",
          primary: true,
          flowKey: "transition",
          disabled: (ctx) => ctx.state.phase !== "draft",
          onClick(ctx) {
            ctx.state.phase = "submitted";
            ctx.state.values.stateObj = "SubmittedState";
          },
        },
        {
          id: "approve",
          label: "approve()",
          flowKey: "transition",
          disabled: (ctx) => ctx.state.phase !== "submitted",
          onClick(ctx) {
            ctx.state.phase = "approved";
            ctx.state.values.stateObj = "ApprovedState";
          },
        },
      ],
      flows: {
        transition: [{ from: "orderCtx", to: "stateObj", color: C.accent }],
      },
      draw(ctx, d) {
        const colors = { draft: C.muted, submitted: C.warn, approved: C.ok };
        d.badge(300, 200, ctx.state.phase.toUpperCase(), { color: colors[ctx.state.phase] || C.muted, align: "center" });
      },
      status: (ctx) => ({
        text: `Order state: ${ctx.state.values.stateObj}`,
        cls: ctx.state.phase === "approved" || ctx.state.phase === "submitted" ? "ok" : "",
      }),
    },
    "write-through": cacheFlowConfig("write-through", "Write-through", { hitLabel: "synced", missLabel: "written", hitStatus: "Write-through: cache and DB updated", missStatus: "Write-through: DB write + cache populate", writeMode: true }),
    "write-around": cacheFlowConfig("write-around", "Write-around", { hitLabel: "bypass", missLabel: "written", hitStatus: "Write-around: cache bypassed on write", missStatus: "Write-around: write goes to DB only", writeMode: true }),
    "write-back": cacheFlowConfig("write-back", "Write-back", { hitLabel: "dirty", missLabel: "buffered", hitStatus: "Write-back: dirty block in cache", missStatus: "Write-back: async flush scheduled", warmKey: "dirty", writeMode: true }),
    "read-through": cacheFlowConfig("read-through", "Read-through", { hitLabel: "HIT", missLabel: "loaded", hitStatus: "Read-through: cache serves", missStatus: "Read-through: cache loads from DB" }),
    "negative-cache": {
      ...cacheFlowConfig("negative-cache", "Negative cache", { hitLabel: "NOT FOUND cached", missLabel: "404", hitStatus: "Negative cache hit — no origin call", missStatus: "Miss — origin confirms not found" }),
      toggles: [{ key: "warmCache", label: "404 cached", kind: "warn", value: false }],
    },
    "eventual-consistency": {
      note: "Read after write — toggle replication lag.",
      toggles: [{ key: "lag", label: "Replica lagging", kind: "warn", value: false }],
      components: [
        { id: "client", x: 100, y: 250, title: "Client", color: C.client },
        { id: "primary", x: 350, y: 180, title: "Primary", color: C.ok, kind: "db" },
        { id: "replica", x: 350, y: 320, title: "Replica", color: C.warn, kind: "db" },
      ],
      initialValues: { primary: "v=5", replica: "v=3" },
      actions: [{ id: "read", label: "Read", primary: true, onClick(ctx) { ctx.state.stale = ctx.toggles.lag; ctx.state.lastTarget = ctx.toggles.lag ? "replica" : "primary"; } }],
      status: (ctx) => ({ text: ctx.state.stale ? "Stale read from lagging replica" : "Consistent read from primary", cls: ctx.state.stale ? "warn" : "ok" }),
    },
    "monotonic-reads": {
      note: "Session stickiness — toggle node switch to break monotonic reads.",
      toggles: [{ key: "switch", label: "Read from different replica", kind: "warn", value: false }],
      components: [
        { id: "client", x: 100, y: 250, title: "Client", color: C.client },
        { id: "r1", x: 350, y: 180, title: "Replica R1", color: C.ok, kind: "db" },
        { id: "r2", x: 350, y: 320, title: "Replica R2", color: C.warn, kind: "db" },
      ],
      initialValues: { r1: "v=5", r2: "v=3" },
      actions: [{ id: "read", label: "Read again", primary: true, onClick(ctx) { ctx.state.violation = ctx.toggles.switch; } }],
      status: (ctx) => ({ text: ctx.state.violation ? "Monotonic read violated — time went backward" : "Monotonic reads preserved", cls: ctx.state.violation ? "err" : "ok" }),
    },
    "session-consistency": {
      note: "Reads pinned to session node. Toggle session expiry.",
      toggles: [{ key: "expired", label: "Session expired", kind: "warn", value: false }],
      components: [
        { id: "client", x: 100, y: 250, title: "Client", color: C.client },
        { id: "router", x: 320, y: 250, title: "Session router", color: C.accent },
        { id: "node", x: 520, y: 250, title: "Pinned node", color: C.service, kind: "db" },
      ],
      initialValues: { node: "session data" },
      actions: [{ id: "read", label: "Read", primary: true, onClick(ctx) { ctx.state.pinned = !ctx.toggles.expired; } }],
      status: (ctx) => ({ text: ctx.state.pinned === false ? "Session lost — read unscoped" : "Read served from pinned node", cls: ctx.state.pinned === false ? "warn" : "ok" }),
    },
    "api-idempotency": {
      note: "Retry with same idempotency key — duplicate suppressed.",
      toggles: [{ key: "retry", label: "Client retry", kind: "warn", value: false }],
      components: [
        { id: "client", x: 100, y: 250, title: "Client", color: C.client },
        { id: "api", x: 400, y: 250, title: "API", color: C.service },
        { id: "store", x: 700, y: 250, title: "Idempotency store", color: C.ledger, kind: "db" },
      ],
      initialValues: { store: "empty" },
      actions: [{ id: "run", label: "POST /charge", primary: true, onClick(ctx) { ctx.state.duplicate = ctx.toggles.retry && ctx.state.values.store !== "empty"; ctx.state.values.store = "key=abc"; } }],
      status: (ctx) => ({ text: ctx.state.duplicate ? "Duplicate suppressed — cached response" : "Charge recorded once", cls: ctx.state.duplicate ? "ok" : "ok" }),
    },
    "inbox-pattern": {
      note: "Inbox dedupes incoming events before processing.",
      toggles: [{ key: "duplicate", label: "Duplicate delivery", kind: "warn", value: false }],
      components: [
        { id: "broker", x: 100, y: 250, title: "Broker", color: C.queue },
        { id: "inbox", x: 350, y: 250, title: "Inbox table", color: C.ledger, kind: "db" },
        { id: "handler", x: 600, y: 250, title: "Handler", color: C.service },
      ],
      initialValues: { inbox: "0 rows" },
      actions: [{ id: "run", label: "Process event", primary: true, onClick(ctx) { ctx.state.skipped = ctx.toggles.duplicate && ctx.state.values.inbox === "1 row"; ctx.state.values.inbox = "1 row"; } }],
      status: (ctx) => ({ text: ctx.state.skipped ? "Duplicate skipped via inbox" : "Event processed once", cls: "ok" }),
    },
    "cdc-relay": {
      note: "CDC relay tails the DB WAL and publishes row changes to the message queue. Toggle relay failure to see events stall.",
      toggles: [{ key: "fail", label: "Relay down", kind: "err", value: false }],
      components: [
        { id: "wal", x: 100, y: 250, title: "DB WAL", color: C.ledger, kind: "db" },
        { id: "relay", x: 400, y: 250, title: "CDC Relay", color: C.accent },
        { id: "queue", x: 700, y: 250, title: "Queue", color: C.queue },
      ],
      initialValues: { wal: "LSN 1000", relay: "tailing", queue: "empty" },
      actions: [{
        id: "run", label: "Relay event", primary: true, flowKey: "relay",
        onClick(ctx) { ctx.state.failed = ctx.toggles.fail; },
      }],
      flows: {
        relay: (ctx) => ctx.toggles.fail
          ? [{ from: "wal", to: "relay", color: C.err }]
          : [
            { from: "wal", to: "relay", set: { wal: "change captured", relay: "publishing" } },
            { from: "relay", to: "queue", set: { queue: "event ✓", relay: "caught up" } },
          ],
      },
      status: (ctx) => ({
        text: ctx.state.failed ? "Relay offline — WAL backlog growing"
          : ctx.state.lastTarget === "queue" ? "Change streamed to queue"
          : "Click Relay event",
        cls: ctx.state.failed ? "err" : ctx.state.lastTarget === "queue" ? "ok" : "",
      }),
    },
    "saga-choreography": {
      note: "Choreography — services react to events. Toggle failure for compensate.",
      toggles: [{ key: "fail", label: "Payment fails", kind: "err", value: false }],
      components: [
        { id: "order", x: 100, y: 250, title: "Order", color: C.client },
        { id: "inventory", x: 350, y: 200, title: "Inventory", color: C.service },
        { id: "payment", x: 350, y: 300, title: "Payment", color: C.gateway },
      ],
      initialValues: { payment: "pending" },
      actions: [{ id: "run", label: "Place order", primary: true, onClick(ctx) { ctx.state.failed = ctx.toggles.fail; ctx.state.values.payment = ctx.toggles.fail ? "failed" : "ok"; } }],
      status: (ctx) => ({ text: ctx.state.failed ? "Compensating transactions triggered" : "Saga completed", cls: ctx.state.failed ? "err" : "ok" }),
    },
    "saga-orchestration": {
      note: "Orchestrator drives saga steps. Toggle failure mid-flow.",
      toggles: [{ key: "fail", label: "Step 2 fails", kind: "err", value: false }],
      components: [
        { id: "orch", x: 200, y: 250, title: "Orchestrator", color: C.accent },
        { id: "svc", x: 450, y: 250, title: "Downstream", color: C.service },
      ],
      initialValues: { svc: "idle" },
      actions: [{ id: "run", label: "Run saga", primary: true, onClick(ctx) { ctx.state.failed = ctx.toggles.fail; ctx.state.values.svc = ctx.toggles.fail ? "compensating" : "done"; } }],
      status: (ctx) => ({ text: ctx.state.failed ? "Orchestrator compensating" : "Orchestrated saga complete", cls: ctx.state.failed ? "err" : "ok" }),
    },
    "pagination-offset-cursor": {
      note: "Toggle deep offset — offset pagination slows at high page.",
      toggles: [{ key: "deep", label: "Page 5000 (offset)", kind: "warn", value: false }],
      components: [
        { id: "client", x: 100, y: 250, title: "Client", color: C.client },
        { id: "api", x: 400, y: 250, title: "API", color: C.service },
        { id: "db", x: 700, y: 250, title: "DB", color: C.ledger, kind: "db" },
      ],
      initialValues: { db: "index scan" },
      actions: [{ id: "run", label: "Fetch page", primary: true, onClick(ctx) { ctx.state.slow = ctx.toggles.deep; ctx.state.values.db = ctx.toggles.deep ? "full table scan" : "index seek"; } }],
      status: (ctx) => ({ text: ctx.state.slow ? "Slow offset scan" : "Fast cursor/seek", cls: ctx.state.slow ? "warn" : "ok" }),
    },
    "cqrs-read-write-models": {
      note: "CQRS: commands mutate the write model; queries read the denormalized read model. Toggle projection lag to see eventual consistency.",
      toggles: [{ key: "lag", label: "Projection lagging", kind: "warn", value: false }],
      components: [
        { id: "client", x: 60, y: 250, w: 120, h: 56, title: "Client", color: C.client },
        { id: "cmdApi", x: 230, y: 150, w: 130, h: 56, title: "Command API", color: C.service },
        { id: "writeModel", x: 450, y: 150, w: 140, h: 56, title: "Write Model", color: C.ledger, kind: "db" },
        { id: "projector", x: 650, y: 250, w: 120, h: 56, title: "Projector", color: C.accent },
        { id: "queryApi", x: 230, y: 350, w: 130, h: 56, title: "Query API", color: C.service },
        { id: "readModel", x: 450, y: 350, w: 140, h: 56, title: "Read Model", color: C.ok, kind: "db" },
      ],
      initialValues: { writeModel: "order: PENDING", readModel: "summary: PENDING" },
      init(ctx) {
        ctx.state.pendingProjection = false;
        ctx.state.lastAction = null;
      },
      actions: [
        {
          id: "command",
          label: "POST /orders (command)",
          primary: true,
          flowKey: "command",
          onClick(ctx) {
            ctx.state.lastAction = "command";
            ctx.state.stale = false;
            if (ctx.toggles.lag) {
              ctx.state.pendingProjection = true;
            } else {
              ctx.state.pendingProjection = false;
            }
          },
        },
        {
          id: "query",
          label: "GET /summary (query)",
          flowKey: "query",
          onClick(ctx) {
            ctx.state.lastAction = "query";
            ctx.state.stale = ctx.toggles.lag && ctx.state.values.writeModel !== ctx.state.values.readModel;
          },
        },
      ],
      flows: {
        command: (ctx) => {
          const steps = [
            { from: "client", to: "cmdApi", color: C.service },
            {
              from: "cmdApi",
              to: "writeModel",
              color: C.service,
              set: { writeModel: "order: PAID" },
              onArrive(c) {
                c.state.pendingProjection = !!c.toggles.lag;
              },
            },
          ];
          if (!ctx.toggles.lag) {
            steps.push(
              { from: "writeModel", to: "projector", color: C.accent, dashed: true },
              {
                from: "projector",
                to: "readModel",
                color: C.accent,
                set: { readModel: "summary: PAID ✓" },
                onArrive(c) {
                  c.state.pendingProjection = false;
                },
              },
            );
          }
          return steps;
        },
        query: [
          { from: "client", to: "queryApi", color: C.ok },
          { from: "queryApi", to: "readModel", color: C.ok },
        ],
      },
      draw(ctx, d) {
        if (ctx.state.pendingProjection) {
          d.arrow(520, 206, 620, 250, { color: C.warn, dashed: true, label: "projection pending" });
        } else if (ctx.state.values.readModel === "summary: PAID ✓") {
          d.arrow(520, 206, 620, 250, { color: C.accent, label: "projected" });
        }
        d.text(340, 118, "write path", { size: 10, color: C.muted, align: "center" });
        d.text(340, 418, "read path", { size: 10, color: C.muted, align: "center" });
      },
      status: (ctx) => {
        const staleRead = ctx.state.lastAction === "query"
          && ctx.toggles.lag
          && ctx.state.values.writeModel !== ctx.state.values.readModel;
        if (staleRead || ctx.state.stale) return { text: "Stale read — projection has not caught up", cls: "warn" };
        if (ctx.state.pendingProjection) return { text: "Write model updated — read model projection lagging", cls: "warn" };
        if (ctx.state.lastAction === "query") return { text: "Query served from read model", cls: "ok" };
        if (ctx.state.lastAction === "command") return { text: "Command applied — read model projected", cls: "ok" };
        return { text: "Send a command or run a query", cls: "" };
      },
    },
    "event-sourcing-projection": {
      note: "Append domain events to the event store, then project into a query-optimized read model. Toggle projector lag to see stale reads.",
      toggles: [{ key: "lag", label: "Projector lagging", kind: "warn", value: false }],
      components: (() => {
        const [command, store, projector, readModel] = layoutRow(4, { y: 230, w: 120, h: 56, margin: 50 });
        return [
          { ...command, id: "command", title: "Command", color: C.client },
          { ...store, id: "store", title: "Event Store", color: C.ledger, kind: "db" },
          { ...projector, id: "projector", title: "Projector", color: C.accent },
          { ...readModel, id: "readModel", title: "Read Model", color: C.ok, kind: "db" },
        ];
      })(),
      initialValues: { store: "0 events", projector: "idle", readModel: "empty" },
      init(ctx) {
        ctx.state.eventCount = 0;
        ctx.state.projected = false;
        ctx.state.queried = false;
      },
      actions: [
        {
          id: "append",
          label: "1. Append event",
          primary: true,
          flowKey: "append",
          onClick(ctx) {
            ctx.state.eventCount += 1;
            ctx.state.projected = false;
            ctx.state.queried = false;
          },
        },
        {
          id: "project",
          label: "2. Project read model",
          flowKey: "project",
          disabled: (ctx) => ctx.state.eventCount === 0,
          onClick(ctx) {
            ctx.state.projected = !ctx.toggles.lag;
          },
        },
        {
          id: "query",
          label: "3. Query read model",
          flowKey: "query",
          disabled: (ctx) => !ctx.state.projected,
          onClick(ctx) {
            ctx.state.queried = true;
          },
        },
      ],
      flows: {
        append: [
          {
            from: "command",
            to: "store",
            set: { store: "evt appended" },
            onArrive(ctx) {
              ctx.state.values.store = `${ctx.state.eventCount} event(s)`;
            },
          },
        ],
        project: (ctx) => ctx.toggles.lag
          ? [
            { from: "store", to: "projector", color: C.warn, set: { projector: "catching up…" } },
          ]
          : [
            { from: "store", to: "projector", set: { projector: "reading stream" } },
            { from: "projector", to: "readModel", set: { projector: "idle", readModel: "OrderView ×47" } },
          ],
        query: [
          { from: "command", to: "readModel", color: C.ok },
        ],
      },
      draw(ctx, d) {
        if (ctx.state.eventCount > 0) {
          d.text(500, 120, `append-only log: ${ctx.state.values.store}`, { align: "center", size: 11, color: C.muted, mono: true });
        }
        if (ctx.toggles.lag && ctx.state.eventCount > 0 && !ctx.state.projected) {
          d.badge(500, 150, "projection lag — read model stale", { color: C.warn, align: "center" });
        }
      },
      status: (ctx) => {
        if (ctx.toggles.lag && ctx.state.eventCount > 0 && !ctx.state.projected) {
          return { text: "Projector lagging — read model not yet updated", cls: "warn" };
        }
        if (ctx.state.queried && ctx.state.projected) {
          return { text: "Query served from projected read model", cls: "ok" };
        }
        if (ctx.state.projected) {
          return { text: "Read model projected from event stream", cls: "ok" };
        }
        if (ctx.state.eventCount > 0) {
          return { text: "Event appended — run projector to update read model", cls: "" };
        }
        return { text: "Append a domain event to start the projection pipeline", cls: "" };
      },
    },
    "correlation-trace-ids": {
      note: "Propagate trace ID across services.",
      components: [
        { id: "edge", x: 100, y: 250, title: "Edge", color: C.client },
        { id: "svc", x: 400, y: 250, title: "Service", color: C.service },
        { id: "db", x: 700, y: 250, title: "DB", color: C.ledger, kind: "db" },
      ],
      initialValues: { edge: "trace-abc", svc: "—", db: "—" },
      actions: [{ id: "run", label: "Request", primary: true, onClick(ctx) { ctx.state.values.svc = "trace-abc"; ctx.state.values.db = "trace-abc"; } }],
      status: () => ({ text: "Trace ID propagated end-to-end", cls: "ok" }),
    },
    "competing-consumers": {
      note: "Parallel workers compete for messages on one queue — each job is delivered to exactly one consumer.",
      components: [
        { id: "producer", x: 70, y: 250, w: 120, title: "Producer", color: C.client },
        { id: "queue", x: 280, y: 250, w: 130, title: "Work Queue", color: C.queue },
        { id: "consumerA", x: 520, y: 140, w: 120, title: "Worker A", color: C.service },
        { id: "consumerB", x: 520, y: 250, w: 120, title: "Worker B", color: C.service },
        { id: "consumerC", x: 520, y: 310, w: 120, title: "Worker C", color: C.service },
      ],
      initialValues: { queue: "3 jobs", consumerA: "idle", consumerB: "idle", consumerC: "idle" },
      init(ctx) {
        ctx.state.pending = 3;
        ctx.state.nextConsumer = 0;
        ctx.state.jobNum = 0;
        ctx.state.consumers = ["consumerA", "consumerB", "consumerC"];
      },
      actions: [{
        id: "run",
        label: "Deliver job",
        primary: true,
        flowKey: "consumers",
        disabled: (ctx) => ctx.state.pending <= 0,
        onClick(ctx) {
          ctx.state.jobNum += 1;
          ctx.state.pending -= 1;
          ctx.state.target = ctx.state.consumers[ctx.state.nextConsumer % 3];
          ctx.state.nextConsumer += 1;
          ctx.state.values.queue = ctx.state.pending > 0 ? `${ctx.state.pending} jobs` : "empty";
          ctx.state.values[ctx.state.target] = `job #${ctx.state.jobNum} ✓`;
        },
      }],
      flows: {
        consumers: (ctx) => [{ from: "queue", to: ctx.state.target, color: C.accent }],
      },
      draw(ctx, d) {
        const queueX = 280 + 130;
        const queueMidY = 250 + 28;
        ctx.state.consumers.forEach((id) => {
          const active = id === ctx.state.target;
          const y = id === "consumerA" ? 168 : id === "consumerB" ? 278 : 388;
          d.arrow(queueX, queueMidY, 520, y, {
            color: active ? C.accent : C.faint,
            dashed: !active,
            alpha: active ? 1 : 0.35,
            label: active ? "won" : "",
          });
        });
        if (ctx.state.pending > 0) {
          d.text(345, 220, "competing for head", { align: "center", size: 10, color: C.muted });
        }
      },
      status: (ctx) => {
        if (ctx.state.pending <= 0 && ctx.state.jobNum > 0) {
          return { text: "All jobs consumed — each delivered to one competing worker", cls: "ok" };
        }
        if (ctx.state.target) {
          const name = ctx.state.target.replace("consumer", "Worker ");
          return { text: `${name} claimed job #${ctx.state.jobNum} from queue`, cls: "ok" };
        }
        return { text: "Click Deliver job — workers compete for the queue head", cls: "" };
      },
    },
    "process-manager": {
      note: "Order process manager: persisted state advances on each event. Toggle payment timeout for cancel path.",
      toggles: [{ key: "timeout", label: "Payment timeout", kind: "err", value: false }],
      components: [
        { id: "broker", x: 70, y: 250, w: 120, title: "Event bus", color: C.queue },
        { id: "pm", x: 280, y: 250, w: 150, title: "Process Manager", color: C.accent },
        { id: "payment", x: 520, y: 160, w: 120, title: "Payment", color: C.gateway },
        { id: "inventory", x: 520, y: 340, w: 120, title: "Inventory", color: C.service },
      ],
      initialValues: { pm: "AWAIT_PAYMENT", broker: "OrderPlaced", payment: "pending", inventory: "idle" },
      init(ctx) {
        ctx.state.phase = "await_payment";
      },
      actions: [
        {
          id: "paymentCaptured",
          label: "PaymentCaptured",
          primary: true,
          flowKey: "payment",
          disabled: (ctx) => ctx.state.phase !== "await_payment" || ctx.toggles.timeout,
          onClick(ctx) {
            ctx.state.phase = "await_stock";
            ctx.state.values.pm = "AWAIT_STOCK";
            ctx.state.values.payment = "captured ✓";
          },
        },
        {
          id: "stockReserved",
          label: "StockReserved",
          flowKey: "stock",
          disabled: (ctx) => ctx.state.phase !== "await_stock",
          onClick(ctx) {
            ctx.state.phase = "shipping";
            ctx.state.values.pm = "SHIPPING";
            ctx.state.values.inventory = "DispatchShipment ✓";
          },
        },
        {
          id: "timeout",
          label: "Timer fired",
          flowKey: "cancel",
          disabled: (ctx) => !ctx.toggles.timeout || ctx.state.phase === "cancelled" || ctx.state.phase === "shipping",
          onClick(ctx) {
            ctx.state.phase = "cancelled";
            ctx.state.values.pm = "CANCELLED";
            ctx.state.values.payment = "refunding";
          },
        },
      ],
      flows: {
        payment: [
          { from: "broker", to: "pm", color: C.accent, set: { pm: "AWAIT_STOCK" } },
          { from: "pm", to: "payment", color: C.ok, set: { payment: "captured ✓" } },
          { from: "pm", to: "inventory", color: C.service, set: { inventory: "ReserveStock" } },
        ],
        stock: [
          { from: "broker", to: "pm", color: C.accent, set: { pm: "SHIPPING" } },
          { from: "pm", to: "inventory", color: C.ok, set: { inventory: "DispatchShipment ✓" } },
        ],
        cancel: [
          { from: "pm", to: "payment", color: C.err, set: { payment: "refunding", pm: "CANCELLED" } },
        ],
      },
      draw(ctx, d) {
        const states = {
          await_payment: "AWAIT_PAYMENT",
          await_stock: "AWAIT_STOCK",
          shipping: "SHIPPING",
          cancelled: "CANCELLED",
        };
        d.badge(355, 190, states[ctx.state.phase] || ctx.state.values.pm, {
          color: ctx.state.phase === "cancelled" ? C.err : ctx.state.phase === "shipping" ? C.ok : C.accent,
          align: "center",
        });
        if (ctx.toggles.timeout && ctx.state.phase === "await_payment") {
          d.text(355, 400, "timer armed — payment window expiring", { align: "center", size: 10, color: C.warn });
        }
      },
      status: (ctx) => {
        const map = {
          await_payment: { text: "Awaiting PaymentCaptured event", cls: "" },
          await_stock: { text: "AWAIT_STOCK — ReserveStock dispatched", cls: "ok" },
          shipping: { text: "SHIPPING — workflow advancing", cls: "ok" },
          cancelled: { text: "CANCELLED — timeout triggered refund", cls: "err" },
        };
        return map[ctx.state.phase] || { text: "Process manager coordinating order workflow", cls: "" };
      },
    },
    "cap-theorem": {
      note: "Under network partition, CP sacrifices availability; AP sacrifices consistency. Toggle partition, then compare write paths.",
      toggles: [{ key: "partition", label: "Network partition", kind: "err", value: false }],
      components: [
        { id: "client", x: 80, y: 250, w: 110, title: "Client", color: C.client },
        { id: "cpA", x: 380, y: 170, w: 120, title: "CP Node A", color: C.ok, kind: "db" },
        { id: "cpB", x: 620, y: 170, w: 120, title: "CP Node B", color: C.ok, kind: "db" },
        { id: "apA", x: 380, y: 360, w: 120, title: "AP Node A", color: C.accent, kind: "db" },
        { id: "apB", x: 620, y: 360, w: 120, title: "AP Node B", color: C.accent, kind: "db" },
      ],
      initialValues: { client: "ready", cpA: "v=0", cpB: "v=0", apA: "v=0", apB: "v=0" },
      actions: [
        {
          id: "cpWrite", label: "CP write", primary: true, flowKey: "cp",
          onClick(ctx) {
            ctx.state.path = "cp";
            if (ctx.toggles.partition) {
              ctx.state.outcome = "cp-unavailable";
              ctx.state.values.cpA = "quorum wait…";
              ctx.state.values.cpB = "isolated";
            } else {
              ctx.state.outcome = "cp-ok";
              ctx.state.values.cpA = "v=1";
              ctx.state.values.cpB = "v=1";
            }
          },
        },
        {
          id: "apWrite", label: "AP write", flowKey: "ap",
          onClick(ctx) {
            ctx.state.path = "ap";
            if (ctx.toggles.partition) {
              ctx.state.outcome = "ap-divergent";
              ctx.state.values.apA = "v=1";
              ctx.state.values.apB = "v=0 stale";
            } else {
              ctx.state.outcome = "ap-ok";
              ctx.state.values.apA = "v=1";
              ctx.state.values.apB = "v=1";
            }
          },
        },
      ],
      flows: {
        cp: (ctx) => (ctx.toggles.partition
          ? [
            { from: "client", to: "cpA", set: { cpA: "quorum check…" } },
            { from: "cpA", to: "cpB", color: C.err, stale: true },
          ]
          : [
            { from: "client", to: "cpA", set: { cpA: "accept" } },
            { from: "cpA", to: "cpB", set: { cpB: "v=1" } },
            { from: "cpB", to: "client", color: C.ok, set: { client: "OK ✓" } },
          ]),
        ap: (ctx) => (ctx.toggles.partition
          ? [
            { from: "client", to: "apA", set: { apA: "v=1" } },
            { from: "apA", to: "apB", color: C.err, stale: true },
          ]
          : [
            { from: "client", to: "apA", set: { apA: "accept" } },
            { from: "apA", to: "apB", set: { apB: "v=1" } },
            { from: "apB", to: "client", color: C.ok, set: { client: "OK ✓" } },
          ]),
      },
      draw(ctx, d) {
        d.text(500, 130, "CP path — consistency", { align: "center", size: 11, color: C.ok });
        d.text(500, 430, "AP path — availability", { align: "center", size: 11, color: C.accent });
        if (ctx.toggles.partition) {
          d.badge(500, 248, "NETWORK PARTITION", { color: C.err, filled: true, align: "center" });
          [198, 388].forEach((y) => {
            d.arrow(500, y - 40, 500, y + 40, { color: C.err, dashed: true, head: false, width: 2 });
          });
        }
      },
      status: (ctx) => {
        const outcomes = {
          "cp-ok": { text: "CP: consistent write — both replicas v=1", cls: "ok" },
          "cp-unavailable": { text: "CP: unavailable — quorum lost under partition", cls: "err" },
          "ap-ok": { text: "AP: write accepted — replicas converging", cls: "ok" },
          "ap-divergent": { text: "AP: available — replicas diverged (v=1 vs v=0)", cls: "warn" },
        };
        return outcomes[ctx.state.outcome] || { text: "Toggle partition, then run CP or AP write", cls: "" };
      },
    },
  };

  if (MAP[topicId]) {
    const c = MAP[topicId];
    return {
      note: c.note,
      toggles: c.toggles || [],
      components: c.components,
      initialValues: c.initialValues || {},
      params: c.params || [],
      init: c.init,
      actions: c.actions,
      flows: c.flows,
      draw: c.draw,
      status: c.status || (() => ({ text: "Done", cls: "ok" })),
    };
  }

  return {
    note: `${title}: click to run. Toggle failure mode.`,
    toggles: [{ key: "fail", label: domainFailLabel(topicId), kind: "err", value: false }],
    ...clientSvcDb(title, titleCase(topicId)),
    initialValues: { db: "ready" },
    actions: [{
      id: "run", label: domainActionLabel(topicId), primary: true,
      flowKey: "flow",
      onClick(ctx) { ctx.state.failed = ctx.toggles.fail; },
    }],
    flows: {
      flow: (ctx) => ctx.toggles.fail
        ? [{ from: "client", to: "svc", color: C.err }]
        : [{ from: "client", to: "svc" }, { from: "svc", to: "db", set: { db: "updated" } }],
    },
    status: (ctx) => ({ text: ctx.state.failed ? domainFailStatus(topicId, title) : domainOkStatus(topicId, title), cls: ctx.state.failed ? "err" : "ok" }),
  };
}

function domainFailLabel(id) {
  if (id.includes("saga") || id.includes("outbox")) return "Downstream failure";
  if (id.includes("consistency") || id.includes("crdt")) return "Replica lag";
  return "Simulate failure";
}

function domainActionLabel(id) {
  if (id.includes("cdc") || id.includes("relay")) return "Relay event";
  if (id.includes("cqrs") || id.includes("projection")) return "Project read model";
  return "Run operation";
}

function domainFailStatus(id, title) {
  if (id.includes("cap")) return "Partition — availability sacrificed";
  return `${title} — operation failed`;
}

function domainOkStatus(id, title) {
  if (id.includes("http")) return "HTTP request complete";
  return `${title} — operation complete`;
}

// Fix clickFlow to support dynamic flows - the default above uses flow as function - need clickFlowLab update

export function buildStateConfig(topicId, title) {
  const MAP = {
    "two-pc": {
      note: "Two-phase commit: prepare then commit/abort.",
      initialState: "idle",
      states: [
        { id: "idle", label: "Idle", x: 150, color: C.muted, desc: "" },
        { id: "prepared", label: "Prepared", x: 400, color: C.warn, desc: "votes" },
        { id: "committed", label: "Committed", x: 650, color: C.ok, desc: "all yes" },
        { id: "aborted", label: "Aborted", x: 650, color: C.err, desc: "no vote" },
      ],
      transitions: [
        { id: "prepare", label: "Phase 1: Prepare", from: "idle", to: "prepared", primary: true },
        { id: "commit", label: "Phase 2: Commit", from: "prepared", to: "committed" },
        { id: "abort", label: "Phase 2: Abort", from: "prepared", to: "aborted" },
      ],
    },
    saga: {
      note: "Saga: forward steps with compensating transactions.",
      initialState: "s0",
      states: [
        { id: "s0", label: "Start", x: 150, color: C.ok },
        { id: "s1", label: "Reserved", x: 350, color: C.accent },
        { id: "s2", label: "Charged", x: 550, color: C.accent },
        { id: "s3", label: "Complete", x: 750, color: C.ok },
        { id: "comp", label: "Compensating", x: 550, color: C.err },
      ],
      transitions: [
        { id: "reserve", label: "Reserve", from: "s0", to: "s1", primary: true },
        { id: "charge", label: "Charge", from: "s1", to: "s2" },
        { id: "confirm", label: "Confirm", from: "s2", to: "s3" },
        { id: "fail", label: "Fail & compensate", from: "s2", to: "comp" },
      ],
    },
    optimistic: {
      note: "Optimistic concurrency: commit fails on version conflict.",
      toggles: [{ key: "conflict", label: "Concurrent writer", kind: "err", value: false }],
      initialState: "editing",
      states: [
        { id: "editing", label: "Editing", x: 250, color: C.accent },
        { id: "committed", label: "Committed", x: 550, color: C.ok },
        { id: "conflict", label: "Conflict", x: 550, color: C.err },
      ],
      transitions: [
        { id: "save", label: "Save", from: "editing", to: "committed", primary: true,
          onClick(ctx) { ctx.state.current = ctx.toggles.conflict ? "conflict" : "committed"; } },
      ],
    },
    bulkhead: {
      note: "Isolate thread pools — failure in one bulkhead must not drain others.",
      toggles: [{ key: "overload", label: "Bulkhead A overloaded", kind: "err", value: false }],
      initialState: "healthy",
      states: [
        { id: "healthy", label: "All pools OK", x: 200, color: C.ok },
        { id: "isolated", label: "A isolated", x: 500, color: C.warn },
        { id: "failed", label: "A exhausted", x: 500, color: C.err },
      ],
      transitions: [
        { id: "start", label: "Spike on A", from: "healthy", to: "isolated", primary: true,
          onClick(ctx) { ctx.state.current = ctx.toggles.overload ? "failed" : "isolated"; } },
      ],
    },
    "fail-fast": {
      note: "Reject early when dependency unhealthy.",
      toggles: [{ key: "degraded", label: "Dependency down", kind: "err", value: false }],
      initialState: "closed",
      states: [
        { id: "closed", label: "Serving", x: 250, color: C.ok },
        { id: "rejected", label: "Fail fast", x: 550, color: C.err },
      ],
      transitions: [
        { id: "start", label: "Incoming request", from: "closed", to: "rejected", primary: true,
          onClick(ctx) { if (!ctx.toggles.degraded) ctx.state.current = "closed"; } },
      ],
    },
    "graceful-degradation": {
      note: "Degrade non-critical features under load.",
      toggles: [{ key: "overload", label: "High load", kind: "warn", value: false }],
      initialState: "full",
      states: [
        { id: "full", label: "Full features", x: 250, color: C.ok },
        { id: "degraded", label: "Core only", x: 550, color: C.warn },
      ],
      transitions: [
        { id: "start", label: "Traffic spike", from: "full", to: "degraded", primary: true,
          onClick(ctx) { if (!ctx.toggles.overload) ctx.state.current = "full"; } },
      ],
    },
    "cascading-failure": {
      note: "Service A fails → retries overload B → C collapses. Click through each cascade step.",
      initialState: "healthy",
      states: [
        { id: "healthy", label: "Healthy", x: 120, color: C.ok, desc: "all services OK" },
        { id: "a-failed", label: "A down", x: 310, color: C.err, desc: "root failure" },
        { id: "b-overload", label: "B overloaded", x: 500, color: C.warn, desc: "retry storm" },
        { id: "c-failed", label: "C down", x: 690, color: C.err, desc: "cascade complete" },
      ],
      transitions: [
        { id: "fail-a", label: "Service A fails", from: "healthy", to: "a-failed", primary: true },
        { id: "overload-b", label: "Retries hit B", from: "a-failed", to: "b-overload" },
        { id: "fail-c", label: "B exhausts C", from: "b-overload", to: "c-failed" },
        { id: "recover", label: "Isolate & recover", from: "c-failed", to: "healthy" },
      ],
      draw(ctx, d) {
        const phase = ctx.state.current;
        const svcs = [
          { id: "a", title: "Service A", color: C.gateway },
          { id: "b", title: "Service B", color: C.service },
          { id: "c", title: "Service C", color: C.wallet },
        ];
        const y = 360;
        const statusFor = (id) => {
          if (id === "a") {
            return phase === "healthy"
              ? { sub: "OK", color: svcs[0].color }
              : { sub: "DOWN", color: C.err, active: true };
          }
          if (id === "b") {
            if (phase === "healthy" || phase === "a-failed") return { sub: "OK", color: svcs[1].color };
            return { sub: "overloaded", color: C.warn, active: true };
          }
          if (phase === "c-failed") return { sub: "DOWN", color: C.err, active: true };
          if (phase === "b-overload") return { sub: "stressed", color: C.warn };
          return { sub: "OK", color: svcs[2].color };
        };
        svcs.forEach((s, i) => {
          const x = 180 + i * 200;
          const st = statusFor(s.id);
          d.node(x, y, 120, 48, { title: s.title, color: st.color, sub: st.sub, active: st.active });
          if (i < svcs.length - 1) {
            const ax = x + 120;
            const stressed = phase === "b-overload" && i === 1;
            const broken = phase !== "healthy" && i === 0;
            d.arrow(ax + 4, y + 24, ax + 76, y + 24, {
              color: broken ? C.err : stressed ? C.warn : C.faint,
              dashed: broken || stressed,
              head: true,
              label: broken ? "timeouts" : stressed ? "retry storm" : "",
            });
          }
        });
        d.node(60, y + 4, 52, 40, { title: "Client", color: C.client });
        d.arrow(112, y + 24, 180, y + 24, { color: C.accent, head: true });
        if (phase === "a-failed") {
          d.badge(500, 300, "A down — callers retry into B", { color: C.err, filled: false, align: "center" });
        } else if (phase === "b-overload") {
          d.badge(500, 300, "B thread pool saturated — latency spikes", { color: C.warn, filled: false, align: "center" });
        } else if (phase === "c-failed") {
          d.badge(500, 300, "Full cascade — isolate with bulkheads & timeouts", { color: C.err, filled: true, align: "center" });
        }
      },
    },
    "partial-failure": {
      note: "One service fails — others keep serving until retries and timeouts amplify damage.",
      toggles: [
        { key: "failGateway", label: "Gateway down", kind: "err", value: false },
        { key: "failOrder", label: "Order Service down", kind: "err", value: false },
        { key: "failWallet", label: "Wallet down", kind: "warn", value: false },
        { key: "failLedger", label: "Ledger down", kind: "err", value: false },
      ],
      initialState: "healthy",
      states: [
        { id: "healthy", label: "Healthy", x: 150, color: C.ok, desc: "all services up" },
        { id: "degraded", label: "Degraded", x: 400, color: C.warn, desc: "partial outage" },
        { id: "failed", label: "Failed", x: 650, color: C.err, desc: "path unavailable" },
      ],
      transitions: [
        { id: "start", label: "Process charge", from: "healthy", primary: true,
          onClick(ctx) {
            const n = ["failGateway", "failOrder", "failWallet", "failLedger"].filter((k) => ctx.toggles[k]).length;
            if (n >= 2) ctx.state.current = "failed";
            else if (n >= 1) ctx.state.current = "degraded";
            else ctx.state.current = "healthy";
          } },
        { id: "cascade", label: "Retries amplify", from: "degraded", to: "failed" },
        { id: "recover", label: "Service restored", from: "degraded", to: "healthy" },
        { id: "recover-all", label: "Full recovery", from: "failed", to: "healthy" },
      ],
      draw(ctx, d) {
        const svcs = [
          { key: "failGateway", title: "Gateway", color: C.gateway },
          { key: "failOrder", title: "Order", color: C.service },
          { key: "failWallet", title: "Wallet", color: C.wallet },
          { key: "failLedger", title: "Ledger", color: C.ledger },
        ];
        const y = 360;
        svcs.forEach((s, i) => {
          const x = 80 + i * 170;
          const down = ctx.toggles[s.key];
          const stressed = ctx.state.current === "failed" && !down;
          d.node(x, y, 110, 44, {
            title: s.title,
            color: down ? C.err : stressed ? C.warn : s.color,
            sub: down ? "DOWN" : stressed ? "overloaded" : "OK",
            active: down,
          });
          if (i < svcs.length - 1) {
            const ax = x + 110;
            d.arrow(ax + 4, y + 22, ax + 56, y + 22, {
              color: down ? C.err : C.faint,
              dashed: down,
              head: true,
            });
          }
        });
        d.node(30, y + 6, 44, 32, { title: "Client", color: C.client });
        d.arrow(74, y + 22, 80, y + 22, { color: C.accent, head: true });
        if (ctx.state.current === "degraded") {
          const n = svcs.filter((s) => ctx.toggles[s.key]).length;
          d.badge(400, 300, `${n} service${n > 1 ? "s" : ""} down — partial outage`, {
            color: C.warn,
            filled: false,
            align: "center",
          });
        }
        if (ctx.state.current === "failed") {
          d.badge(400, 300, "Charge path unavailable", { color: C.err, filled: true, align: "center" });
        }
      },
    },
    acid: {
      note: "ACID transaction — all-or-nothing commit.",
      initialState: "active",
      states: [
        { id: "active", label: "In txn", x: 250, color: C.accent },
        { id: "committed", label: "Committed", x: 550, color: C.ok },
        { id: "rolled", label: "Rolled back", x: 550, color: C.err },
      ],
      transitions: [
        { id: "start", label: "Commit", from: "active", to: "committed", primary: true },
        { id: "finish", label: "Rollback", from: "active", to: "rolled" },
      ],
    },
    "isolation-levels": {
      note: "Pick an isolation level — each step up prevents more read anomalies.",
      initialState: "read-uncommitted",
      states: layoutStates([
        { id: "read-uncommitted", label: "Read Uncommitted", color: C.err, desc: "weakest" },
        { id: "repeatable-read", label: "Repeatable Read", color: C.warn, desc: "snapshot" },
        { id: "serializable", label: "Serializable", color: C.ok, desc: "strongest" },
      ], 200),
      transitions: [
        { id: "ru", label: "Read Uncommitted", to: "read-uncommitted", primary: true },
        { id: "rr", label: "Repeatable Read", to: "repeatable-read" },
        { id: "ser", label: "Serializable", to: "serializable" },
      ],
      draw(ctx, d) {
        const anomalies = [
          { id: "dirty", label: "Dirty read" },
          { id: "nonrepeat", label: "Non-repeatable read" },
          { id: "phantom", label: "Phantom read" },
        ];
        const prevented = {
          "read-uncommitted": new Set(),
          "repeatable-read": new Set(["dirty", "nonrepeat"]),
          "serializable": new Set(["dirty", "nonrepeat", "phantom"]),
        }[ctx.state.current] || new Set();

        d.text(500, 340, "Anomalies at this level", { size: 12, align: "center", color: C.muted });
        anomalies.forEach((a, i) => {
          const blocked = prevented.has(a.id);
          const x = 250 + i * 250;
          d.badge(x, 372, a.label, { color: blocked ? C.ok : C.err, align: "center", filled: blocked });
          d.text(x, 400, blocked ? "prevented" : "possible", { size: 10, align: "center", color: blocked ? C.ok : C.err });
        });
      },
      status(ctx) {
        const labels = {
          "read-uncommitted": "Read Uncommitted",
          "repeatable-read": "Repeatable Read",
          serializable: "Serializable",
        };
        const allowed = {
          "read-uncommitted": "dirty, non-repeatable, phantom reads possible",
          "repeatable-read": "phantom reads still possible",
          serializable: "all read anomalies prevented",
        };
        const cls = {
          "read-uncommitted": "err",
          "repeatable-read": "warn",
          serializable: "ok",
        };
        return {
          text: `${labels[ctx.state.current]} — ${allowed[ctx.state.current]}`,
          cls: cls[ctx.state.current] || "warn",
        };
      },
    },
    pessimistic: {
      note: "Pessimistic lock — hold lock for transaction duration.",
      toggles: [{ key: "contention", label: "Lock contention", kind: "warn", value: false }],
      initialState: "waiting",
      states: [
        { id: "waiting", label: "Waiting", color: C.warn },
        { id: "locked", label: "Locked", color: C.accent },
        { id: "done", label: "Released", color: C.ok },
      ],
      transitions: [
        { id: "start", label: "Acquire lock", from: "waiting", to: "locked", primary: true,
          onClick(ctx) { if (ctx.toggles.contention) ctx.state.current = "waiting"; } },
        { id: "finish", label: "Release", from: "locked", to: "done" },
      ],
    },
    "quorum-reads-writes": {
      note: "Quorum reads/writes — R + W > N guarantees read/write overlap. Toggle a replica down and compare W vs R outcomes.",
      toggles: [{ key: "replicaDown", label: "Replica R2 down", kind: "err", value: false }],
      params: [
        { key: "W", label: "Write quorum (W)", min: 1, max: 3, step: 1, value: 2 },
        { key: "R", label: "Read quorum (R)", min: 1, max: 3, step: 1, value: 2 },
      ],
      init(ctx) { ctx.state.N = 3; },
      initialState: "idle",
      states: [
        { id: "idle", label: "Ready", x: 120, y: 76, color: C.muted, desc: "N=3 replicas" },
        { id: "write_ok", label: "Write quorum met", x: 360, y: 28, color: C.ok, desc: "W acks" },
        { id: "write_fail", label: "Write quorum lost", x: 360, y: 100, color: C.err, desc: "W short" },
        { id: "read_ok", label: "Read quorum met", x: 600, y: 28, color: C.ok, desc: "R overlap" },
        { id: "read_fail", label: "Read quorum lost", x: 600, y: 100, color: C.err, desc: "R short" },
      ],
      transitions: [
        { id: "write", label: "Write (W quorum)", from: "idle", to: "write_ok", primary: true,
          onClick(ctx) {
            const alive = ctx.toggles.replicaDown ? 2 : 3;
            ctx.state.current = alive >= ctx.params.W ? "write_ok" : "write_fail";
          } },
        { id: "read", label: "Read (R quorum)", from: "idle", to: "read_ok",
          onClick(ctx) {
            const alive = ctx.toggles.replicaDown ? 2 : 3;
            ctx.state.current = alive >= ctx.params.R ? "read_ok" : "read_fail";
          } },
        { id: "reset", label: "Reset", to: "idle",
          onClick(ctx) { ctx.state.current = "idle"; } },
      ],
      draw(ctx, d) {
        const N = ctx.state.N ?? 3;
        const W = ctx.params.W ?? 2;
        const R = ctx.params.R ?? 2;
        const alive = ctx.toggles.replicaDown ? 2 : 3;
        const overlap = W + R > N;
        const ring = { cx: 500, cy: 350, r: 130 };

        const c = d.ctx;
        c.save();
        c.strokeStyle = C.faint;
        c.lineWidth = 2;
        c.setLineDash([7, 6]);
        c.beginPath();
        c.arc(ring.cx, ring.cy, ring.r, 0, Math.PI * 2);
        c.stroke();
        c.restore();

        d.badge(500, 178, `N=${N}  W=${W}  R=${R}  R+W ${overlap ? ">" : "≤"} N`, {
          color: overlap ? C.ok : C.warn,
          filled: false,
          align: "center",
        });

        d.node(ring.cx - 60, ring.cy - 24, 120, 48, { title: "Leader", color: C.ok, active: true });

        const replicaAngles = [-90, 30, 150];
        const replicas = [
          { id: "R1", down: false },
          { id: "R2", down: ctx.toggles.replicaDown },
          { id: "R3", down: false },
        ];

        replicas.forEach((rep, i) => {
          const a = (replicaAngles[i] * Math.PI) / 180;
          const x = ring.cx + ring.r * Math.cos(a) - 50;
          const y = ring.cy + ring.r * Math.sin(a) - 22;
          d.node(x, y, 100, 44, {
            title: rep.id,
            color: rep.down ? C.err : C.service,
            sub: rep.down ? "DOWN" : "replica",
            active: !rep.down,
          });
          rep.x = x + 50;
          rep.y = y + 22;
        });

        const inWrite = ctx.state.current === "write_ok" || ctx.state.current === "write_fail";
        const inRead = ctx.state.current === "read_ok" || ctx.state.current === "read_fail";
        const writeOk = ctx.state.current === "write_ok";
        const readOk = ctx.state.current === "read_ok";

        if (inWrite) {
          replicas.forEach((rep) => {
            if (!rep.down) {
              d.arrow(ring.cx, ring.cy + 24, rep.x, rep.y, {
                color: writeOk ? C.accent : C.err,
                label: "write",
                dashed: true,
              });
            }
          });
          d.badge(680, 250, writeOk ? `${Math.min(alive, W)}/${W} write acks` : `Only ${alive}/${W} acks`, {
            color: writeOk ? C.ok : C.err,
            align: "center",
          });
        }

        if (inRead) {
          replicas.forEach((rep) => {
            if (!rep.down) {
              d.arrow(rep.x, rep.y, ring.cx, ring.cy - 24, {
                color: readOk ? C.ledger : C.err,
                label: "read",
                dashed: true,
              });
            }
          });
          d.badge(680, 250, readOk ? `${Math.min(alive, R)}/${R} read votes` : `Only ${alive}/${R} votes`, {
            color: readOk ? C.ok : C.err,
            align: "center",
          });
        }

        if (ctx.toggles.replicaDown) {
          d.badge(500, 200, `${alive}/${N} replicas alive`, { color: C.warn, filled: true, align: "center" });
        }
      },
    },
    "consensus-raft-paxos": {
      note: "Raft consensus — elect leader, replicate log entry to quorum on the cluster ring.",
      toggles: [{ key: "partition", label: "Network partition", kind: "err", value: false }],
      initialState: "follower",
      states: [
        { id: "follower", label: "Follower", x: 70, y: 76, color: C.muted, desc: "awaiting leader" },
        { id: "candidate", label: "Candidate", x: 300, y: 76, color: C.warn, desc: "election" },
        { id: "leader", label: "Leader", x: 530, y: 76, color: C.ok, desc: "replicating" },
        { id: "committed", label: "Committed", x: 760, y: 76, color: C.accent, desc: "quorum ack" },
      ],
      transitions: [
        { id: "start", label: "Start election", from: "follower", to: "candidate", primary: true },
        { id: "finish", label: "Become leader", from: "candidate", to: "leader" },
        { id: "replicate", label: "Replicate entry", from: "leader",
          onClick(ctx) { ctx.state.current = ctx.toggles.partition ? "leader" : "committed"; } },
      ],
      draw(ctx, d) {
        const ring = { cx: 500, cy: 320, r: 150 };
        const nodeAngles = [-90, -18, 54, 126, 198];
        const labels = ["F1", "F2", "F3", "F4", "F5"];
        const inElection = ctx.state.current === "candidate";
        const hasLeader = ctx.state.current === "leader" || ctx.state.current === "committed";
        const isPartitioned = ctx.toggles.partition;
        const leaderIdx = hasLeader ? 0 : inElection ? 0 : null;

        const c = d.ctx;
        c.save();
        c.strokeStyle = C.faint;
        c.lineWidth = 2;
        c.setLineDash([7, 6]);
        c.beginPath();
        c.arc(ring.cx, ring.cy, ring.r, 0, Math.PI * 2);
        c.stroke();
        c.restore();

        if (isPartitioned) {
          c.save();
          c.strokeStyle = C.err;
          c.lineWidth = 2;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.moveTo(ring.cx, ring.cy - ring.r - 20);
          c.lineTo(ring.cx, ring.cy + ring.r + 20);
          c.stroke();
          c.restore();
        }

        labels.forEach((label, i) => {
          const a = (nodeAngles[i] * Math.PI) / 180;
          const x = ring.cx + ring.r * Math.cos(a) - 50;
          const y = ring.cy + ring.r * Math.sin(a) - 22;
          const isLeader = leaderIdx === i;
          d.node(x, y, 100, 44, {
            title: isLeader ? (inElection ? "Candidate" : "Leader") : label,
            color: isLeader ? (inElection ? C.warn : C.ok) : C.service,
            sub: isLeader ? "elected" : "follower",
            active: isLeader,
          });
          if (isLeader && (hasLeader || inElection)) {
            const replicateColor = isPartitioned ? C.err : C.accent;
            for (let j = 1; j < labels.length; j++) {
              const ja = (nodeAngles[j] * Math.PI) / 180;
              const tx = ring.cx + ring.r * Math.cos(ja);
              const ty = ring.cy + ring.r * Math.sin(ja);
              d.arrow(ring.cx, ring.cy, tx, ty, {
                color: replicateColor,
                label: inElection ? "RequestVote" : "AppendEntries",
                dashed: true,
              });
            }
          }
        });

        if (ctx.state.current === "committed" && !isPartitioned) {
          d.badge(500, 430, "Quorum ack — entry committed", { color: C.ok, filled: false, align: "center" });
        }
        if (isPartitioned) {
          d.badge(500, 170, "PARTITION — replication blocked", { color: C.err, filled: true, align: "center" });
        }
      },
    },
    brownout: {
      note: "Brownout — system runs at reduced capacity instead of full outage.",
      toggles: [{ key: "overload", label: "Power/capacity limit", kind: "warn", value: false }],
      initialState: "normal",
      states: [
        { id: "normal", label: "Full capacity", x: 200, color: C.ok },
        { id: "brownout", label: "Brownout", x: 500, color: C.warn },
        { id: "blackout", label: "Blackout", x: 500, color: C.err },
      ],
      transitions: [
        { id: "start", label: "Load spike", from: "normal", to: "brownout", primary: true,
          onClick(ctx) { ctx.state.current = ctx.toggles.overload ? "blackout" : "brownout"; } },
        { id: "recover", label: "Capacity restored", from: "brownout", to: "normal" },
      ],
    },
    "cap-theorem-framing": {
      note: "CAP framing — under partition, choose consistency (CP) or availability (AP).",
      toggles: [{ key: "partition", label: "Network partition", kind: "err", value: false }],
      initialState: "normal",
      states: [
        { id: "normal", label: "No partition", x: 200, color: C.ok },
        { id: "cp", label: "CP choice", x: 500, y: 40, color: C.accent },
        { id: "ap", label: "AP choice", x: 500, y: 120, color: C.warn },
      ],
      transitions: [
        { id: "cp", label: "Choose CP", from: "normal", to: "cp", primary: true,
          onClick(ctx) { if (ctx.toggles.partition) ctx.state.current = "cp"; } },
        { id: "ap", label: "Choose AP", from: "normal", to: "ap",
          onClick(ctx) { if (ctx.toggles.partition) ctx.state.current = "ap"; } },
      ],
    },
    pacelc: {
      note: "PACELC — if Partition then A vs C; else Latency vs Consistency.",
      toggles: [{ key: "partition", label: "Partition", kind: "err", value: false }],
      initialState: "steady",
      states: [
        { id: "steady", label: "No partition", x: 180, color: C.ok },
        { id: "latency", label: "Latency tradeoff", x: 480, y: 36, color: C.warn },
        { id: "consistency", label: "Consistency tradeoff", x: 480, y: 112, color: C.accent },
        { id: "available", label: "Availability", x: 480, y: 188, color: C.ok },
      ],
      transitions: [
        { id: "lat", label: "Favor latency", from: "steady", to: "latency", primary: true },
        { id: "cons", label: "Favor consistency", from: "steady", to: "consistency" },
        { id: "avail", label: "Under partition: availability", from: "steady", to: "available",
          onClick(ctx) { if (!ctx.toggles.partition) ctx.state.current = "steady"; } },
      ],
    },
    "three-pc": {
      note: "Three-phase commit adds a pre-commit phase to reduce blocking.",
      initialState: "idle",
      states: [
        { id: "idle", label: "Idle", x: 120, color: C.muted },
        { id: "canCommit", label: "CanCommit", x: 320, color: C.warn },
        { id: "preCommit", label: "PreCommit", x: 520, color: C.accent },
        { id: "committed", label: "DoCommit", x: 720, color: C.ok },
        { id: "aborted", label: "Abort", x: 720, color: C.err },
      ],
      transitions: [
        { id: "prepare", label: "Phase 1: CanCommit?", from: "idle", to: "canCommit", primary: true },
        { id: "pre", label: "Phase 2: PreCommit", from: "canCommit", to: "preCommit" },
        { id: "commit", label: "Phase 3: DoCommit", from: "preCommit", to: "committed" },
        { id: "abort", label: "Abort", from: "canCommit", to: "aborted" },
      ],
    },
    tcc: {
      note: "Try-Confirm-Cancel — reserve, confirm, or cancel resources.",
      initialState: "try",
      states: [
        { id: "try", label: "Try", x: 180, color: C.warn },
        { id: "confirm", label: "Confirm", x: 420, color: C.ok },
        { id: "cancel", label: "Cancel", x: 420, color: C.err },
      ],
      transitions: [
        { id: "try", label: "Try reserve", from: "try", to: "confirm", primary: true },
        { id: "fail", label: "Cancel", from: "try", to: "cancel" },
      ],
    },
    hybrid: {
      note: "Hybrid locking — optimistic read, escalate to pessimistic on conflict.",
      toggles: [{ key: "conflict", label: "Write conflict", kind: "err", value: false }],
      initialState: "optimistic",
      states: [
        { id: "optimistic", label: "Optimistic read", x: 200, color: C.accent },
        { id: "pessimistic", label: "Pessimistic lock", x: 500, color: C.warn },
        { id: "committed", label: "Committed", x: 500, color: C.ok },
      ],
      transitions: [
        { id: "read", label: "Read (optimistic)", from: "optimistic", to: "optimistic", primary: true },
        { id: "escalate", label: "Conflict → lock", from: "optimistic", to: "pessimistic",
          onClick(ctx) { if (!ctx.toggles.conflict) ctx.state.current = "optimistic"; } },
        { id: "commit", label: "Commit", from: "pessimistic", to: "committed" },
      ],
    },
    "state-transition": {
      note: "Finite state machine — valid transitions only.",
      initialState: "draft",
      states: [
        { id: "draft", label: "Draft", x: 150, color: C.muted },
        { id: "review", label: "In Review", x: 350, color: C.warn },
        { id: "approved", label: "Approved", x: 550, color: C.ok },
        { id: "rejected", label: "Rejected", x: 550, color: C.err },
      ],
      transitions: [
        { id: "submit", label: "Submit", from: "draft", to: "review", primary: true },
        { id: "approve", label: "Approve", from: "review", to: "approved" },
        { id: "reject", label: "Reject", from: "review", to: "rejected" },
      ],
    },
  };

  if (MAP[topicId]) return { note: MAP[topicId].note, ...MAP[topicId] };

  return {
    note: `${title}: advance through states.`,
    initialState: "s0",
    states: [
      { id: "s0", label: "Initial", x: 250, color: C.ok },
      { id: "s1", label: "Active", x: 500, color: C.accent },
      { id: "s2", label: "Done", x: 750, color: C.ledger },
    ],
    transitions: [
      { id: "start", label: "Start", from: "s0", to: "s1", primary: true },
      { id: "finish", label: "Complete", from: "s1", to: "s2" },
    ],
  };
}

/** Consistent-hash ring layout (1000×560 stage). Angles: 0° = top, clockwise. */
const HASH_RING = { cx: 500, cy: 285, r: 165 };
const HASH_NODE_ANGLES = { A: 30, B: 150, C: 270, D: 90 };
const HASH_NODE_COLORS = { A: C.accent, B: C.service, C: C.ledger, D: C.queue };
const HASH_SAMPLE_KEYS = [
  { id: "user:42", angle: 45 },
  { id: "order:9", angle: 180 },
  { id: "cart:7", angle: 300 },
];

function hashRingXY(angleDeg, offset = 0) {
  const rad = (angleDeg * Math.PI) / 180;
  const r = HASH_RING.r + offset;
  return { x: HASH_RING.cx + r * Math.sin(rad), y: HASH_RING.cy - r * Math.cos(rad) };
}

const VNODE_SPREAD = 14;

function hashRingBuildVnodes(nodes, vnodeCounts) {
  const vnodes = [];
  for (const n of nodes) {
    const count = Math.max(1, vnodeCounts[n] || 1);
    const base = HASH_NODE_ANGLES[n];
    if (base == null) continue;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * VNODE_SPREAD;
      const angle = ((base + offset) % 360 + 360) % 360;
      vnodes.push({ id: `${n}#${i}`, physical: n, index: i, angle });
    }
  }
  return vnodes.sort((a, b) => a.angle - b.angle);
}

function hashRingOwnerVnode(vnodes, keyAngle) {
  if (!vnodes.length) return null;
  const hit = vnodes.find((v) => v.angle >= keyAngle);
  return hit || vnodes[0];
}

function hashRingAssignmentsFromVnodes(vnodes) {
  const out = {};
  for (const k of HASH_SAMPLE_KEYS) {
    const v = hashRingOwnerVnode(vnodes, k.angle);
    out[k.id] = v ? v.physical : null;
    out[`${k.id}::vnode`] = v ? v.id : null;
  }
  return out;
}

function hashRingInitState(ctx, nodes = ["A", "B", "C"]) {
  ctx.state.nodes = nodes;
  ctx.state.vnodeCounts = Object.fromEntries(nodes.map((n) => [n, 1]));
  ctx.state.vnodes = hashRingBuildVnodes(nodes, ctx.state.vnodeCounts);
  ctx.state.assignments = hashRingAssignmentsFromVnodes(ctx.state.vnodes);
  ctx.state.prevAssignments = null;
  ctx.state.remappedKeys = [];
}

function hashRingApplyVnodes(ctx) {
  const prev = { ...ctx.state.assignments };
  ctx.state.vnodes = hashRingBuildVnodes(ctx.state.nodes, ctx.state.vnodeCounts);
  const next = hashRingAssignmentsFromVnodes(ctx.state.vnodes);
  ctx.state.prevAssignments = prev;
  ctx.state.assignments = next;
  ctx.state.remappedKeys = HASH_SAMPLE_KEYS
    .map((k) => k.id)
    .filter((id) => prev[id] && next[id] && prev[id] !== next[id]);
}

function hashRingAddVnode(ctx, node) {
  if (!ctx.state.nodes.includes(node)) return;
  ctx.state.vnodeCounts[node] = (ctx.state.vnodeCounts[node] || 1) + 1;
  hashRingApplyVnodes(ctx);
}

function hashRingApplyNodes(ctx, nodes) {
  const prevCounts = { ...ctx.state.vnodeCounts };
  ctx.state.nodes = nodes;
  ctx.state.vnodeCounts = Object.fromEntries(nodes.map((n) => [n, prevCounts[n] || 1]));
  hashRingApplyVnodes(ctx);
}

function hashRingDrawRing(d) {
  const c = d.ctx;
  c.save();
  c.strokeStyle = C.faint;
  c.lineWidth = 2;
  c.setLineDash([7, 6]);
  c.beginPath();
  c.arc(HASH_RING.cx, HASH_RING.cy, HASH_RING.r, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  d.text(HASH_RING.cx, HASH_RING.cy, "hash ring", { size: 12, align: "center", color: C.faint });
}

function hashRingDraw(ctx, d) {
  hashRingDrawRing(d);
  const remapped = new Set(ctx.state.remappedKeys || []);
  const vnodes = ctx.state.vnodes || [];

  for (const v of vnodes) {
    const on = hashRingXY(v.angle);
    const label = hashRingXY(v.angle, 38);
    const color = HASH_NODE_COLORS[v.physical] || C.accent;
    d.token(on.x, on.y, { r: vnodes.length > 6 ? 9 : 11, color, text: v.id.split("#")[1] ?? "", glow: true });
    d.text(label.x, label.y, v.id, { size: 10, align: "center", color });
  }

  for (const n of ctx.state.nodes) {
    const a = HASH_NODE_ANGLES[n];
    if (a == null) continue;
    const label = hashRingXY(a, 58);
    d.text(label.x, label.y, `Node ${n} (${ctx.state.vnodeCounts[n] || 1} vnode${(ctx.state.vnodeCounts[n] || 1) > 1 ? "s" : ""})`, {
      size: 11, align: "center", weight: 700, color: HASH_NODE_COLORS[n] || C.accent,
    });
  }

  for (const k of HASH_SAMPLE_KEYS) {
    const owner = ctx.state.assignments?.[k.id];
    const vnodeId = ctx.state.assignments?.[`${k.id}::vnode`];
    const v = vnodes.find((vn) => vn.id === vnodeId);
    const kp = hashRingXY(k.angle, -12);
    const moved = remapped.has(k.id);
    d.token(kp.x, kp.y, { r: 8, color: moved ? C.warn : C.client, label: k.id, glow: moved });

    if (v) {
      const np = hashRingXY(v.angle);
      d.curve(kp.x, kp.y, np.x, np.y, {
        color: moved ? C.warn : withAlpha(C.muted, 0.7),
        width: moved ? 2.5 : 1.5,
        dashed: moved,
        bend: 0.15,
      });
      const prevOwner = ctx.state.prevAssignments?.[k.id];
      if (moved && prevOwner && HASH_NODE_ANGLES[prevOwner] != null) {
        const pp = hashRingXY(HASH_NODE_ANGLES[prevOwner]);
        d.curve(kp.x, kp.y, pp.x, pp.y, { color: withAlpha(C.err, 0.5), width: 1.2, dashed: true, bend: -0.2, alpha: 0.55 });
      }
    }
  }

  d.text(500, 48, "Keys map to clockwise nearest virtual node on ring", { size: 13, align: "center", color: C.muted });
  if (remapped.size) {
    d.badge(500, 440, `${remapped.size} key(s) remapped`, { color: C.warn, filled: false, align: "center" });
  }
}

function hashRingLabConfig(note) {
  return {
    note,
    init(ctx) { hashRingInitState(ctx); },
    actions: [
      {
        id: "addVnode",
        label: "Add vnode to C",
        primary: true,
        onClick(ctx) { hashRingAddVnode(ctx, "C"); },
      },
      {
        id: "add",
        label: "Add physical node D",
        onClick(ctx) {
          if (ctx.state.nodes.includes("D")) return;
          hashRingApplyNodes(ctx, [...ctx.state.nodes, "D"]);
        },
      },
      {
        id: "remove",
        label: "Remove node B",
        onClick(ctx) {
          if (!ctx.state.nodes.includes("B")) return;
          hashRingApplyNodes(ctx, ctx.state.nodes.filter((n) => n !== "B"));
        },
      },
    ],
    draw(ctx, d) { hashRingDraw(ctx, d); },
    status(ctx) {
      const n = ctx.state.remappedKeys?.length || 0;
      const totalVnodes = (ctx.state.vnodes || []).length;
      if (n) return { text: `${n} key(s) remapped — ${totalVnodes} vnodes on ring`, cls: "ok" };
      const summary = HASH_SAMPLE_KEYS
        .map((k) => `${k.id.split(":")[0]}→${ctx.state.assignments?.[k.id] ?? "?"}`)
        .join(" · ");
      return { text: `${totalVnodes} vnodes · ${summary}`, cls: "ok" };
    },
  };
}

export function buildAlgorithmConfig(topicId, title) {
  const MAP = {
    "consistent-hashing": hashRingLabConfig(
      "Virtual nodes spread load on the ring. Add vnodes to rebalance without new hardware, or add/remove physical nodes.",
    ),
    "consistent-hashing-placement": hashRingLabConfig(
      "Placement on the ring — each physical node owns multiple virtual nodes. Add a vnode to shift key ranges smoothly.",
    ),
    "lamport-clock": {
      note: "Send event — Lamport clock increments.",
      init(ctx) { ctx.state.clocks = { A: 1, B: 1 }; },
      actions: [{ id: "send", label: "A → B message", primary: true, onClick(ctx) { ctx.state.clocks.A += 1; ctx.state.clocks.B = Math.max(ctx.state.clocks.B, ctx.state.clocks.A) + 1; } }],
      draw(ctx, d) {
        d.node(200, 200, 100, 50, { title: "A", value: `L=${ctx.state.clocks.A}` });
        d.node(400, 200, 100, 50, { title: "B", value: `L=${ctx.state.clocks.B}` });
      },
      status: (ctx) => ({ text: `Clocks A=${ctx.state.clocks.A} B=${ctx.state.clocks.B}`, cls: "ok" }),
    },
    "vector-clock": {
      note: "Concurrent events — vector clocks diverge then merge.",
      init(ctx) { ctx.state.vectors = { A: [1, 0], B: [0, 1] }; },
      actions: [{ id: "merge", label: "Sync", primary: true, onClick(ctx) { const max = Math.max(ctx.state.vectors.A[0], ctx.state.vectors.B[0]); ctx.state.vectors.A = [max + 1, ctx.state.vectors.B[1]]; ctx.state.vectors.B = [ctx.state.vectors.A[0], max + 1]; } }],
      draw(ctx, d) {
        d.node(200, 200, 120, 50, { title: "A", value: `[${ctx.state.vectors.A}]` });
        d.node(400, 200, 120, 50, { title: "B", value: `[${ctx.state.vectors.B}]` });
      },
      status: (ctx) => ({ text: `Merged vectors`, cls: "ok" }),
    },
    "hot-partition": {
      note: "Skewed key — one partition overloaded.",
      toggles: [{ key: "skew", label: "Hot key traffic", kind: "err", value: false }],
      init(ctx) { ctx.state.loads = { P1: 30, P2: 30, P3: 30 }; },
      actions: [{ id: "load", label: "Send traffic", primary: true, onClick(ctx) { if (ctx.toggles.skew) ctx.state.loads.P1 += 40; else { ctx.state.loads.P1 += 10; ctx.state.loads.P2 += 10; ctx.state.loads.P3 += 10; } } }],
      draw(ctx, d) {
        Object.entries(ctx.state.loads).forEach(([p, load], i) => d.node(150 + i * 130, 200, 100, 50, { title: p, value: `${load}%`, color: load > 60 ? C.err : C.accent }));
      },
      status: (ctx) => ({ text: ctx.state.loads.P1 > 60 ? "Hot partition P1 overloaded" : "Balanced load", cls: ctx.state.loads.P1 > 60 ? "err" : "ok" }),
    },
    "lru-cache": {
      note: "Access keys — LRU evicts least-recently-used when full.",
      init(ctx) { ctx.state.capacity = 3; ctx.state.order = []; ctx.state.map = {}; },
      actions: ["A", "B", "C", "D"].map((k, i) => ({
        id: `key-${k}`, label: `get(${k})`, primary: i === 0,
        onClick(ctx) {
          if (ctx.state.map[k] !== undefined) {
            ctx.state.order = ctx.state.order.filter((x) => x !== k);
            ctx.state.order.push(k);
          } else {
            if (ctx.state.order.length >= ctx.state.capacity) {
              const evict = ctx.state.order.shift();
              delete ctx.state.map[evict];
              ctx.state.lastEvict = evict;
            }
            ctx.state.map[k] = true;
            ctx.state.order.push(k);
          }
        },
      })),
      draw(ctx, d) {
        ctx.state.order.forEach((key, i) => d.node(200 + i * 120, 200, 90, 44, { title: key, color: i === ctx.state.order.length - 1 ? C.accent : C.service }));
      },
      status: (ctx) => ({ text: `Cache: [${ctx.state.order.join(", ")}]`, cls: "ok" }),
    },
    "shard-rebalancing": {
      note: "Add node — keys migrate between shards.",
      init(ctx) { ctx.state.shards = ["S1", "S2", "S3"]; },
      actions: [
        { id: "add", label: "Add shard S4", primary: true, onClick(ctx) { if (!ctx.state.shards.includes("S4")) ctx.state.shards.push("S4"); ctx.state.moved = true; } },
      ],
      draw(ctx, d) { ctx.state.shards.forEach((s, i) => d.node(120 + i * 110, 200, 90, 44, { title: s, color: C.accent })); },
      status: (ctx) => ({ text: ctx.state.moved ? "Keys rebalanced across shards" : `${ctx.state.shards.length} shards`, cls: "ok" }),
    },
    "clock-skew": {
      note: "Skewed clocks cause ordering surprises.",
      toggles: [{ key: "skew", label: "Clock skew", kind: "err", value: false }],
      init(ctx) { ctx.state.clocks = { A: 100, B: 95 }; },
      actions: [{ id: "add", label: "Event at A", primary: true, onClick(ctx) { ctx.state.clocks.A += 1; if (ctx.toggles.skew) ctx.state.orderWrong = ctx.state.clocks.B > ctx.state.clocks.A; } }],
      draw(ctx, d) {
        d.node(200, 200, 100, 50, { title: "Node A", value: `t=${ctx.state.clocks.A}` });
        d.node(400, 200, 100, 50, { title: "Node B", value: `t=${ctx.state.clocks.B}` });
      },
      status: (ctx) => ({ text: ctx.state.orderWrong ? "Skew broke causal ordering" : "Timestamps consistent", cls: ctx.state.orderWrong ? "err" : "ok" }),
    },
    "split-brain": {
      note: "Network partition splits cluster — two nodes both believe they are primary.",
      toggles: [{ key: "partition", label: "Network partition", kind: "err", value: false }],
      init(ctx) { ctx.state.leaders = { A: false, B: false }; },
      actions: [{ id: "elect", label: "Trigger election", primary: true, onClick(ctx) {
        if (ctx.toggles.partition) { ctx.state.leaders.A = true; ctx.state.leaders.B = true; ctx.state.split = true; }
        else { ctx.state.leaders.A = true; ctx.state.leaders.B = false; }
      } }],
      draw(ctx, d) {
        d.node(200, 200, 120, 50, { title: "Node A", value: ctx.state.leaders.A ? "LEADER" : "follower", color: ctx.state.leaders.A ? C.ok : C.muted });
        d.node(480, 200, 120, 50, { title: "Node B", value: ctx.state.leaders.B ? "LEADER" : "follower", color: ctx.state.leaders.B ? C.ok : C.muted });
        if (ctx.toggles.partition) d.badge(340, 140, "PARTITION", { color: C.err, filled: true, align: "center" });
        if (ctx.state.split) d.badge(340, 280, "SPLIT BRAIN — dual primaries", { color: C.err, filled: true, align: "center" });
      },
      status: (ctx) => ({ text: ctx.state.split ? "Split brain — two leaders accepting writes" : ctx.state.leaders.A ? "Single leader elected" : "No leader", cls: ctx.state.split ? "err" : "ok" }),
    },
    "cross-shard-txn": {
      note: "Transaction spans shards — 2PC coordinates commit across partitions.",
      init(ctx) { ctx.state.phase = "idle"; },
      actions: [
        { id: "start", label: "Begin 2PC", primary: true, onClick(ctx) { ctx.state.phase = "prepared"; } },
        { id: "commit", label: "Commit all", onClick(ctx) { ctx.state.phase = "committed"; } },
      ],
      draw(ctx, d) {
        ["Shard A", "Shard B"].forEach((s, i) => d.node(180 + i * 220, 220, 120, 50, { title: s, value: ctx.state.phase, color: ctx.state.phase === "committed" ? C.ok : C.accent }));
        if (ctx.state.phase === "prepared") d.arrow(300, 200, 400, 200, { color: C.accent, label: "prepare votes", dashed: true });
      },
      status: (ctx) => ({ text: ctx.state.phase === "committed" ? "Cross-shard txn committed" : ctx.state.phase === "prepared" ? "Prepared — awaiting commit" : "Click Begin 2PC", cls: ctx.state.phase === "committed" ? "ok" : "" }),
    },
    "hot-row": {
      note: "Single row receives disproportionate update traffic.",
      toggles: [{ key: "hot", label: "Hot row updates", kind: "err", value: false }],
      init(ctx) { ctx.state.rows = { r1: 10, r2: 10, r3: 10 }; },
      actions: [{ id: "update", label: "Apply updates", primary: true, onClick(ctx) {
        if (ctx.toggles.hot) ctx.state.rows.r1 += 50; else { ctx.state.rows.r1 += 5; ctx.state.rows.r2 += 5; ctx.state.rows.r3 += 5; }
      } }],
      draw(ctx, d) { Object.entries(ctx.state.rows).forEach(([r, load], i) => d.node(150 + i * 130, 200, 100, 50, { title: r, value: `${load} writes`, color: load > 40 ? C.err : C.accent })); },
      status: (ctx) => ({ text: ctx.state.rows.r1 > 40 ? "Hot row r1 — lock contention" : "Balanced row updates", cls: ctx.state.rows.r1 > 40 ? "err" : "ok" }),
    },
    "read-replica-lag": {
      note: "Replica falls behind primary — reads may be stale.",
      toggles: [{ key: "lag", label: "Replication lag", kind: "warn", value: false }],
      init(ctx) { ctx.state.primary = 10; ctx.state.replica = 10; },
      actions: [{ id: "write", label: "Write to primary", primary: true, onClick(ctx) { ctx.state.primary += 1; if (ctx.toggles.lag) ctx.state.replica = ctx.state.primary - 3; else ctx.state.replica = ctx.state.primary; } }],
      draw(ctx, d) {
        d.node(200, 200, 120, 50, { title: "Primary", value: `v=${ctx.state.primary}`, color: C.ok, kind: "db" });
        d.node(480, 200, 120, 50, { title: "Replica", value: `v=${ctx.state.replica}`, color: ctx.toggles.lag ? C.warn : C.ok, kind: "db" });
        d.arrow(320, 225, 480, 225, { color: ctx.toggles.lag ? C.warn : C.accent, label: ctx.toggles.lag ? "lagging" : "synced", dashed: ctx.toggles.lag });
      },
      status: (ctx) => ({ text: ctx.state.replica < ctx.state.primary ? `Stale read possible — replica v=${ctx.state.replica}` : "Replica caught up", cls: ctx.state.replica < ctx.state.primary ? "warn" : "ok" }),
    },
    "out-of-order": {
      note: "Events arrive out of order — reorder buffer or version checks needed.",
      init(ctx) { ctx.state.events = []; },
      actions: [
        { id: "e3", label: "Receive evt-3", primary: true, onClick(ctx) { ctx.state.events.push(3); ctx.state.outOfOrder = true; } },
        { id: "e1", label: "Receive evt-1", onClick(ctx) { ctx.state.events.push(1); } },
        { id: "e2", label: "Receive evt-2", onClick(ctx) { ctx.state.events.push(2); } },
      ],
      draw(ctx, d) {
        ctx.state.events.forEach((e, i) => d.node(150 + i * 100, 200, 80, 44, { title: `evt-${e}`, color: ctx.state.outOfOrder && i === 0 && e === 3 ? C.err : C.accent }));
      },
      status: (ctx) => ({ text: ctx.state.outOfOrder ? `Out of order: [${ctx.state.events.join(", ")}]` : `In order: [${ctx.state.events.join(", ")}]`, cls: ctx.state.outOfOrder ? "warn" : "ok" }),
    },
    "rate-limiter-in-process": {
      note: "In-process token bucket limits local request rate.",
      init(ctx) { ctx.state.tokens = 5; },
      actions: [{ id: "req", label: "Request", primary: true, onClick(ctx) {
        if (ctx.state.tokens > 0) { ctx.state.tokens -= 1; ctx.state.accepted = (ctx.state.accepted || 0) + 1; }
        else { ctx.state.rejected = (ctx.state.rejected || 0) + 1; }
      } }],
      draw(ctx, d) { d.tokenBucket(400, 180, 120, 100, ctx.state.tokens, 5, { label: "Local tokens", refillRate: 1 }); },
      status: (ctx) => ({ text: ctx.state.rejected ? `${ctx.state.rejected} rejected — bucket empty` : `${ctx.state.tokens} tokens left`, cls: ctx.state.rejected ? "err" : "ok" }),
    },
  };

  if (MAP[topicId]) return { note: MAP[topicId].note, ...MAP[topicId] };

  return {
    note: `${title}: manipulate structure.`,
    init(ctx) { ctx.state.items = []; },
    actions: [
      { id: "add", label: "Add", primary: true, onClick(ctx) { ctx.state.items.push(ctx.state.items.length + 1); } },
      { id: "remove", label: "Remove", onClick(ctx) { ctx.state.items.pop(); } },
    ],
    draw(ctx, d) { ctx.state.items.forEach((item, i) => d.node(150 + i * 100, 200, 80, 44, { title: String(item), color: C.accent })); },
    status: (ctx) => ({ text: `Items: ${ctx.state.items.length}`, cls: "ok" }),
  };
}

export function buildRaceConfig(topicId, title) {
  const MAP = {
    deadlock: {
      note: "T1 locks A then waits for B; T2 locks B then waits for A — step through to see circular wait.",
      mode: "locks",
      resources: ["A", "B"],
      resourceLabel: "Locks",
      failMessage: `${title} — circular wait`,
      failBadge: "Circular wait — neither thread can proceed",
      steps: [
        { id: "t1l", worker: "T1", action: "lock", value: "A" },
        { id: "t2l", worker: "T2", action: "lock", value: "B" },
        { id: "t1w", worker: "T1", action: "wait", value: "B", stale: true },
        { id: "t2w", worker: "T2", action: "wait", value: "A", stale: true },
      ],
    },
    toctou: {
      note: "TOCTOU: stat confirms file exists, another process unlinks it, create fails on stale assumption.",
      domain: "file",
      filePath: "/tmp/upload",
      initialFileState: "present",
      resourceLabel: "File /tmp/upload",
      workers: ["Worker A", "Worker B"],
      steps: [
        { id: "check", worker: "Worker A", action: "stat", value: "/tmp/upload", arrowLabel: "exists ✓" },
        { id: "unlink", worker: "Worker B", action: "unlink", value: "/tmp/upload", arrowLabel: "deleted" },
        { id: "create", worker: "Worker A", action: "create", value: "ENOENT", arrowLabel: "fail ✗", stale: true },
      ],
      failMessage: "TOCTOU — resource changed between check and use",
      failBadge: "Create failed — file missing (ENOENT)",
    },
  };

  if (MAP[topicId]) {
    const c = MAP[topicId];
    return { note: c.note || `${title}: step through concurrent operations.`, ...c };
  }

  const custom = raceStepsFor(topicId, title);
  return {
    note: custom.note || `${title}: step through concurrent operations.`,
    ...custom,
    expectedBalance: custom.expectedBalance ?? 150,
    initialBalance: custom.initialBalance ?? 100,
  };
}
