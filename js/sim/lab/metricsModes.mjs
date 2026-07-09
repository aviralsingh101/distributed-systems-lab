/**
 * Per-topic metrics lab mode — each topic gets a domain-correct model, not generic token bucket.
 * Modes: token | leaky | queue | pool | fanout | latency | timeline | backoff | amplification
 */
export const METRICS_TOPIC_MODES = {
  "token-bucket": "token",
  "leaky-bucket": "leaky",
  "adaptive-concurrency": "queue",
  "load-shedding": "token",
  "admission-control": "token",
  "connection-pool-exhaustion": "pool",
  "connection-pooling": "pool",
  "ephemeral-port-exhaustion": "pool",
  "queue-buildup": "queue",
  "littles-law": "queue",
  "priority-queue-starvation": "queue",
  "retry-storm": "fanout",
  "thundering-herd": "fanout",
  "cache-stampede": "fanout",
  dogpile: "fanout",
  "retry-amplification": "fanout",
  "cache-invalidation": "fanout",
  "cache-consistency": "fanout",
  "hot-key": "fanout",
  "cache-pollution": "fanout",
  "tail-latency": "latency",
  "hedged-requests": "latency",
  "request-coalescing": "latency",
  "coordinated-omission": "latency",
  "coordinated-omission-perf": "latency",
  "exponential-backoff": "backoff",
  "n-plus-one": "amplification",
  "slow-query-amplification": "amplification",
  "noisy-neighbor": "queue",
  "false-sharing": "timeline",
  numa: "timeline",
  "context-switching": "timeline",
  "gc-pause": "timeline",
  "shuffle-sharding": "fanout",
  "sticky-sessions": "fanout",
  watermarking: "queue",
};

export function getMetricsMode(topicId) {
  return METRICS_TOPIC_MODES[topicId] || "token";
}
