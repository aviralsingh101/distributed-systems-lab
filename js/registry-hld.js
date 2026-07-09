/**
 * HLD track categories — auto-generated from topic-manifest.js
 */
export const HLD_CATEGORIES = [
  {
    "id": "hld-foundations",
    "num": 1,
    "title": "Foundations & Estimation",
    "desc": "Framework, requirements, and back-of-envelope math.",
    "topics": [
      {
        "id": "system-design-framework",
        "title": "System Design Framework",
        "blurb": "Structured approach from requirements to architecture.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "requirements-gathering",
        "title": "Requirements Gathering",
        "blurb": "Functional vs non-functional needs before you draw boxes.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "non-functional-requirements",
        "title": "Non-Functional Requirements",
        "blurb": "Latency, availability, scale, and cost constraints.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "back-of-envelope-estimation",
        "title": "Back-of-Envelope Estimation",
        "blurb": "Quick capacity math before deep design.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "qps-latency-storage-math",
        "title": "QPS / Latency / Storage Math",
        "blurb": "Requests, bytes, and bandwidth sanity checks.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sla-vs-slo",
        "title": "SLA vs SLO",
        "blurb": "Customer promise vs internal reliability target.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "conways-law",
        "title": "Conway's Law",
        "blurb": "Org structure shapes system boundaries.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "technical-debt-vs-velocity",
        "title": "Technical Debt vs Velocity",
        "blurb": "Ship fast now vs pay interest later.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-networking",
    "num": 2,
    "title": "Networking & Communication",
    "desc": "How services talk across the network.",
    "topics": [
      {
        "id": "dns",
        "title": "DNS",
        "blurb": "Name resolution and routing at the edge.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "tcp-udp-tradeoffs",
        "title": "TCP vs UDP",
        "blurb": "Reliable streams vs fire-and-forget datagrams.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "http-evolution",
        "title": "HTTP/1.1 → HTTP/2 → HTTP/3",
        "blurb": "Multiplexing, headers, and QUIC gains.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "grpc",
        "title": "gRPC",
        "blurb": "Binary RPC with HTTP/2 and strong contracts.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "websockets",
        "title": "WebSockets",
        "blurb": "Full-duplex persistent client connections.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sse",
        "title": "Server-Sent Events",
        "blurb": "Server push over one-way HTTP stream.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "long-polling",
        "title": "Long Polling",
        "blurb": "Hold request open until data arrives.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "webhooks",
        "title": "Webhooks",
        "blurb": "HTTP callbacks on external events.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "rest-vs-graphql",
        "title": "REST vs GraphQL",
        "blurb": "Resource URLs vs client-shaped queries.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "tls-termination",
        "title": "TLS Termination",
        "blurb": "Where encryption ends: edge vs service.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-blocks",
    "num": 3,
    "title": "Building Blocks",
    "desc": "Core infrastructure primitives at scale.",
    "topics": [
      {
        "id": "load-balancer-l4-l7",
        "title": "Load Balancer (L4 / L7)",
        "blurb": "Distribute traffic by IP or HTTP semantics.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "reverse-proxy",
        "title": "Reverse Proxy",
        "blurb": "Front door that forwards to upstreams.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "api-gateway",
        "title": "API Gateway",
        "blurb": "Edge routing, auth, and aggregation.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cdn",
        "title": "CDN",
        "blurb": "Cache static assets close to users.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "caching-tiers",
        "title": "Caching Tiers",
        "blurb": "Browser, CDN, app, and DB cache layers.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sql-vs-nosql-selection",
        "title": "SQL vs NoSQL Selection",
        "blurb": "Pick storage by access pattern and consistency.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "partitioning-schemes",
        "title": "Partitioning Schemes",
        "blurb": "Shard by key, range, or hash.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "replication-topologies",
        "title": "Replication Topologies",
        "blurb": "Primary-replica, multi-leader, leaderless.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "message-queues",
        "title": "Message Queues",
        "blurb": "Decouple producers and consumers.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "kafka-vs-rabbitmq",
        "title": "Kafka vs RabbitMQ",
        "blurb": "Log vs broker semantics for messaging.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "pub-sub-fanout",
        "title": "Pub/Sub Fan-out",
        "blurb": "One event, many subscribers.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "edge-rate-limiting",
        "title": "Edge Rate Limiting",
        "blurb": "Protect services before overload hits.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "service-discovery",
        "title": "Service Discovery",
        "blurb": "Find healthy instances dynamically.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "service-mesh",
        "title": "Service Mesh",
        "blurb": "Sidecar-managed traffic and security.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "blob-storage",
        "title": "Blob Storage",
        "blurb": "Durable objects for files and media.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "edge-compute",
        "title": "Edge Compute",
        "blurb": "Run logic closer to users at the edge.",
        "tier": "hidden-gem",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-theory",
    "num": 4,
    "title": "Distributed Systems Theory",
    "desc": "Formal guarantees and coordination.",
    "topics": [
      {
        "id": "consensus-raft-paxos",
        "title": "Consensus (Raft / Paxos)",
        "blurb": "Agree on one value despite failures.",
        "tier": "advanced",
        "related": []
      },
      {
        "id": "linearizability-vs-serializability",
        "title": "Linearizability vs Serializability",
        "blurb": "Real-time order vs transaction order.",
        "tier": "advanced",
        "related": []
      },
      {
        "id": "quorum-reads-writes",
        "title": "Quorum Reads / Writes",
        "blurb": "R + W > N for tunable consistency.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cap-theorem-framing",
        "title": "CAP Theorem (HLD framing)",
        "blurb": "Under partition: consistency or availability.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "pacelc",
        "title": "PACELC",
        "blurb": "If no partition: latency vs consistency.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "hybrid-logical-clocks",
        "title": "Hybrid Logical Clocks",
        "blurb": "Physical time plus logical counters.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "crdt-overview",
        "title": "CRDT Overview",
        "blurb": "Conflict-free replicated data types.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "distributed-transactions-comparison",
        "title": "Distributed Transactions",
        "blurb": "2PC, saga, and outbox compared.",
        "tier": "advanced",
        "related": []
      },
      {
        "id": "exactly-once-honesty",
        "title": "Exactly-Once Honesty",
        "blurb": "End-to-end exactly-once is a myth.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "phi-accrual-failure-detection",
        "title": "Phi Accrual Failure Detection",
        "blurb": "Probabilistic suspect-node detection.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "consistent-hashing-placement",
        "title": "Consistent Hashing (placement)",
        "blurb": "Minimal key movement when nodes change.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "merkle-anti-entropy",
        "title": "Merkle Anti-Entropy",
        "blurb": "Tree hashes detect replica drift.",
        "tier": "hidden-gem",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-data",
    "num": 5,
    "title": "Data Systems",
    "desc": "Storage engines, analytics, and search.",
    "topics": [
      {
        "id": "btree-vs-lsm",
        "title": "B-Tree vs LSM",
        "blurb": "Read-optimized vs write-optimized storage.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "oltp-vs-olap",
        "title": "OLTP vs OLAP",
        "blurb": "Transactional rows vs analytic scans.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "warehouse-lake-lakehouse",
        "title": "Warehouse vs Lake vs Lakehouse",
        "blurb": "Structured BI vs raw files vs both.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "lambda-vs-kappa",
        "title": "Lambda vs Kappa",
        "blurb": "Batch+stream dual path vs stream-only.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cdc",
        "title": "Change Data Capture",
        "blurb": "Stream DB changes to downstream systems.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "search-inverted-index",
        "title": "Search / Inverted Index",
        "blurb": "Token lookup for full-text search.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "time-series-db",
        "title": "Time-Series DB",
        "blurb": "Append-heavy metrics and events.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "graph-db",
        "title": "Graph DB",
        "blurb": "Traverse relationships natively.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "vector-db-ann",
        "title": "Vector DB / ANN",
        "blurb": "Similarity search for embeddings.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "key-value-stores",
        "title": "Key-Value Stores",
        "blurb": "Simple get/put at massive scale.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "materialized-views",
        "title": "Materialized Views",
        "blurb": "Precomputed query results.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "stream-table-duality",
        "title": "Stream-Table Duality",
        "blurb": "Tables are streams; streams are tables.",
        "tier": "hidden-gem",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-architecture",
    "num": 6,
    "title": "Architecture Patterns",
    "desc": "Shapes for large systems.",
    "topics": [
      {
        "id": "monolith-vs-microservices",
        "title": "Monolith vs Microservices",
        "blurb": "One deployable vs many services.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "event-driven-architecture",
        "title": "Event-Driven Architecture",
        "blurb": "Loose coupling via async events.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cqrs",
        "title": "CQRS",
        "blurb": "Separate write and read models.",
        "tier": "advanced",
        "related": []
      },
      {
        "id": "event-sourcing",
        "title": "Event Sourcing",
        "blurb": "State as append-only event log.",
        "tier": "advanced",
        "related": []
      },
      {
        "id": "serverless-faas",
        "title": "Serverless / FaaS",
        "blurb": "Functions triggered by events.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "bff",
        "title": "Backend for Frontend",
        "blurb": "Tailored API per client type.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "strangler-fig",
        "title": "Strangler Fig",
        "blurb": "Gradually replace legacy system.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "hexagonal-clean-architecture",
        "title": "Hexagonal / Clean Architecture",
        "blurb": "Domain core, ports, and adapters.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "anti-corruption-layer",
        "title": "Anti-Corruption Layer",
        "blurb": "Translate foreign models at boundary.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "multi-region-active-active",
        "title": "Multi-Region Active-Active",
        "blurb": "Serve from multiple regions live.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "multi-tenancy-patterns",
        "title": "Multi-Tenancy Patterns",
        "blurb": "Silo, pool, and bridge isolation.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "local-first-crdt-apps",
        "title": "Local-First / CRDT Apps",
        "blurb": "Offline-first with mergeable state.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "cell-architecture-design",
        "title": "Cell Architecture (design)",
        "blurb": "Isolated failure domains at scale.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "scatter-gather",
        "title": "Scatter-Gather",
        "blurb": "Fan out queries, merge results.",
        "tier": "hidden-gem",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-reliability",
    "num": 7,
    "title": "Reliability & Operations",
    "desc": "Run systems safely in production.",
    "topics": [
      {
        "id": "observability-three-pillars",
        "title": "Observability Pillars",
        "blurb": "Metrics, logs, and distributed traces.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sli-slo-error-budgets",
        "title": "SLI / SLO / Error Budgets",
        "blurb": "Measure reliability and spend budget.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "resilience-patterns-overview",
        "title": "Resilience Patterns Overview",
        "blurb": "Bulkhead, breaker, retry, and shed.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "graceful-degradation-hld",
        "title": "Graceful Degradation",
        "blurb": "Drop features, keep core path alive.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "autoscaling-hpa",
        "title": "Autoscaling / HPA",
        "blurb": "Scale replicas by load signals.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "deploy-strategies",
        "title": "Deploy Strategies",
        "blurb": "Blue-green, canary, and rolling.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "chaos-engineering",
        "title": "Chaos Engineering",
        "blurb": "Inject faults to find weaknesses.",
        "tier": "advanced",
        "related": []
      },
      {
        "id": "incident-response",
        "title": "Incident Response",
        "blurb": "Detect, mitigate, and postmortem.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "health-probes",
        "title": "Health / Readiness / Liveness",
        "blurb": "Kube probes gate traffic correctly.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "finops",
        "title": "FinOps",
        "blurb": "Cost visibility and optimization.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "platform-engineering-idp",
        "title": "Platform Engineering / IDP",
        "blurb": "Golden paths for product teams.",
        "tier": "hidden-gem",
        "related": []
      },
      {
        "id": "poison-pill-handling",
        "title": "Poison Pill Handling",
        "blurb": "Stop bad messages from blocking queues.",
        "tier": "hidden-gem",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-security",
    "num": 8,
    "title": "Security at Scale",
    "desc": "Identity, secrets, and perimeter.",
    "topics": [
      {
        "id": "authn-vs-authz",
        "title": "AuthN vs AuthZ",
        "blurb": "Who you are vs what you may do.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "oauth2-oidc",
        "title": "OAuth2 / OIDC",
        "blurb": "Delegated auth and identity tokens.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "jwt-pitfalls",
        "title": "JWT Pitfalls",
        "blurb": "Expiry, rotation, and token size traps.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "mtls-service-identity",
        "title": "mTLS / Service Identity",
        "blurb": "Mutual TLS between services.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "secrets-management",
        "title": "Secrets Management",
        "blurb": "Vault, rotation, and least privilege.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "ddos-mitigation",
        "title": "DDoS Mitigation",
        "blurb": "Absorb and scrub attack traffic.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "waf",
        "title": "WAF",
        "blurb": "Filter malicious HTTP at the edge.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "zero-trust-perimeter",
        "title": "Zero-Trust Perimeter",
        "blurb": "Never trust, always verify.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-tradeoffs",
    "num": 9,
    "title": "Trade-off Decisions",
    "desc": "Side-by-side architecture choices.",
    "topics": [
      {
        "id": "strong-vs-eventual-consistency",
        "title": "Strong vs Eventual Consistency",
        "blurb": "Fresh reads vs availability under partition.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "acid-vs-base",
        "title": "ACID vs BASE",
        "blurb": "Transactional rigor vs eventual relax.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sql-vs-nosql",
        "title": "SQL vs NoSQL",
        "blurb": "Schema, joins, and scale tradeoffs.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "latency-vs-throughput",
        "title": "Latency vs Throughput",
        "blurb": "Fast p99 vs max requests/sec.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cache-strategies",
        "title": "Cache Strategies",
        "blurb": "Aside, through, around, and back.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "batch-vs-stream",
        "title": "Batch vs Stream",
        "blurb": "Periodic jobs vs continuous processing.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "lb-vs-proxy-vs-gateway",
        "title": "LB vs Proxy vs Gateway",
        "blurb": "Where each layer belongs.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "rest-vs-grpc-vs-graphql",
        "title": "REST vs gRPC vs GraphQL",
        "blurb": "Pick API style by client needs.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "polling-vs-websocket-family",
        "title": "Polling vs WebSocket Family",
        "blurb": "Pull, long poll, SSE, or socket.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "rate-limit-algorithms",
        "title": "Rate-Limit Algorithms",
        "blurb": "Token bucket, leaky bucket, sliding window.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "partitioning-schemes-tradeoff",
        "title": "Partitioning Schemes",
        "blurb": "Hash, range, or directory routing.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "replication-topologies-tradeoff",
        "title": "Replication Topologies",
        "blurb": "Sync vs async replica lag.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "two-pc-vs-saga-vs-tcc",
        "title": "2PC vs Saga vs TCC",
        "blurb": "Distributed commit patterns compared.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "push-vs-pull",
        "title": "Push vs Pull",
        "blurb": "Broker delivers vs consumer polls.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "lambda-vs-kappa-tradeoff",
        "title": "Lambda vs Kappa",
        "blurb": "Dual pipeline vs stream-only simplification.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "vertical-vs-horizontal-scale",
        "title": "Vertical vs Horizontal Scale",
        "blurb": "Bigger machine vs more nodes.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "normalization-vs-denormalization",
        "title": "Normalization vs Denormalization",
        "blurb": "Storage purity vs read speed.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "single-vs-multi-region",
        "title": "Single vs Multi-Region",
        "blurb": "Simplicity vs geo resilience.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sync-vs-async-communication",
        "title": "Sync vs Async Communication",
        "blurb": "Request-response vs messaging.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "stateful-vs-stateless",
        "title": "Stateful vs Stateless Services",
        "blurb": "Session stickiness vs easy scale.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "pessimistic-vs-optimistic-concurrency",
        "title": "Pessimistic vs Optimistic",
        "blurb": "Lock early vs retry on conflict.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "managed-vs-self-hosted",
        "title": "Managed vs Self-Hosted",
        "blurb": "Ops burden vs control and cost.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-classics",
    "num": 10,
    "title": "Classic System Designs",
    "desc": "Interview and reference architectures.",
    "topics": [
      {
        "id": "url-shortener",
        "title": "URL Shortener",
        "blurb": "Hash, redirect, and analytics at scale.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "rate-limiter-service",
        "title": "Rate Limiter Service",
        "blurb": "Distributed token bucket service.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "news-feed",
        "title": "News Feed",
        "blurb": "Fan-out on write vs read.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "notification-system",
        "title": "Notification System",
        "blurb": "Multi-channel delivery pipeline.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "chat-system",
        "title": "Chat System",
        "blurb": "Real-time messaging at scale.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "file-storage-s3",
        "title": "File Storage (S3-like)",
        "blurb": "Objects, metadata, and durability.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "search-autocomplete",
        "title": "Search Autocomplete",
        "blurb": "Prefix trie and ranking.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "distributed-cache-design",
        "title": "Distributed Cache Design",
        "blurb": "Consistent hash and eviction.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "payment-system-hld",
        "title": "Payment System (HLD)",
        "blurb": "Meta design tying all tracks.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "ride-sharing-dispatch",
        "title": "Ride-Sharing Dispatch",
        "blurb": "Match drivers and riders live.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "ticket-booking",
        "title": "Ticket Booking",
        "blurb": "Inventory locks and oversell prevention.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "video-streaming",
        "title": "Video Streaming",
        "blurb": "Encode, CDN, and adaptive bitrate.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "metrics-monitoring-system",
        "title": "Metrics / Monitoring System",
        "blurb": "Collect, store, and alert on metrics.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "distributed-cron",
        "title": "Distributed Cron",
        "blurb": "Exactly-once scheduled jobs.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "leaderboard",
        "title": "Leaderboard",
        "blurb": "Real-time ranked scores.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "collaborative-editor",
        "title": "Collaborative Editor",
        "blurb": "OT/CRDT for shared documents.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-consistency",
    "num": 11,
    "title": "Consistency Models",
    "desc": "How fresh a balance read is across replicas.",
    "topics": [
      {
        "id": "cap-theorem",
        "title": "CAP Theorem",
        "blurb": "Pick 2 under partition.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "eventual-consistency",
        "title": "Eventual Consistency",
        "blurb": "Replicas converge later.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "read-your-writes",
        "title": "Read Your Writes",
        "blurb": "See your own update.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "monotonic-reads",
        "title": "Monotonic Reads",
        "blurb": "Never go backwards in time.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "session-consistency",
        "title": "Session Consistency",
        "blurb": "Guarantees within a session.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "quorum",
        "title": "Quorum",
        "blurb": "R + W > N.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "crdt",
        "title": "CRDT",
        "blurb": "Conflict-free automatic merge.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-db-scaling",
    "num": 12,
    "title": "Database Scaling",
    "desc": "Sharding wallets and the skew that follows.",
    "topics": [
      {
        "id": "hot-partition",
        "title": "Hot Partition",
        "blurb": "One shard gets 90% traffic.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "hot-row",
        "title": "Hot Row",
        "blurb": "Same row updated constantly.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "hot-index",
        "title": "Hot Index",
        "blurb": "Same B-tree page contended.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "secondary-index-lag",
        "title": "Secondary Index Lag",
        "blurb": "Async index is stale.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "read-replica-lag",
        "title": "Read Replica Lag",
        "blurb": "Read-your-write fails.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "split-brain",
        "title": "Split Brain",
        "blurb": "Two primaries, conflicting writes.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "shard-rebalancing",
        "title": "Shard Rebalancing",
        "blurb": "Moving data disrupts traffic.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "consistent-hashing",
        "title": "Consistent Hashing",
        "blurb": "Virtual nodes balance load.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cross-shard-txn",
        "title": "Cross-Shard Transaction",
        "blurb": "Atomicity across shards is hard.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-performance",
    "num": 13,
    "title": "Performance & Capacity",
    "desc": "Where latency hides in the payment path.",
    "topics": [
      {
        "id": "tail-latency",
        "title": "Tail Latency",
        "blurb": "P99 rules user experience.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "queue-buildup",
        "title": "Queue Buildup",
        "blurb": "Small slowdown, huge queue.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "littles-law",
        "title": "Little's Law",
        "blurb": "L = λW.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "coordinated-omission-perf",
        "title": "Coordinated Omission",
        "blurb": "Benchmark hides pauses.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "false-sharing",
        "title": "False Sharing",
        "blurb": "CPU cache line contention.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "numa",
        "title": "NUMA Effects",
        "blurb": "Memory locality matters.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "context-switching",
        "title": "Context Switching",
        "blurb": "Too many threads waste CPU.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "gc-pause",
        "title": "GC Pause",
        "blurb": "App freezes, locks expire.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-cache-strategies",
    "num": 14,
    "title": "Cache Strategies",
    "desc": "Write/read patterns for keeping cache correct.",
    "topics": [
      {
        "id": "write-through",
        "title": "Write Through",
        "blurb": "DB + cache together.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "write-around",
        "title": "Write Around",
        "blurb": "DB only; cache misses later.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "write-back",
        "title": "Write Back",
        "blurb": "Cache first, DB later (risky).",
        "tier": "essential",
        "related": []
      },
      {
        "id": "read-through",
        "title": "Read Through",
        "blurb": "Cache loads DB itself.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cache-aside",
        "title": "Cache Aside",
        "blurb": "App loads DB then cache.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "negative-cache",
        "title": "Negative Cache",
        "blurb": "Cache 'not found'.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-rate-limiting",
    "num": 15,
    "title": "Rate Limiting & Traffic Control",
    "desc": "Operating the payment platform at scale.",
    "topics": [
      {
        "id": "hedged-requests",
        "title": "Hedged Requests",
        "blurb": "Send a backup if the first is slow.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "request-coalescing",
        "title": "Request Coalescing",
        "blurb": "Merge identical in-flight calls.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "token-bucket",
        "title": "Token Bucket",
        "blurb": "Rate limit with burst.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "leaky-bucket",
        "title": "Leaky Bucket",
        "blurb": "Smooth traffic to a steady rate.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "adaptive-concurrency",
        "title": "Adaptive Concurrency Control",
        "blurb": "Limit by observed latency.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "load-shedding",
        "title": "Load Shedding",
        "blurb": "Drop requests to survive.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "admission-control",
        "title": "Admission Control",
        "blurb": "Reject before overload.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "shuffle-sharding",
        "title": "Shuffle Sharding",
        "blurb": "Overlapping subsets limit blast radius.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "cell-architecture",
        "title": "Cell Architecture",
        "blurb": "Isolated cells localize failure.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "sticky-sessions",
        "title": "Sticky Sessions",
        "blurb": "Pin a user to one server.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "watermarking",
        "title": "Watermarking",
        "blurb": "Track event-time progress.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "gossip-protocols",
        "title": "Gossip Protocols",
        "blurb": "Peer-to-peer state dissemination.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-messaging-ops",
    "num": 16,
    "title": "Messaging Operations",
    "desc": "Queue mechanics for reliable event delivery.",
    "topics": [
      {
        "id": "dead-letter-queue",
        "title": "Dead Letter Queue",
        "blurb": "Park failures aside.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "visibility-timeout",
        "title": "Visibility Timeout",
        "blurb": "Crash → message re-appears.",
        "tier": "essential",
        "related": []
      },
      {
        "id": "consumer-rebalancing",
        "title": "Consumer Group Rebalancing",
        "blurb": "Partitions move, pause.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  },
  {
    "id": "hld-reliability-patterns",
    "num": 17,
    "title": "Reliability Patterns",
    "desc": "Backoff, jitter, and coordinated retry design.",
    "topics": [
      {
        "id": "exponential-backoff",
        "title": "Exponential Backoff + Jitter",
        "blurb": "De-synchronize retries.",
        "tier": "essential",
        "related": []
      }
    ],
    "track": "hld"
  }
];