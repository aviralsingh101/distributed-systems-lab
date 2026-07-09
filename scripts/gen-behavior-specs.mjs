/**
 * Generate sim-behavior-specs.json for all interactive topics.
 * Run: node scripts/gen-behavior-specs.mjs
 */
import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const interactive = JSON.parse(readFileSync(join(ROOT, "scripts", "interactive-topics.json"), "utf8"));

const topics = {};

function add(id, cases) {
  topics[id] = { cases };
}

add("dns", [
  { setup: { toggles: {} }, action: "resolve", tickSeconds: 3, expect: { lastTarget: "regionA", statusIncludes: "Region A" } },
  { setup: { toggles: { failover: true } }, action: "resolve", tickSeconds: 3, expect: { lastTarget: "regionB", statusIncludes: "Region B" } },
  { setup: { toggles: { failover: true, cached: true } }, action: "resolve", tickSeconds: 3, expect: { lastTarget: "regionA", statusCls: "err" } },
]);

add("load-balancer-l4-l7", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "backendB", statusIncludes: "L4" } },
  { setup: { toggles: { backendDown: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "backendA", statusIncludes: "healthy" } },
  { setup: { toggles: { l7: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "backendB", statusIncludes: "L7" } },
  { setup: { toggles: { l7: true, backendDown: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "backendA", statusIncludes: "healthy" } },
]);

add("api-gateway", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "service", statusCls: "ok" } },
  { setup: { toggles: { noAuth: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "401", statusCls: "err" } },
  { setup: { toggles: { overQuota: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "429", statusCls: "warn" } },
]);

add("cdn", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "origin", statusIncludes: "MISS" } },
  { setup: { toggles: { cacheHit: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "cdn", statusIncludes: "HIT" } },
]);

add("reverse-proxy", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "pod2", statusIncludes: "least_conn", statusCls: "ok" } },
  { setup: { toggles: { podDown: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "pod1", statusIncludes: "skipped", statusCls: "ok" } },
  { setup: { toggles: { bypass: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "pod2", statusCls: "warn" } },
  { setup: { toggles: { bypass: true, podDown: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "dead", statusCls: "err" } },
]);

add("message-queues", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "consumer", statusIncludes: "Async", statusCls: "ok" } },
  { setup: { toggles: { poison: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "dlq", statusIncludes: "DLQ", statusCls: "warn" } },
]);

add("service-mesh", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "svcB", statusIncludes: "mTLS", statusCls: "ok" } },
  { setup: { toggles: { mesh: false } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "svcB", statusIncludes: "Direct", statusCls: "warn" } },
]);

add("url-shortener", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "db", statusIncludes: "miss" } },
  { setup: { toggles: { cacheHit: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "redis", statusIncludes: "cache", statusCls: "ok" } },
]);

add("rate-limiter-service", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "api", statusCls: "ok" } },
  { setup: { toggles: { burst: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "429", statusCls: "err" } },
]);

add("news-feed", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "feeds", statusIncludes: "Fan-out", statusCls: "ok" } },
  { setup: { toggles: { fanOutWrite: false } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "posts", statusIncludes: "Pull", statusCls: "ok" } },
]);

add("chat-system", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "room", statusIncludes: "WebSocket", statusCls: "ok" } },
  { setup: { toggles: { offline: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "store", statusIncludes: "offline", statusCls: "warn" } },
]);

add("payment-system-hld", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "ledger", statusIncludes: "captured", statusCls: "ok" } },
  { setup: { toggles: { duplicate: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "order", statusIncludes: "Duplicate", statusCls: "warn" } },
]);

add("ticket-booking", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "inventory", statusIncludes: "held", statusCls: "ok" } },
  { setup: { toggles: { soldOut: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "409", statusCls: "err" } },
]);

add("thread-pool", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "workers", statusCls: "ok" } },
  { setup: { toggles: { saturated: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "Rejected", statusCls: "err" } },
]);

add("producer-consumer", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "consumer", statusIncludes: "Steady", statusCls: "ok" } },
  { setup: { toggles: { slowConsumer: true } }, action: "trace", tickSeconds: 3, expect: { statusIncludes: "backing up", statusCls: "warn" } },
]);

add("readers-writers", [
  { action: "trace", tickSeconds: 3, expect: { lastTarget: "data", statusIncludes: "readers", statusCls: "ok" } },
  { setup: { toggles: { writer: true } }, action: "trace", tickSeconds: 3, expect: { lastTarget: "data", statusIncludes: "exclusive", statusCls: "warn" } },
]);

