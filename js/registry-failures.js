/**
 * Production Failures track — failure modes and production depth.
 * Each topic module lives at ./topics/failures/<category.id>/<topic.id>.js
 */
export const FAILURES_CATEGORIES = [
  {
    id: "concurrency", num: 1, title: "Concurrency & Race Conditions",
    desc: "Two requests touch the same wallet at once and money goes missing.",
    topics: [
      { id: "lost-update", title: "Lost Update", blurb: "Two reads, two writes, one update vanishes." },
      { id: "toctou", title: "TOCTOU", blurb: "Check passes, then reality changes before you act." },
      { id: "aba", title: "ABA Problem", blurb: "Value changed A→B→A; CAS is fooled." },
      { id: "double-spend", title: "Double Spend", blurb: "Same balance spent twice." },
      { id: "write-skew", title: "Write Skew", blurb: "Two valid writes jointly break a rule." },
      { id: "phantom-read", title: "Phantom Read", blurb: "A re-run query sees new rows." },
      { id: "dirty-read", title: "Dirty Read", blurb: "You read data that later rolls back." },
      { id: "non-repeatable-read", title: "Non-repeatable Read", blurb: "Same row, two reads, two values." },
      { id: "read-skew", title: "Read Skew", blurb: "Two rows read across an update; snapshot inconsistent." },
    ],
  },
  {
    id: "locking", num: 2, title: "Locking Problems",
    desc: "Locks protect the wallet but create their own failure modes.",
    topics: [
      { id: "deadlock", title: "Deadlock", blurb: "A waits for B, B waits for A." },
      { id: "lock-contention", title: "Lock Contention", blurb: "Everyone queues on one hot row." },
      { id: "lock-convoy", title: "Lock Convoy", blurb: "One slow holder stalls hundreds." },
      { id: "priority-inversion", title: "Priority Inversion", blurb: "Low-priority holder blocks high-priority." },
      { id: "livelock", title: "Livelock", blurb: "Everyone retries, nobody progresses." },
      { id: "starvation", title: "Starvation", blurb: "One transaction is never scheduled." },
    ],
  },
  {
    id: "retry", num: 3, title: "Retry Problems",
    desc: "The pay endpoint slows down and retries make it worse.",
    topics: [
      { id: "retry-storm", title: "Retry Storm", blurb: "Everyone retries, DB dies." },
      { id: "thundering-herd", title: "Thundering Herd", blurb: "Cache expires, all hit DB." },
      { id: "cache-stampede", title: "Cache Stampede", blurb: "Coalesce recomputation." },
      { id: "dogpile", title: "Dogpile Effect", blurb: "Many workers recompute together." },
      { id: "retry-amplification", title: "Retry Amplification", blurb: "Retries multiply down the chain." },
      { id: "coordinated-omission", title: "Coordinated Omission", blurb: "Benchmarks hide stalls." },
    ],
  },
  {
    id: "cache", num: 4, title: "Cache Problems",
    desc: "Caching the wallet balance and keeping it correct.",
    topics: [
      { id: "cache-invalidation", title: "Cache Invalidation", blurb: "The hardest problem." },
      { id: "cache-consistency", title: "Cache Consistency", blurb: "Cache update failed after DB write." },
      { id: "hot-key", title: "Hot Key", blurb: "One key, millions of reads." },
      { id: "cache-pollution", title: "Cache Pollution", blurb: "Junk evicts useful data." },
    ],
  },
  {
    id: "messaging", num: 5, title: "Messaging Failures",
    desc: "Payment events on a queue and everything that jams it.",
    topics: [
      { id: "poison-message", title: "Poison Message", blurb: "Consumer always crashes on it." },
      { id: "backpressure", title: "Backpressure", blurb: "Producer outruns consumer." },
      { id: "slow-consumer", title: "Slow Consumer", blurb: "Lag grows without bound." },
      { id: "head-of-line-blocking", title: "Head-of-line Blocking", blurb: "One slow message blocks all." },
    ],
  },
  {
    id: "failure", num: 6, title: "Failure Handling",
    desc: "The payment gateway degrades and you contain the blast.",
    topics: [
      { id: "partial-failure", title: "Partial Failure", blurb: "Half the system works." },
      { id: "cascading-failure", title: "Cascading Failure", blurb: "One slow service drags all." },
      { id: "bulkhead", title: "Bulkhead Isolation", blurb: "Separate pools stop the domino." },
      { id: "circuit-breaker", title: "Circuit Breaker", blurb: "Open / Half-open / Closed." },
      { id: "fail-fast", title: "Fail Fast", blurb: "Reject immediately when overloaded." },
      { id: "graceful-degradation", title: "Graceful Degradation", blurb: "Drop non-essential features." },
      { id: "brownout", title: "Brownout", blurb: "Dim optional work under load." },
    ],
  },
  {
    id: "prod-eng", num: 7, title: "Production Engineering Failures",
    desc: "Operating the payment platform at scale — when things break.",
    topics: [
      { id: "connection-pool-exhaustion", title: "Connection Pool Exhaustion", blurb: "All DB connections busy." },
      { id: "ephemeral-port-exhaustion", title: "Ephemeral Port Exhaustion", blurb: "TIME_WAIT eats ports." },
      { id: "n-plus-one", title: "N+1 Query Problem", blurb: "One query becomes N+1." },
      { id: "slow-query-amplification", title: "Slow Query Amplification", blurb: "One bad query saturates DB." },
      { id: "noisy-neighbor", title: "Noisy Neighbor", blurb: "One tenant hogs shared resources." },
      { id: "priority-queue-starvation", title: "Priority Queue Starvation", blurb: "Low-priority jobs never run." },
    ],
  },
];
