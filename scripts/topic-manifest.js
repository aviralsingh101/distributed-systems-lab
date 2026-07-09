/**
 * Topic manifest for HLD and LLD tracks.
 * Generated from roadmap plan sections HLD-1..10 and LLD-1..12.
 * HLD topics: 130 | LLD topics: 122 | Hidden gems: 40
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
        "template": "flow"
      },
      {
        "id": "requirements-gathering",
        "title": "Requirements Gathering",
        "blurb": "Functional vs non-functional needs before you draw boxes.",
        "template": "flow"
      },
      {
        "id": "non-functional-requirements",
        "title": "Non-Functional Requirements",
        "blurb": "Latency, availability, scale, and cost constraints.",
        "template": "tradeoff"
      },
      {
        "id": "back-of-envelope-estimation",
        "title": "Back-of-Envelope Estimation",
        "blurb": "Quick capacity math before deep design.",
        "template": "flow"
      },
      {
        "id": "qps-latency-storage-math",
        "title": "QPS / Latency / Storage Math",
        "blurb": "Requests, bytes, and bandwidth sanity checks.",
        "template": "flow"
      },
      {
        "id": "sla-vs-slo",
        "title": "SLA vs SLO",
        "blurb": "Customer promise vs internal reliability target.",
        "template": "tradeoff"
      },
      {
        "id": "conways-law",
        "title": "Conway's Law",
        "blurb": "Org structure shapes system boundaries.",
        "template": "topology"
      },
      {
        "id": "technical-debt-vs-velocity",
        "title": "Technical Debt vs Velocity",
        "blurb": "Ship fast now vs pay interest later.",
        "template": "tradeoff"
      }
    ]
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
        "template": "topology"
      },
      {
        "id": "tcp-udp-tradeoffs",
        "title": "TCP vs UDP",
        "blurb": "Reliable streams vs fire-and-forget datagrams.",
        "template": "tradeoff"
      },
      {
        "id": "http-evolution",
        "title": "HTTP/1.1 → HTTP/2 → HTTP/3",
        "blurb": "Multiplexing, headers, and QUIC gains.",
        "template": "tradeoff"
      },
      {
        "id": "grpc",
        "title": "gRPC",
        "blurb": "Binary RPC with HTTP/2 and strong contracts.",
        "template": "flow"
      },
      {
        "id": "websockets",
        "title": "WebSockets",
        "blurb": "Full-duplex persistent client connections.",
        "template": "topology"
      },
      {
        "id": "sse",
        "title": "Server-Sent Events",
        "blurb": "Server push over one-way HTTP stream.",
        "template": "flow"
      },
      {
        "id": "long-polling",
        "title": "Long Polling",
        "blurb": "Hold request open until data arrives.",
        "template": "flow"
      },
      {
        "id": "webhooks",
        "title": "Webhooks",
        "blurb": "HTTP callbacks on external events.",
        "template": "flow"
      },
      {
        "id": "rest-vs-graphql",
        "title": "REST vs GraphQL",
        "blurb": "Resource URLs vs client-shaped queries.",
        "template": "tradeoff"
      },
      {
        "id": "tls-termination",
        "title": "TLS Termination",
        "blurb": "Where encryption ends: edge vs service.",
        "template": "topology"
      }
    ]
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
        "template": "topology"
      },
      {
        "id": "reverse-proxy",
        "title": "Reverse Proxy",
        "blurb": "Front door that forwards to upstreams.",
        "template": "topology"
      },
      {
        "id": "api-gateway",
        "title": "API Gateway",
        "blurb": "Edge routing, auth, and aggregation.",
        "template": "topology"
      },
      {
        "id": "cdn",
        "title": "CDN",
        "blurb": "Cache static assets close to users.",
        "template": "topology"
      },
      {
        "id": "caching-tiers",
        "title": "Caching Tiers",
        "blurb": "Browser, CDN, app, and DB cache layers.",
        "template": "layer"
      },
      {
        "id": "sql-vs-nosql-selection",
        "title": "SQL vs NoSQL Selection",
        "blurb": "Pick storage by access pattern and consistency.",
        "template": "tradeoff"
      },
      {
        "id": "partitioning-schemes",
        "title": "Partitioning Schemes",
        "blurb": "Shard by key, range, or hash.",
        "template": "dataModel"
      },
      {
        "id": "replication-topologies",
        "title": "Replication Topologies",
        "blurb": "Primary-replica, multi-leader, leaderless.",
        "template": "topology"
      },
      {
        "id": "message-queues",
        "title": "Message Queues",
        "blurb": "Decouple producers and consumers.",
        "template": "topology"
      },
      {
        "id": "kafka-vs-rabbitmq",
        "title": "Kafka vs RabbitMQ",
        "blurb": "Log vs broker semantics for messaging.",
        "template": "tradeoff"
      },
      {
        "id": "pub-sub-fanout",
        "title": "Pub/Sub Fan-out",
        "blurb": "One event, many subscribers.",
        "template": "topology"
      },
      {
        "id": "edge-rate-limiting",
        "title": "Edge Rate Limiting",
        "blurb": "Protect services before overload hits.",
        "template": "flow"
      },
      {
        "id": "service-discovery",
        "title": "Service Discovery",
        "blurb": "Find healthy instances dynamically.",
        "template": "topology"
      },
      {
        "id": "service-mesh",
        "title": "Service Mesh",
        "blurb": "Sidecar-managed traffic and security.",
        "template": "topology"
      },
      {
        "id": "blob-storage",
        "title": "Blob Storage",
        "blurb": "Durable objects for files and media.",
        "template": "topology"
      },
      {
        "id": "edge-compute",
        "title": "Edge Compute",
        "blurb": "Run logic closer to users at the edge.",
        "template": "topology",
        "tier": "hidden-gem"
      }
    ]
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
        "template": "stateMachine",
        "tier": "advanced"
      },
      {
        "id": "linearizability-vs-serializability",
        "title": "Linearizability vs Serializability",
        "blurb": "Real-time order vs transaction order.",
        "template": "tradeoff",
        "tier": "advanced"
      },
      {
        "id": "quorum-reads-writes",
        "title": "Quorum Reads / Writes",
        "blurb": "R + W > N for tunable consistency.",
        "template": "topology"
      },
      {
        "id": "cap-theorem-framing",
        "title": "CAP Theorem (HLD framing)",
        "blurb": "Under partition: consistency or availability.",
        "template": "tradeoff"
      },
      {
        "id": "pacelc",
        "title": "PACELC",
        "blurb": "If no partition: latency vs consistency.",
        "template": "tradeoff",
        "tier": "hidden-gem"
      },
      {
        "id": "hybrid-logical-clocks",
        "title": "Hybrid Logical Clocks",
        "blurb": "Physical time plus logical counters.",
        "template": "flow",
        "tier": "hidden-gem"
      },
      {
        "id": "crdt-overview",
        "title": "CRDT Overview",
        "blurb": "Conflict-free replicated data types.",
        "template": "dataModel"
      },
      {
        "id": "distributed-transactions-comparison",
        "title": "Distributed Transactions",
        "blurb": "2PC, saga, and outbox compared.",
        "template": "tradeoff",
        "tier": "advanced"
      },
      {
        "id": "exactly-once-honesty",
        "title": "Exactly-Once Honesty",
        "blurb": "End-to-end exactly-once is a myth.",
        "template": "tradeoff",
        "tier": "hidden-gem"
      },
      {
        "id": "phi-accrual-failure-detection",
        "title": "Phi Accrual Failure Detection",
        "blurb": "Probabilistic suspect-node detection.",
        "template": "stateMachine",
        "tier": "hidden-gem"
      },
      {
        "id": "consistent-hashing-placement",
        "title": "Consistent Hashing (placement)",
        "blurb": "Minimal key movement when nodes change.",
        "template": "topology"
      },
      {
        "id": "merkle-anti-entropy",
        "title": "Merkle Anti-Entropy",
        "blurb": "Tree hashes detect replica drift.",
        "template": "topology",
        "tier": "hidden-gem"
      }
    ]
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
        "template": "tradeoff"
      },
      {
        "id": "oltp-vs-olap",
        "title": "OLTP vs OLAP",
        "blurb": "Transactional rows vs analytic scans.",
        "template": "tradeoff"
      },
      {
        "id": "warehouse-lake-lakehouse",
        "title": "Warehouse vs Lake vs Lakehouse",
        "blurb": "Structured BI vs raw files vs both.",
        "template": "layer"
      },
      {
        "id": "lambda-vs-kappa",
        "title": "Lambda vs Kappa",
        "blurb": "Batch+stream dual path vs stream-only.",
        "template": "pipeline"
      },
      {
        "id": "cdc",
        "title": "Change Data Capture",
        "blurb": "Stream DB changes to downstream systems.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "search-inverted-index",
        "title": "Search / Inverted Index",
        "blurb": "Token lookup for full-text search.",
        "template": "dataModel"
      },
      {
        "id": "time-series-db",
        "title": "Time-Series DB",
        "blurb": "Append-heavy metrics and events.",
        "template": "dataModel"
      },
      {
        "id": "graph-db",
        "title": "Graph DB",
        "blurb": "Traverse relationships natively.",
        "template": "dataModel"
      },
      {
        "id": "vector-db-ann",
        "title": "Vector DB / ANN",
        "blurb": "Similarity search for embeddings.",
        "template": "dataModel"
      },
      {
        "id": "key-value-stores",
        "title": "Key-Value Stores",
        "blurb": "Simple get/put at massive scale.",
        "template": "dataModel"
      },
      {
        "id": "materialized-views",
        "title": "Materialized Views",
        "blurb": "Precomputed query results.",
        "template": "pipeline"
      },
      {
        "id": "stream-table-duality",
        "title": "Stream-Table Duality",
        "blurb": "Tables are streams; streams are tables.",
        "template": "pipeline",
        "tier": "hidden-gem"
      }
    ]
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
        "template": "tradeoff"
      },
      {
        "id": "event-driven-architecture",
        "title": "Event-Driven Architecture",
        "blurb": "Loose coupling via async events.",
        "template": "topology"
      },
      {
        "id": "cqrs",
        "title": "CQRS",
        "blurb": "Separate write and read models.",
        "template": "layer",
        "tier": "advanced"
      },
      {
        "id": "event-sourcing",
        "title": "Event Sourcing",
        "blurb": "State as append-only event log.",
        "template": "pipeline",
        "tier": "advanced"
      },
      {
        "id": "serverless-faas",
        "title": "Serverless / FaaS",
        "blurb": "Functions triggered by events.",
        "template": "topology"
      },
      {
        "id": "bff",
        "title": "Backend for Frontend",
        "blurb": "Tailored API per client type.",
        "template": "layer",
        "tier": "hidden-gem"
      },
      {
        "id": "strangler-fig",
        "title": "Strangler Fig",
        "blurb": "Gradually replace legacy system.",
        "template": "flow"
      },
      {
        "id": "hexagonal-clean-architecture",
        "title": "Hexagonal / Clean Architecture",
        "blurb": "Domain core, ports, and adapters.",
        "template": "layer"
      },
      {
        "id": "anti-corruption-layer",
        "title": "Anti-Corruption Layer",
        "blurb": "Translate foreign models at boundary.",
        "template": "layer",
        "tier": "hidden-gem"
      },
      {
        "id": "multi-region-active-active",
        "title": "Multi-Region Active-Active",
        "blurb": "Serve from multiple regions live.",
        "template": "topology"
      },
      {
        "id": "multi-tenancy-patterns",
        "title": "Multi-Tenancy Patterns",
        "blurb": "Silo, pool, and bridge isolation.",
        "template": "topology",
        "tier": "hidden-gem"
      },
      {
        "id": "local-first-crdt-apps",
        "title": "Local-First / CRDT Apps",
        "blurb": "Offline-first with mergeable state.",
        "template": "topology",
        "tier": "hidden-gem"
      },
      {
        "id": "cell-architecture-design",
        "title": "Cell Architecture (design)",
        "blurb": "Isolated failure domains at scale.",
        "template": "topology",
        "tier": "hidden-gem"
      },
      {
        "id": "scatter-gather",
        "title": "Scatter-Gather",
        "blurb": "Fan out queries, merge results.",
        "template": "flow",
        "tier": "hidden-gem"
      }
    ]
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
        "template": "layer"
      },
      {
        "id": "sli-slo-error-budgets",
        "title": "SLI / SLO / Error Budgets",
        "blurb": "Measure reliability and spend budget.",
        "template": "flow"
      },
      {
        "id": "resilience-patterns-overview",
        "title": "Resilience Patterns Overview",
        "blurb": "Bulkhead, breaker, retry, and shed.",
        "template": "topology"
      },
      {
        "id": "graceful-degradation-hld",
        "title": "Graceful Degradation",
        "blurb": "Drop features, keep core path alive.",
        "template": "stateMachine"
      },
      {
        "id": "autoscaling-hpa",
        "title": "Autoscaling / HPA",
        "blurb": "Scale replicas by load signals.",
        "template": "flow"
      },
      {
        "id": "deploy-strategies",
        "title": "Deploy Strategies",
        "blurb": "Blue-green, canary, and rolling.",
        "template": "stateMachine"
      },
      {
        "id": "chaos-engineering",
        "title": "Chaos Engineering",
        "blurb": "Inject faults to find weaknesses.",
        "template": "flow",
        "tier": "advanced"
      },
      {
        "id": "incident-response",
        "title": "Incident Response",
        "blurb": "Detect, mitigate, and postmortem.",
        "template": "flow"
      },
      {
        "id": "health-probes",
        "title": "Health / Readiness / Liveness",
        "blurb": "Kube probes gate traffic correctly.",
        "template": "stateMachine"
      },
      {
        "id": "finops",
        "title": "FinOps",
        "blurb": "Cost visibility and optimization.",
        "template": "tradeoff",
        "tier": "hidden-gem"
      },
      {
        "id": "platform-engineering-idp",
        "title": "Platform Engineering / IDP",
        "blurb": "Golden paths for product teams.",
        "template": "layer",
        "tier": "hidden-gem"
      },
      {
        "id": "poison-pill-handling",
        "title": "Poison Pill Handling",
        "blurb": "Stop bad messages from blocking queues.",
        "template": "flow",
        "tier": "hidden-gem"
      }
    ]
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
        "template": "layer"
      },
      {
        "id": "oauth2-oidc",
        "title": "OAuth2 / OIDC",
        "blurb": "Delegated auth and identity tokens.",
        "template": "flow"
      },
      {
        "id": "jwt-pitfalls",
        "title": "JWT Pitfalls",
        "blurb": "Expiry, rotation, and token size traps.",
        "template": "tradeoff"
      },
      {
        "id": "mtls-service-identity",
        "title": "mTLS / Service Identity",
        "blurb": "Mutual TLS between services.",
        "template": "topology"
      },
      {
        "id": "secrets-management",
        "title": "Secrets Management",
        "blurb": "Vault, rotation, and least privilege.",
        "template": "layer"
      },
      {
        "id": "ddos-mitigation",
        "title": "DDoS Mitigation",
        "blurb": "Absorb and scrub attack traffic.",
        "template": "topology"
      },
      {
        "id": "waf",
        "title": "WAF",
        "blurb": "Filter malicious HTTP at the edge.",
        "template": "topology"
      },
      {
        "id": "zero-trust-perimeter",
        "title": "Zero-Trust Perimeter",
        "blurb": "Never trust, always verify.",
        "template": "layer"
      }
    ]
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
        "template": "tradeoff"
      },
      {
        "id": "acid-vs-base",
        "title": "ACID vs BASE",
        "blurb": "Transactional rigor vs eventual relax.",
        "template": "tradeoff"
      },
      {
        "id": "sql-vs-nosql",
        "title": "SQL vs NoSQL",
        "blurb": "Schema, joins, and scale tradeoffs.",
        "template": "tradeoff"
      },
      {
        "id": "latency-vs-throughput",
        "title": "Latency vs Throughput",
        "blurb": "Fast p99 vs max requests/sec.",
        "template": "tradeoff"
      },
      {
        "id": "cache-strategies",
        "title": "Cache Strategies",
        "blurb": "Aside, through, around, and back.",
        "template": "tradeoff"
      },
      {
        "id": "batch-vs-stream",
        "title": "Batch vs Stream",
        "blurb": "Periodic jobs vs continuous processing.",
        "template": "tradeoff"
      },
      {
        "id": "lb-vs-proxy-vs-gateway",
        "title": "LB vs Proxy vs Gateway",
        "blurb": "Where each layer belongs.",
        "template": "tradeoff"
      },
      {
        "id": "rest-vs-grpc-vs-graphql",
        "title": "REST vs gRPC vs GraphQL",
        "blurb": "Pick API style by client needs.",
        "template": "tradeoff"
      },
      {
        "id": "polling-vs-websocket-family",
        "title": "Polling vs WebSocket Family",
        "blurb": "Pull, long poll, SSE, or socket.",
        "template": "tradeoff"
      },
      {
        "id": "rate-limit-algorithms",
        "title": "Rate-Limit Algorithms",
        "blurb": "Token bucket, leaky bucket, sliding window.",
        "template": "tradeoff"
      },
      {
        "id": "partitioning-schemes-tradeoff",
        "title": "Partitioning Schemes",
        "blurb": "Hash, range, or directory routing.",
        "template": "tradeoff"
      },
      {
        "id": "replication-topologies-tradeoff",
        "title": "Replication Topologies",
        "blurb": "Sync vs async replica lag.",
        "template": "tradeoff"
      },
      {
        "id": "two-pc-vs-saga-vs-tcc",
        "title": "2PC vs Saga vs TCC",
        "blurb": "Distributed commit patterns compared.",
        "template": "tradeoff"
      },
      {
        "id": "push-vs-pull",
        "title": "Push vs Pull",
        "blurb": "Broker delivers vs consumer polls.",
        "template": "tradeoff"
      },
      {
        "id": "lambda-vs-kappa-tradeoff",
        "title": "Lambda vs Kappa",
        "blurb": "Dual pipeline vs stream-only simplification.",
        "template": "tradeoff"
      },
      {
        "id": "vertical-vs-horizontal-scale",
        "title": "Vertical vs Horizontal Scale",
        "blurb": "Bigger machine vs more nodes.",
        "template": "tradeoff"
      },
      {
        "id": "normalization-vs-denormalization",
        "title": "Normalization vs Denormalization",
        "blurb": "Storage purity vs read speed.",
        "template": "tradeoff"
      },
      {
        "id": "single-vs-multi-region",
        "title": "Single vs Multi-Region",
        "blurb": "Simplicity vs geo resilience.",
        "template": "tradeoff"
      },
      {
        "id": "sync-vs-async-communication",
        "title": "Sync vs Async Communication",
        "blurb": "Request-response vs messaging.",
        "template": "tradeoff"
      },
      {
        "id": "stateful-vs-stateless",
        "title": "Stateful vs Stateless Services",
        "blurb": "Session stickiness vs easy scale.",
        "template": "tradeoff"
      },
      {
        "id": "pessimistic-vs-optimistic-concurrency",
        "title": "Pessimistic vs Optimistic",
        "blurb": "Lock early vs retry on conflict.",
        "template": "tradeoff"
      },
      {
        "id": "managed-vs-self-hosted",
        "title": "Managed vs Self-Hosted",
        "blurb": "Ops burden vs control and cost.",
        "template": "tradeoff"
      }
    ]
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
        "template": "topology"
      },
      {
        "id": "rate-limiter-service",
        "title": "Rate Limiter Service",
        "blurb": "Distributed token bucket service.",
        "template": "topology"
      },
      {
        "id": "news-feed",
        "title": "News Feed",
        "blurb": "Fan-out on write vs read.",
        "template": "topology"
      },
      {
        "id": "notification-system",
        "title": "Notification System",
        "blurb": "Multi-channel delivery pipeline.",
        "template": "pipeline"
      },
      {
        "id": "chat-system",
        "title": "Chat System",
        "blurb": "Real-time messaging at scale.",
        "template": "topology"
      },
      {
        "id": "file-storage-s3",
        "title": "File Storage (S3-like)",
        "blurb": "Objects, metadata, and durability.",
        "template": "topology"
      },
      {
        "id": "search-autocomplete",
        "title": "Search Autocomplete",
        "blurb": "Prefix trie and ranking.",
        "template": "pipeline"
      },
      {
        "id": "distributed-cache-design",
        "title": "Distributed Cache Design",
        "blurb": "Consistent hash and eviction.",
        "template": "topology"
      },
      {
        "id": "payment-system-hld",
        "title": "Payment System (HLD)",
        "blurb": "Meta design tying all tracks.",
        "template": "topology"
      },
      {
        "id": "ride-sharing-dispatch",
        "title": "Ride-Sharing Dispatch",
        "blurb": "Match drivers and riders live.",
        "template": "flow"
      },
      {
        "id": "ticket-booking",
        "title": "Ticket Booking",
        "blurb": "Inventory locks and oversell prevention.",
        "template": "stateMachine"
      },
      {
        "id": "video-streaming",
        "title": "Video Streaming",
        "blurb": "Encode, CDN, and adaptive bitrate.",
        "template": "pipeline"
      },
      {
        "id": "metrics-monitoring-system",
        "title": "Metrics / Monitoring System",
        "blurb": "Collect, store, and alert on metrics.",
        "template": "pipeline"
      },
      {
        "id": "distributed-cron",
        "title": "Distributed Cron",
        "blurb": "Exactly-once scheduled jobs.",
        "template": "topology"
      },
      {
        "id": "leaderboard",
        "title": "Leaderboard",
        "blurb": "Real-time ranked scores.",
        "template": "dataModel"
      },
      {
        "id": "collaborative-editor",
        "title": "Collaborative Editor",
        "blurb": "OT/CRDT for shared documents.",
        "template": "flow"
      }
    ]
  }
];

export const LLD_CATEGORIES = [
  {
    "id": "lld-oop",
    "num": 1,
    "title": "OOP & Principles",
    "desc": "Object-oriented design fundamentals.",
    "topics": [
      {
        "id": "encapsulation",
        "title": "Encapsulation",
        "blurb": "Hide state; expose behavior.",
        "template": "layer"
      },
      {
        "id": "abstraction",
        "title": "Abstraction",
        "blurb": "Model essentials, hide complexity.",
        "template": "layer"
      },
      {
        "id": "inheritance-pitfalls",
        "title": "Inheritance Pitfalls",
        "blurb": "Fragile base class and deep trees.",
        "template": "tradeoff"
      },
      {
        "id": "polymorphism",
        "title": "Polymorphism",
        "blurb": "One interface, many implementations.",
        "template": "layer"
      },
      {
        "id": "composition-over-inheritance",
        "title": "Composition over Inheritance",
        "blurb": "Build behavior by combining objects.",
        "template": "tradeoff"
      },
      {
        "id": "single-responsibility-principle",
        "title": "Single Responsibility",
        "blurb": "One reason to change per class.",
        "template": "layer"
      },
      {
        "id": "open-closed-principle",
        "title": "Open/Closed Principle",
        "blurb": "Open for extension, closed for edit.",
        "template": "layer"
      },
      {
        "id": "liskov-substitution-principle",
        "title": "Liskov Substitution",
        "blurb": "Subtypes must honor contracts.",
        "template": "layer"
      },
      {
        "id": "interface-segregation-principle",
        "title": "Interface Segregation",
        "blurb": "Small focused interfaces.",
        "template": "layer"
      },
      {
        "id": "dependency-inversion-principle",
        "title": "Dependency Inversion",
        "blurb": "Depend on abstractions, not concretes.",
        "template": "layer"
      },
      {
        "id": "dry-principle",
        "title": "DRY",
        "blurb": "Don't repeat yourself.",
        "template": "layer"
      },
      {
        "id": "kiss-yagni-principles",
        "title": "KISS & YAGNI",
        "blurb": "Simple design; build only what you need.",
        "template": "layer"
      }
    ]
  },
  {
    "id": "lld-creational",
    "num": 2,
    "title": "Creational Patterns",
    "desc": "Object creation mechanisms.",
    "topics": [
      {
        "id": "singleton",
        "title": "Singleton",
        "blurb": "One instance, global access.",
        "template": "stateMachine"
      },
      {
        "id": "factory-method",
        "title": "Factory Method",
        "blurb": "Subclass decides which type to create.",
        "template": "flow"
      },
      {
        "id": "abstract-factory",
        "title": "Abstract Factory",
        "blurb": "Families of related products.",
        "template": "layer"
      },
      {
        "id": "builder",
        "title": "Builder",
        "blurb": "Step-by-step complex object assembly.",
        "template": "flow"
      },
      {
        "id": "prototype",
        "title": "Prototype",
        "blurb": "Clone instead of construct.",
        "template": "flow"
      },
      {
        "id": "object-pool",
        "title": "Object Pool",
        "blurb": "Reuse expensive objects.",
        "template": "topology"
      },
      {
        "id": "dependency-injection",
        "title": "Dependency Injection",
        "blurb": "Inject deps from outside.",
        "template": "layer"
      }
    ]
  },
  {
    "id": "lld-structural",
    "num": 3,
    "title": "Structural Patterns",
    "desc": "Compose classes and objects.",
    "topics": [
      {
        "id": "adapter",
        "title": "Adapter",
        "blurb": "Make incompatible interfaces work.",
        "template": "layer"
      },
      {
        "id": "bridge",
        "title": "Bridge",
        "blurb": "Decouple abstraction from impl.",
        "template": "layer"
      },
      {
        "id": "composite",
        "title": "Composite",
        "blurb": "Tree of part-whole hierarchies.",
        "template": "topology"
      },
      {
        "id": "decorator",
        "title": "Decorator",
        "blurb": "Add behavior without subclassing.",
        "template": "layer"
      },
      {
        "id": "facade",
        "title": "Facade",
        "blurb": "Simple face on complex subsystem.",
        "template": "layer"
      },
      {
        "id": "flyweight",
        "title": "Flyweight",
        "blurb": "Share intrinsic state across objects.",
        "template": "topology",
        "tier": "hidden-gem"
      },
      {
        "id": "proxy",
        "title": "Proxy",
        "blurb": "Surrogate controlling access.",
        "template": "layer"
      },
      {
        "id": "module-pattern",
        "title": "Module Pattern",
        "blurb": "Encapsulate private state in closure.",
        "template": "layer",
        "tier": "hidden-gem"
      }
    ]
  },
  {
    "id": "lld-behavioral",
    "num": 4,
    "title": "Behavioral Patterns",
    "desc": "Algorithms and responsibility assignment.",
    "topics": [
      {
        "id": "strategy",
        "title": "Strategy",
        "blurb": "Swap algorithms at runtime.",
        "template": "stateMachine"
      },
      {
        "id": "observer",
        "title": "Observer",
        "blurb": "Notify dependents on change.",
        "template": "flow"
      },
      {
        "id": "command",
        "title": "Command",
        "blurb": "Encapsulate request as object.",
        "template": "stateMachine"
      },
      {
        "id": "state",
        "title": "State",
        "blurb": "Behavior changes with internal state.",
        "template": "stateMachine"
      },
      {
        "id": "template-method",
        "title": "Template Method",
        "blurb": "Skeleton algorithm, subclass steps.",
        "template": "flow"
      },
      {
        "id": "iterator",
        "title": "Iterator",
        "blurb": "Traverse without exposing structure.",
        "template": "flow"
      },
      {
        "id": "chain-of-responsibility",
        "title": "Chain of Responsibility",
        "blurb": "Pass request along handler chain.",
        "template": "flow"
      },
      {
        "id": "mediator",
        "title": "Mediator",
        "blurb": "Central hub reduces mesh coupling.",
        "template": "topology"
      },
      {
        "id": "memento",
        "title": "Memento",
        "blurb": "Capture and restore object state.",
        "template": "stateMachine"
      },
      {
        "id": "visitor",
        "title": "Visitor",
        "blurb": "New ops without changing classes.",
        "template": "flow"
      },
      {
        "id": "interpreter",
        "title": "Interpreter",
        "blurb": "Grammar as class hierarchy.",
        "template": "stateMachine",
        "tier": "hidden-gem"
      },
      {
        "id": "specification-pattern",
        "title": "Specification Pattern",
        "blurb": "Composable business rule predicates.",
        "template": "layer",
        "tier": "hidden-gem"
      }
    ]
  },
  {
    "id": "lld-dist-patterns",
    "num": 5,
    "title": "Distributed / Microservice Patterns",
    "desc": "Implementation patterns for services.",
    "topics": [
      {
        "id": "transactional-outbox",
        "title": "Transactional Outbox",
        "blurb": "Atomically write DB + outbox row.",
        "template": "pipeline"
      },
      {
        "id": "db-cache-dual-write",
        "title": "DB + Cache Dual Write",
        "blurb": "DB + cache have no shared txn — invalidate via outbox-style relay.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "inbox-pattern",
        "title": "Inbox / Idempotent Consumer",
        "blurb": "Dedup incoming messages safely.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "cdc-relay",
        "title": "CDC Relay",
        "blurb": "Poll or stream outbox to broker.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "sidecar",
        "title": "Sidecar",
        "blurb": "Helper container beside main app.",
        "template": "topology"
      },
      {
        "id": "ambassador",
        "title": "Ambassador",
        "blurb": "Proxy outbound calls from app.",
        "template": "topology"
      },
      {
        "id": "saga-choreography",
        "title": "Saga Choreography",
        "blurb": "Services react to events, no central.",
        "template": "flow"
      },
      {
        "id": "saga-orchestration",
        "title": "Saga Orchestration",
        "blurb": "Central coordinator drives steps.",
        "template": "stateMachine"
      },
      {
        "id": "cqrs-read-write-models",
        "title": "CQRS Read/Write Models",
        "blurb": "Separate schemas for commands vs queries.",
        "template": "layer"
      },
      {
        "id": "event-sourcing-projection",
        "title": "Event Sourcing Projection",
        "blurb": "Build read model from event log.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "claim-check",
        "title": "Claim Check",
        "blurb": "Store payload elsewhere; pass reference.",
        "template": "flow",
        "tier": "hidden-gem"
      },
      {
        "id": "process-manager",
        "title": "Process Manager",
        "blurb": "Long-running workflow coordinator.",
        "template": "stateMachine",
        "tier": "hidden-gem"
      },
      {
        "id": "wire-tap",
        "title": "Wire Tap",
        "blurb": "Tap message stream for audit/debug.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "content-enricher",
        "title": "Content Enricher",
        "blurb": "Augment message with lookup data.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "message-router",
        "title": "Message Router",
        "blurb": "Route by content or rules.",
        "template": "flow"
      },
      {
        "id": "splitter-aggregator",
        "title": "Splitter / Aggregator",
        "blurb": "Split batch; merge correlated replies.",
        "template": "flow"
      },
      {
        "id": "competing-consumers",
        "title": "Competing Consumers",
        "blurb": "Parallel workers on one queue.",
        "template": "topology"
      },
      {
        "id": "priority-queue-consumer",
        "title": "Priority Queue Consumer",
        "blurb": "High-priority messages first.",
        "template": "topology"
      },
      {
        "id": "strangler-code-level",
        "title": "Strangler at Code Level",
        "blurb": "Replace module behind facade.",
        "template": "layer"
      }
    ]
  },
  {
    "id": "lld-async",
    "num": 6,
    "title": "Async & Messaging Patterns",
    "desc": "Asynchronous communication styles.",
    "topics": [
      {
        "id": "fire-and-forget",
        "title": "Fire-and-Forget",
        "blurb": "Send without waiting for reply.",
        "template": "flow"
      },
      {
        "id": "request-reply",
        "title": "Request-Reply",
        "blurb": "Async call with correlation ID.",
        "template": "flow"
      },
      {
        "id": "pub-sub-pattern",
        "title": "Pub/Sub",
        "blurb": "Publish to topic; many subscribe.",
        "template": "topology"
      },
      {
        "id": "point-to-point",
        "title": "Point-to-Point",
        "blurb": "One producer, one consumer queue.",
        "template": "topology"
      },
      {
        "id": "work-queue",
        "title": "Work Queue",
        "blurb": "Distribute tasks to workers.",
        "template": "topology"
      },
      {
        "id": "delayed-scheduled-messages",
        "title": "Delayed / Scheduled Messages",
        "blurb": "Deliver at future time.",
        "template": "stateMachine"
      },
      {
        "id": "dead-letter-pattern",
        "title": "Dead Letter Pattern",
        "blurb": "Park failed messages for review.",
        "template": "flow",
        "related": [
          "dead-letter-queue"
        ]
      },
      {
        "id": "backpressure-pattern",
        "title": "Backpressure Pattern",
        "blurb": "Slow producer when consumer lags.",
        "template": "flow",
        "related": [
          "backpressure"
        ]
      },
      {
        "id": "outbox-inbox-combo",
        "title": "Outbox + Inbox Combo",
        "blurb": "Reliable handoff between services.",
        "template": "pipeline",
        "tier": "hidden-gem"
      },
      {
        "id": "event-notification-vs-ecst",
        "title": "Event Notification vs ECST",
        "blurb": "Light ping vs full state in event.",
        "template": "tradeoff",
        "tier": "hidden-gem"
      }
    ]
  },
  {
    "id": "lld-api",
    "num": 7,
    "title": "API & Service Design",
    "desc": "Designing service boundaries and APIs.",
    "topics": [
      {
        "id": "rest-resource-modeling",
        "title": "REST Resource Modeling",
        "blurb": "Nouns, verbs, and status codes.",
        "template": "dataModel"
      },
      {
        "id": "api-versioning-strategies",
        "title": "API Versioning Strategies",
        "blurb": "URL, header, or content negotiation.",
        "template": "tradeoff"
      },
      {
        "id": "pagination-offset-cursor",
        "title": "Pagination (Offset vs Cursor)",
        "blurb": "Page through large result sets.",
        "template": "tradeoff"
      },
      {
        "id": "error-contract-design",
        "title": "Error Contract Design",
        "blurb": "Stable error codes and bodies.",
        "template": "layer"
      },
      {
        "id": "correlation-trace-ids",
        "title": "Correlation / Trace IDs",
        "blurb": "Follow one request end-to-end.",
        "template": "flow"
      },
      {
        "id": "api-idempotency",
        "title": "API Idempotency",
        "blurb": "Safe retries on POST/charge.",
        "template": "flow",
        "related": [
          "idempotency-key"
        ]
      },
      {
        "id": "contract-first-vs-code-first",
        "title": "Contract-First vs Code-First",
        "blurb": "Schema drives code or reverse.",
        "template": "tradeoff"
      },
      {
        "id": "hateoas",
        "title": "HATEOAS",
        "blurb": "Hypermedia links in responses.",
        "template": "flow",
        "tier": "hidden-gem"
      },
      {
        "id": "grpc-service-design",
        "title": "gRPC Service Design",
        "blurb": "Proto services, streams, and errors.",
        "template": "layer"
      },
      {
        "id": "graphql-schema-design",
        "title": "GraphQL Schema Design",
        "blurb": "Types, resolvers, and N+1 traps.",
        "template": "dataModel"
      }
    ]
  },
  {
    "id": "lld-db",
    "num": 8,
    "title": "Database Design",
    "desc": "Schema, indexing, and persistence.",
    "topics": [
      {
        "id": "er-modeling",
        "title": "ER Modeling",
        "blurb": "Entities, relationships, cardinality.",
        "template": "dataModel"
      },
      {
        "id": "normal-forms-bcnf",
        "title": "1NF–3NF / BCNF",
        "blurb": "Reduce redundancy systematically.",
        "template": "dataModel"
      },
      {
        "id": "denormalization-patterns",
        "title": "Denormalization Patterns",
        "blurb": "Duplicate data for read speed.",
        "template": "tradeoff"
      },
      {
        "id": "primary-foreign-keys",
        "title": "Primary / Foreign Keys",
        "blurb": "Identity and referential integrity.",
        "template": "dataModel"
      },
      {
        "id": "indexing-strategies",
        "title": "Indexing Strategies",
        "blurb": "B-tree, covering, and partial indexes.",
        "template": "dataModel"
      },
      {
        "id": "soft-delete",
        "title": "Soft Delete",
        "blurb": "Flag deleted; keep history.",
        "template": "dataModel"
      },
      {
        "id": "audit-tables",
        "title": "Audit Tables",
        "blurb": "Who changed what and when.",
        "template": "dataModel"
      },
      {
        "id": "optimistic-locking-schema",
        "title": "Optimistic Locking Schema",
        "blurb": "Version column for CAS updates.",
        "template": "dataModel"
      },
      {
        "id": "multi-tenant-schema",
        "title": "Multi-Tenant Schema",
        "blurb": "Shared DB, schema, or database.",
        "template": "dataModel"
      },
      {
        "id": "temporal-tables",
        "title": "Temporal Tables",
        "blurb": "Valid-time row history in SQL.",
        "template": "dataModel",
        "tier": "hidden-gem"
      },
      {
        "id": "scd-type-1-2",
        "title": "SCD Type 1 / 2",
        "blurb": "Overwrite vs track dimension history.",
        "template": "dataModel",
        "tier": "hidden-gem"
      },
      {
        "id": "read-replica-routing",
        "title": "Read Replica Routing",
        "blurb": "Send reads to lag-tolerant replicas.",
        "template": "topology"
      },
      {
        "id": "connection-pooling",
        "title": "Connection Pooling",
        "blurb": "Reuse DB connections efficiently.",
        "template": "topology"
      },
      {
        "id": "transactional-boundaries",
        "title": "Transactional Boundaries",
        "blurb": "Where to start and commit units.",
        "template": "layer"
      }
    ]
  },
  {
    "id": "lld-concurrency",
    "num": 9,
    "title": "Concurrency & Parallelism",
    "desc": "Threads, async, and parallel design.",
    "topics": [
      {
        "id": "threads-vs-async",
        "title": "Threads vs Async",
        "blurb": "OS threads vs event loop model.",
        "template": "tradeoff"
      },
      {
        "id": "thread-pool",
        "title": "Thread Pool",
        "blurb": "Bounded workers for CPU/IO tasks.",
        "template": "topology"
      },
      {
        "id": "producer-consumer",
        "title": "Producer-Consumer",
        "blurb": "Queue decouples rates.",
        "template": "pipeline"
      },
      {
        "id": "readers-writers",
        "title": "Readers-Writers",
        "blurb": "Many readers or one writer.",
        "template": "stateMachine"
      },
      {
        "id": "lock-free-atomic",
        "title": "Lock-Free / Atomic",
        "blurb": "CAS instead of mutex.",
        "template": "stateMachine",
        "tier": "advanced"
      },
      {
        "id": "actor-model",
        "title": "Actor Model",
        "blurb": "Isolated actors, message mailboxes.",
        "template": "topology",
        "tier": "advanced"
      },
      {
        "id": "reactive-streams",
        "title": "Reactive Streams",
        "blurb": "Backpressured async pipelines.",
        "template": "pipeline",
        "tier": "advanced"
      },
      {
        "id": "async-await-pitfalls",
        "title": "Async/Await Pitfalls",
        "blurb": "Deadlocks, context, and fire-and-forget.",
        "template": "flow"
      },
      {
        "id": "virtual-threads",
        "title": "Virtual Threads",
        "blurb": "Lightweight threads on JVM.",
        "template": "topology",
        "tier": "hidden-gem"
      },
      {
        "id": "structured-concurrency",
        "title": "Structured Concurrency",
        "blurb": "Scoped task lifetimes.",
        "template": "layer",
        "tier": "hidden-gem"
      }
    ]
  },
  {
    "id": "lld-ddd",
    "num": 10,
    "title": "Clean Architecture & DDD",
    "desc": "Domain-driven design in code.",
    "topics": [
      {
        "id": "layered-architecture",
        "title": "Layered Architecture",
        "blurb": "Presentation, domain, persistence.",
        "template": "layer"
      },
      {
        "id": "hexagonal-ports-adapters",
        "title": "Hexagonal Ports & Adapters",
        "blurb": "Domain core with plug-in edges.",
        "template": "layer"
      },
      {
        "id": "bounded-context",
        "title": "Bounded Context",
        "blurb": "Explicit model boundary.",
        "template": "topology"
      },
      {
        "id": "aggregate-root",
        "title": "Aggregate Root",
        "blurb": "Consistency boundary for writes.",
        "template": "dataModel"
      },
      {
        "id": "domain-vs-integration-events",
        "title": "Domain vs Integration Events",
        "blurb": "Inside context vs cross-boundary.",
        "template": "flow",
        "tier": "hidden-gem"
      },
      {
        "id": "repository-pattern",
        "title": "Repository Pattern",
        "blurb": "Collection-like persistence API.",
        "template": "layer"
      },
      {
        "id": "value-objects",
        "title": "Value Objects",
        "blurb": "Immutable defined by attributes.",
        "template": "dataModel"
      },
      {
        "id": "anti-corruption-code-boundary",
        "title": "Anti-Corruption at Code",
        "blurb": "Translate legacy API at adapter.",
        "template": "layer",
        "tier": "hidden-gem"
      },
      {
        "id": "cqrs-handler-separation",
        "title": "CQRS Handler Separation",
        "blurb": "Command vs query handlers.",
        "template": "layer"
      },
      {
        "id": "event-storming-to-code",
        "title": "Event Storming to Code",
        "blurb": "From sticky notes to aggregates.",
        "template": "flow",
        "tier": "hidden-gem"
      }
    ]
  },
  {
    "id": "lld-testing",
    "num": 11,
    "title": "Testing & Quality",
    "desc": "Verify design through tests.",
    "topics": [
      {
        "id": "unit-integration-contract",
        "title": "Unit vs Integration vs Contract",
        "blurb": "Test pyramid layers.",
        "template": "layer"
      },
      {
        "id": "test-doubles",
        "title": "Test Doubles",
        "blurb": "Mocks, stubs, fakes, and spies.",
        "template": "layer"
      },
      {
        "id": "tdd-for-lld",
        "title": "TDD for LLD",
        "blurb": "Red-green-refactor drives design.",
        "template": "flow"
      },
      {
        "id": "property-based-testing",
        "title": "Property-Based Testing",
        "blurb": "Generate inputs; assert invariants.",
        "template": "flow",
        "tier": "hidden-gem"
      },
      {
        "id": "consumer-driven-contracts",
        "title": "Consumer-Driven Contracts",
        "blurb": "Pact-style API agreements.",
        "template": "flow"
      },
      {
        "id": "mutation-testing",
        "title": "Mutation Testing",
        "blurb": "Kill mutants to measure tests.",
        "template": "flow",
        "tier": "hidden-gem"
      }
    ]
  },
  {
    "id": "lld-classics",
    "num": 12,
    "title": "Classic LLD Problems",
    "desc": "Interview design walkthroughs.",
    "topics": [
      {
        "id": "parking-lot",
        "title": "Parking Lot",
        "blurb": "Spots, vehicles, and pricing.",
        "template": "dataModel"
      },
      {
        "id": "elevator",
        "title": "Elevator",
        "blurb": "Scheduling and direction logic.",
        "template": "stateMachine"
      },
      {
        "id": "lru-cache",
        "title": "LRU Cache",
        "blurb": "Hash map + doubly linked list.",
        "template": "dataModel"
      },
      {
        "id": "in-memory-pub-sub",
        "title": "In-Memory Pub-Sub",
        "blurb": "Topics, subscribers, and delivery.",
        "template": "topology"
      },
      {
        "id": "rate-limiter-in-process",
        "title": "Rate Limiter (In-Process)",
        "blurb": "Token bucket in one JVM/process.",
        "template": "stateMachine"
      }
    ]
  }
];

export const HLD_TOPIC_COUNT = 130;
export const LLD_TOPIC_COUNT = 122;