add("cache-aside", [
  { setup: { toggles: { warmCache: true } }, action: "read", expect: { statusIncludes: "hit" } },
  { setup: { toggles: { warmCache: false } }, action: "read", expect: { statusIncludes: "miss" } },
]);

add("token-bucket", [
  { action: "send", expect: { acceptedGte: 1 } },
]);

add("load-shedding", [
  { action: "send", expect: { acceptedGte: 1 } },
  { setup: { toggles: { burst: true } }, tickSeconds: 2, expect: { statusIncludes: "Burst", statusCls: "warn" } },
  { setup: { params: { cap: 2 } }, actions: ["send", "send", "send"], expect: { statusIncludes: "shed" } },
]);

add("lost-update", [
  { actions: ["t1r", "t2r", "t1w", "t2w"], expect: { statusCls: "err" } },
]);

add("toctou", [
  { actions: ["check", "unlink", "create"], expect: { statusCls: "err" } },
]);

add("write-skew", [
  { actions: ["t1r", "t2r", "t1w", "t2w"], expect: { statusCls: "err" } },
]);

add("circuit-breaker", [
  { action: "fail", expect: { statusIncludes: "Open" } },
]);

add("lru-cache", [
  { action: "key-A-0", expect: { statusIncludes: "A" } },
]);

add("read-your-writes", [
  { actions: ["write", "read"], expect: { statusIncludes: "Replication" } },
]);

add("transactional-outbox", [
  { action: "commit", expect: { statusCls: "ok" } },
]);

add("read-replica-routing", [
  { action: "read", expect: { statusIncludes: "Fresh" } },
  { setup: { toggles: { stale: true } }, action: "read", expect: { statusIncludes: "Stale" } },
]);

add("cap-theorem", [
  { action: "cpWrite", tickSeconds: 3, expect: { statusIncludes: "consistent", statusCls: "ok" } },
  { setup: { toggles: { partition: true } }, action: "cpWrite", tickSeconds: 3, expect: { statusIncludes: "unavailable", statusCls: "err" } },
  { action: "apWrite", tickSeconds: 3, expect: { statusIncludes: "accepted", statusCls: "ok" } },
  { setup: { toggles: { partition: true } }, action: "apWrite", tickSeconds: 3, expect: { statusIncludes: "diverged", statusCls: "warn" } },
]);

add("grpc", [
  { action: "call", expect: { statusIncludes: "Unary" } },
  { setup: { toggles: { streaming: true } }, action: "call", expect: { statusIncludes: "streaming" } },
]);

add("singleton", [
  { action: "get", expect: { statusCls: "ok" } },
  { setup: { toggles: { multiProcess: true } }, action: "get", expect: { statusCls: "err" } },
]);

add("optimistic", [
  { action: "save", expect: { statusIncludes: "Committed" } },
  { setup: { toggles: { conflict: true } }, action: "save", expect: { statusIncludes: "Conflict" } },
]);

add("two-pc", [
  { actions: ["prepare", "commit"], expect: { statusIncludes: "Committed" } },
]);

add("consensus-raft-paxos", [
  { actions: ["start", "finish"], expect: { statusIncludes: "Leader" } },
  { actions: ["start", "finish", "replicate"], expect: { statusIncludes: "Committed" } },
  { setup: { toggles: { partition: true } }, actions: ["start", "finish", "replicate"], expect: { statusIncludes: "Leader" } },
]);

add("quorum-reads-writes", [
  { action: "write", expect: { state: { current: "write_ok" }, statusIncludes: "Write quorum met" } },
  { action: "read", expect: { state: { current: "read_ok" }, statusIncludes: "Read quorum met" } },
  { setup: { params: { W: 3 }, toggles: { replicaDown: true } }, action: "write", expect: { state: { current: "write_fail" } } },
]);

add("partial-failure", [
  { action: "start", expect: { state: { current: "healthy" } } },
  { setup: { toggles: { failOrder: true } }, action: "start", expect: { state: { current: "degraded" } } },
]);

add("cascading-failure", [
  { action: "fail-a", expect: { state: { current: "a-failed" } } },
  { actions: ["fail-a", "overload-b", "fail-c"], expect: { state: { current: "c-failed" } } },
]);

add("http-evolution", [
  { action: "send", tickSeconds: 6, expect: { state: { lastResult: "h1" }, statusIncludes: "HTTP/1.1" } },
  { setup: { toggles: { http2: true } }, action: "send", tickSeconds: 6, expect: { state: { lastResult: "h2" }, statusIncludes: "HTTP/2" } },
]);

add("cdc-relay", [
  { action: "run", tickSeconds: 4, expect: { lastTarget: "queue", statusIncludes: "streamed" } },
  { setup: { toggles: { fail: true } }, action: "run", expect: { statusIncludes: "offline", statusCls: "err" } },
]);

add("cqrs-read-write-models", [
  { action: "command", tickSeconds: 4, expect: { statusIncludes: "Command" } },
  { setup: { toggles: { lag: true } }, actions: ["command", "query"], expect: { statusIncludes: "Stale" } },
]);

add("event-sourcing-projection", [
  { action: "append", expect: { statusIncludes: "appended" } },
  { actions: ["append", "project", "query"], expect: { statusIncludes: "Query" } },
]);

const ACTION_DEFAULTS = {
  architecture: "trace",
  metrics: "send",
  queue: "start",
  race: "t1r",
  state: "start",
  algorithm: "add",
  clickFlow: "run",
};

const TOGGLE_CASES = {
  metrics: { setup: { toggles: { burst: true } }, action: "send", tickSeconds: 2 },
  queue: { action: "start", tickSeconds: 3 },
};

const CUSTOM_ACTION = {
  grpc: "call",
  websockets: "send",
  "http-evolution": "send",
  "cache-aside": "read",
  quorum: "read",
  singleton: "get",
  observer: "notify",
  strategy: "run",
  state: "submit",
  "two-pc": "prepare",
  "three-pc": "prepare",
  saga: "reserve",
  optimistic: "save",
  "consistent-hashing": "addVnode",
  "crdt": "write",
  "process-manager": "paymentCaptured",
  "consistent-hashing-placement": "addVnode",
  "lamport-clock": "send",
  "vector-clock": "merge",
  "hot-partition": "load",
  "hot-row": "update",
  "read-replica-lag": "write",
  "split-brain": "elect",
  "cross-shard-txn": "start",
  "rate-limiter-in-process": "req",
  "out-of-order": "e3",
  deadlock: "t1l",
  "redis-lock": "a1",
  redlock: "r1",
  toctou: "check",
  aba: "pop",
  "dirty-read": "t1w",
  "read-skew": "t1r1",
  "priority-inversion": "lowl",
  livelock: "a1",
  starvation: "h1",
  "zookeeper-lock": "c1",
  "etcd-lease": "grant",
  "lease-expiration": "hold",
  "fencing-tokens": "old",
  "idempotency-key": "req1",
  "exactly-once": "send",
  deduplication: "req1",
  "eventual-consistency": "read",
  "monotonic-reads": "read",
  "session-consistency": "read",
  "write-through": "read",
  "write-around": "read",
  "write-back": "read",
  "read-through": "read",
  "negative-cache": "read",
  "api-idempotency": "run",
  "inbox-pattern": "run",
  "saga-choreography": "run",
  "saga-orchestration": "run",
  "pagination-offset-cursor": "run",
  "correlation-trace-ids": "run",
  "cap-theorem": "cpWrite",
  "cqrs-read-write-models": "command",
  "event-sourcing-projection": "append",
  "cascading-failure": "fail-a",
  "quorum-reads-writes": "write",
  "partial-failure": "start",
  "cap-theorem-framing": "cp",
  pacelc: "lat",
  "isolation-levels": "ru",
  tcc: "try",
  "state-transition": "submit",
  hybrid: "read",
  "consensus-raft-paxos": "start",
  "cdc-relay": "run",
};

for (const [lab, ids] of Object.entries(interactive)) {
  for (const id of ids) {
    if (topics[id]) continue;
    const action = CUSTOM_ACTION[id] || ACTION_DEFAULTS[lab] || "run";
    const cases = [{ action, tickSeconds: 2 }];
    if (TOGGLE_CASES[lab]) cases.push(TOGGLE_CASES[lab]);
    topics[id] = { cases };
  }
}

writeFileSync(join(ROOT, "scripts", "sim-behavior-specs.json"), JSON.stringify({ version: 1, topics }, null, 2), "utf8");
console.log(`Wrote ${Object.keys(topics).length} topic behavior specs`);
