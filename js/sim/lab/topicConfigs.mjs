/**
 * Per-topic lab configs — domain-faithful behavior for interactive topics.
 */
import { C } from "../primitives.js";
import { layoutRow } from "./layout.js";

function chain3(ids, titles, colors, kinds = {}) {
  const slots = layoutRow(3, { y: 240, margin: 70 });
  return slots.map((s, i) => ({ ...s, id: ids[i], title: titles[i], color: colors[i], kind: kinds[ids[i]] }));
}

function chain4(ids, titles, colors, kinds = {}) {
  const slots = layoutRow(4, { y: 240, margin: 40, w: 120, h: 56 });
  return slots.map((s, i) => ({ ...s, id: ids[i], title: titles[i], color: colors[i], kind: kinds[ids[i]] }));
}

const ARCH = {
  "load-balancer-l4-l7": {
    note: "Trace a request. Toggle L7 to compare HTTP path routing vs L4 TCP forwarding. Toggle unhealthy backend — LB skips it.",
    toggles: [
      { key: "l7", label: "L7 (HTTP) mode", kind: "ok", value: false },
      { key: "backendDown", label: "Backend B unhealthy", kind: "err", value: false },
    ],
    nodes: (ctx) => {
      const [client, lb] = layoutRow(2, { y: 260, margin: 60, w: 120, h: 56, totalW: 380 });
      const backendSlots = layoutRow(2, { y: 160, margin: 520, w: 130, h: 56, totalW: 300 });
      return [
        { ...client, id: "client", title: "Client", color: C.client },
        {
          ...lb,
          id: "lb",
          title: ctx.toggles.l7 ? "L7 LB" : "L4 LB",
          color: C.accent,
          value: ctx.toggles.l7 ? "HTTP aware" : "IP:port",
        },
        { ...backendSlots[0], id: "backendA", title: "Backend A", color: C.ok },
        {
          ...backendSlots[1],
          id: "backendB",
          y: 320,
          title: "Backend B",
          color: C.service,
          down: (c) => c.toggles.backendDown,
        },
      ];
    },
    getHops: (ctx) => {
      const { l7, backendDown } = ctx.toggles;
      const target = backendDown ? "backendA" : "backendB";
      if (l7) {
        return [
          { from: "client", to: "lb", label: "HTTP /wallet" },
          { from: "lb", to: target, label: backendDown ? "skip B → A" : "path route" },
        ];
      }
      return [
        { from: "client", to: "lb", label: "TCP :443" },
        { from: "lb", to: target, label: backendDown ? "skip B" : "round-robin" },
      ];
    },
    status: (ctx) => {
      const { l7, backendDown } = ctx.toggles;
      const target = ctx.state.lastTarget;
      if (!target) return { text: "Click Trace request — L4 forwards TCP; L7 routes by HTTP path", cls: "" };
      if (backendDown && target === "backendA") {
        return {
          text: l7
            ? "L7: path route fell back to healthy Backend A"
            : "L4: health check skipped Backend B — routed to healthy Backend A",
          cls: "ok",
        };
      }
      if (target === "backendB") {
        return {
          text: l7 ? "L7: routed by HTTP path to Backend B" : "L4: TCP round-robin to Backend B",
          cls: "ok",
        };
      }
      return { text: "Click Trace request", cls: "" };
    },
  },
  "reverse-proxy": {
    note: "Trace ingress through nginx. Toggle bypass to hit a pod IP directly (no TLS/WAF). Toggle unhealthy pod — proxy skips it.",
    actionLabel: "Trace ingress",
    toggles: [
      { key: "bypass", label: "Bypass proxy (pod IP)", kind: "warn", value: false },
      { key: "podDown", label: "Pod-2 unhealthy", kind: "err", value: false },
    ],
    nodes: (ctx) => {
      const [client, proxy] = layoutRow(2, { y: 260, margin: 80, w: 120, h: 56, totalW: 400 });
      const pods = layoutRow(2, { y: 160, margin: 520, w: 120, h: 56, totalW: 280 });
      return [
        { ...client, id: "client", title: "Client", color: C.client },
        { ...proxy, id: "proxy", title: "nginx Ingress", color: C.accent, value: "TLS + WAF" },
        { ...pods[0], id: "pod1", title: "Order Pod-1", color: C.ok },
        {
          ...pods[1],
          id: "pod2",
          y: 320,
          title: "Order Pod-2",
          color: C.service,
          down: (c) => c.toggles.podDown,
        },
      ];
    },
    getHops: (ctx) => {
      const { bypass, podDown } = ctx.toggles;
      if (bypass) {
        return [{ from: "client", to: "pod2", label: "direct IP", stale: podDown }];
      }
      const target = podDown ? "pod1" : "pod2";
      return [
        { from: "client", to: "proxy", label: "TLS terminate" },
        { from: "proxy", to: target, label: podDown ? "skip Pod-2" : "least_conn" },
      ];
    },
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Trace ingress — reverse proxy owns the public hostname", cls: "" };
      }
      if (ctx.toggles.bypass && ctx.toggles.podDown) {
        return { text: "Bypass hit dead Pod-2 — connection refused after deploy", cls: "err" };
      }
      if (ctx.toggles.bypass) {
        return { text: "Bypassed proxy — no TLS termination, WAF, or health-aware routing", cls: "warn" };
      }
      if (ctx.toggles.podDown) {
        return { text: "nginx skipped unhealthy Pod-2 — routed to Pod-1", cls: "ok" };
      }
      return { text: "Proxied via nginx — least_conn picked healthy upstream", cls: "ok" };
    },
  },
  "api-gateway": {
    note: "Trace API call. Toggle missing auth or quota — gateway rejects before the service.",
    toggles: [
      { key: "noAuth", label: "Missing JWT", kind: "err", value: false },
      { key: "overQuota", label: "Over API quota", kind: "warn", value: false },
    ],
    nodes: (() => {
      const [client, gateway, service] = layoutRow(3, { y: 240, margin: 70 });
      return [
        { ...client, id: "client", title: "Mobile App", color: C.client },
        { ...gateway, id: "gateway", title: "API Gateway", color: C.accent, value: "auth + quota" },
        { ...service, id: "service", title: "Order Service", color: C.service },
      ];
    })(),
    getHops: (ctx) => {
      if (ctx.toggles.noAuth) {
        return [{ from: "client", to: "gateway", label: "401 reject", stale: true }];
      }
      if (ctx.toggles.overQuota) {
        return [{ from: "client", to: "gateway", label: "429 quota", stale: true }];
      }
      return [
        { from: "client", to: "gateway", label: "JWT ok" },
        { from: "gateway", to: "service", label: "route /orders" },
      ];
    },
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Trace request — gateway centralizes auth, routing, and rate limits", cls: "" };
      }
      if (ctx.toggles.noAuth) return { text: "401 Unauthorized — JWT missing or invalid at gateway", cls: "err" };
      if (ctx.toggles.overQuota) return { text: "429 Quota exceeded — gateway shed before backend overload", cls: "warn" };
      return { text: "Authenticated request routed to Order Service", cls: "ok" };
    },
  },
  cdn: {
    note: "Trace asset fetch. Toggle cache hit to serve from edge without origin round-trip.",
    toggles: [{ key: "cacheHit", label: "CDN cache hit", kind: "ok", value: false }],
    nodes: (() => {
      const [client, cdn, origin] = layoutRow(3, { y: 240, margin: 70 });
      return [
        { ...client, id: "client", title: "Browser", color: C.client },
        { ...cdn, id: "cdn", title: "CDN Edge PoP", color: C.accent, value: "static assets" },
        { ...origin, id: "origin", title: "Origin S3", color: C.service },
      ];
    })(),
    getHops: (ctx) => ctx.toggles.cacheHit
      ? [{ from: "client", to: "cdn", label: "HIT" }]
      : [
          { from: "client", to: "cdn", label: "MISS" },
          { from: "cdn", to: "origin", label: "fetch + cache" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Trace request — CDN caches immutable assets at the edge", cls: "" };
      }
      return ctx.toggles.cacheHit
        ? { text: "Cache HIT — served from edge PoP (~10 ms, no origin load)", cls: "ok" }
        : { text: "Cache MISS — origin fetch then populate edge cache", cls: "warn" };
    },
  },
  "message-queues": {
    note: "Publish async — producer returns immediately. Toggle poison message to route to DLQ after retries.",
    actionLabel: "Publish event",
    toggles: [{ key: "poison", label: "Poison message", kind: "err", value: false }],
    nodes: chain4(
      ["producer", "broker", "consumer", "dlq"],
      ["Order Service", "Kafka Broker", "Email Worker", "Dead Letter Q"],
      [C.client, C.queue, C.service, C.err],
      { dlq: "queue" },
    ),
    getHops: (ctx) => ctx.toggles.poison
      ? [
          { from: "producer", to: "broker", label: "publish" },
          { from: "broker", to: "consumer", label: "fail N×" },
          { from: "consumer", to: "dlq", label: "dead-letter" },
        ]
      : [
          { from: "producer", to: "broker", label: "publish" },
          { from: "broker", to: "consumer", label: "deliver" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Publish event — producer does not wait for consumer", cls: "" };
      }
      if (ctx.toggles.poison) {
        return { text: "Poison message moved to DLQ after max retries — consumer unblocked", cls: "warn" };
      }
      return { text: "Async delivery complete — at-least-once with idempotent handler", cls: "ok" };
    },
  },
  "service-mesh": {
    note: "Toggle sidecar proxy — traffic routes through Envoy with mTLS, retries, and circuit breaking.",
    toggles: [{ key: "mesh", label: "Sidecar proxy enabled", kind: "ok", value: true }],
    nodes: (() => {
      const [svcA, sidecar, svcB] = layoutRow(3, { y: 240, margin: 70 });
      return [
        { ...svcA, id: "svcA", title: "Order Pod", color: C.client },
        { ...sidecar, id: "sidecar", title: "Envoy Sidecar", color: C.accent, value: "mTLS" },
        { ...svcB, id: "svcB", title: "Ledger Pod", color: C.service },
      ];
    })(),
    getHops: (ctx) => ctx.toggles.mesh
      ? [
          { from: "svcA", to: "sidecar", label: "mTLS" },
          { from: "sidecar", to: "svcB", label: "retry + CB" },
        ]
      : [{ from: "svcA", to: "svcB", label: "plain HTTP" }],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Trace request — mesh adds L7 policy without app code changes", cls: "" };
      }
      return ctx.toggles.mesh
        ? { text: "Traffic via sidecar — mTLS, retries, and circuit breaker enforced", cls: "ok" }
        : { text: "Direct pod-to-pod — no mTLS or automatic retries", cls: "warn" };
    },
  },
  "url-shortener": {
    note: "Redirect lookup: check Redis cache first, then hash DB for long URL.",
    actionLabel: "Redirect lookup",
    toggles: [{ key: "cacheHit", label: "Redis cache hit", kind: "ok", value: false }],
    nodes: chain4(
      ["client", "api", "redis", "db"],
      ["Browser", "Redirect API", "Redis Cache", "Hash DB"],
      [C.client, C.accent, C.ok, C.ledger],
      { redis: "db", db: "db" },
    ),
    getHops: (ctx) => ctx.toggles.cacheHit
      ? [
          { from: "client", to: "api", label: "GET /abc" },
          { from: "api", to: "redis", label: "cache HIT" },
        ]
      : [
          { from: "client", to: "api", label: "GET /abc" },
          { from: "api", to: "redis", label: "MISS" },
          { from: "redis", to: "db", label: "lookup" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Redirect lookup — hot short codes live in Redis", cls: "" };
      }
      return ctx.toggles.cacheHit
        ? { text: "302 redirect from cache — sub-ms lookup for viral links", cls: "ok" }
        : { text: "Cache miss — hash DB lookup then warm Redis", cls: "warn" };
    },
  },
  "rate-limiter-service": {
    note: "Toggle burst traffic — excess requests rejected at the limiter before hitting the API.",
    actionLabel: "Send request",
    toggles: [{ key: "burst", label: "Burst traffic", kind: "warn", value: false }],
    nodes: chain3(
      ["clients", "limiter", "api"],
      ["Clients", "Rate Limiter", "Payment API"],
      [C.client, C.accent, C.service],
    ),
    getHops: (ctx) => ctx.toggles.burst
      ? [{ from: "clients", to: "limiter", label: "429", stale: true }]
      : [
          { from: "clients", to: "limiter", label: "token ok" },
          { from: "limiter", to: "api", label: "forward" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Send request — token bucket enforces per-client quota", cls: "" };
      }
      return ctx.toggles.burst
        ? { text: "429 Too Many Requests — shed at edge, protect downstream API", cls: "err" }
        : { text: "Within rate limit — request forwarded to Payment API", cls: "ok" };
    },
  },
  "news-feed": {
    note: "Toggle fan-out on write (push) vs pull on read — classic feed scaling tradeoff.",
    actionLabel: "Publish post",
    toggles: [{ key: "fanOutWrite", label: "Fan-out on write", kind: "ok", value: true }],
    nodes: (ctx) => {
      if (ctx.toggles.fanOutWrite) {
        const [user, write, fanout] = layoutRow(3, { y: 220, margin: 50 });
        const fanoutNode = { ...fanout, id: "fanout", y: 300, title: "Fan-out Worker", color: C.queue };
        const feeds = { id: "feeds", x: fanoutNode.x, y: fanoutNode.y + 78, w: 130, h: 56, title: "Feed caches", color: C.ok };
        return [
          { ...user, id: "user", title: "Poster", color: C.client },
          { ...write, id: "write", y: 200, title: "Post DB", color: C.ledger, kind: "db" },
          fanoutNode,
          feeds,
        ];
      }
      const [follower, api, posts] = layoutRow(3, { y: 240, margin: 70 });
      return [
        { ...follower, id: "follower", title: "Follower", color: C.client },
        { ...api, id: "feedApi", title: "Feed API", color: C.accent },
        { ...posts, id: "posts", title: "Post DB", color: C.ledger, kind: "db" },
      ];
    },
    getHops: (ctx) => ctx.toggles.fanOutWrite
      ? [
          { from: "user", to: "write", label: "write post" },
          { from: "write", to: "fanout", label: "event" },
          { from: "fanout", to: "feeds", label: "push to followers" },
        ]
      : [
          { from: "follower", to: "feedApi", label: "GET /feed" },
          { from: "feedApi", to: "posts", label: "pull & merge" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Publish post — compare push (fan-out on write) vs pull on read", cls: "" };
      }
      return ctx.toggles.fanOutWrite
        ? { text: "Fan-out on write — pre-computed feeds, fast reads for celebrities", cls: "ok" }
        : { text: "Pull on read — merge at request time, cheaper for sparse posters", cls: "ok" };
    },
  },
  "chat-system": {
    note: "WebSocket path for real-time delivery. Toggle offline recipient — message persists for later.",
    actionLabel: "Send message",
    toggles: [{ key: "offline", label: "Recipient offline", kind: "warn", value: false }],
    nodes: chain4(
      ["client", "ws", "store", "room"],
      ["Sender", "WS Gateway", "Message Store", "Chat Room"],
      [C.client, C.accent, C.queue, C.service],
      { store: "queue" },
    ),
    getHops: (ctx) => ctx.toggles.offline
      ? [
          { from: "client", to: "ws", label: "upgrade" },
          { from: "ws", to: "store", label: "persist" },
        ]
      : [
          { from: "client", to: "ws", label: "upgrade" },
          { from: "ws", to: "room", label: "broadcast" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Send message — WebSocket keeps a persistent duplex channel", cls: "" };
      }
      return ctx.toggles.offline
        ? { text: "Recipient offline — message stored, delivered on reconnect", cls: "warn" }
        : { text: "Message delivered via WebSocket broadcast to room", cls: "ok" };
    },
  },
  "payment-system-hld": {
    note: "Charge flow: Order → Gateway authorize → Ledger capture. Toggle duplicate idempotency key.",
    actionLabel: "Charge wallet",
    toggles: [{ key: "duplicate", label: "Duplicate idempotency key", kind: "warn", value: false }],
    nodes: chain4(
      ["client", "order", "gateway", "ledger"],
      ["Client", "Order Svc", "Payment GW", "Ledger DB"],
      [C.client, C.service, C.gateway, C.ledger],
      { ledger: "db" },
    ),
    getHops: (ctx) => ctx.toggles.duplicate
      ? [{ from: "client", to: "order", label: "dedupe 409", stale: true }]
      : [
          { from: "client", to: "order", label: "charge" },
          { from: "order", to: "gateway", label: "authorize" },
          { from: "gateway", to: "ledger", label: "capture" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Charge wallet — trace Order → Gateway → Ledger", cls: "" };
      }
      if (ctx.toggles.duplicate) {
        return { text: "409 Duplicate — idempotency key already processed, no double charge", cls: "warn" };
      }
      return { text: "Payment captured on ledger — authorize then capture", cls: "ok" };
    },
  },
  "ticket-booking": {
    note: "Reserve seat with pessimistic lock, then confirm. Toggle seat already held.",
    actionLabel: "Book seat",
    toggles: [{ key: "soldOut", label: "Seat already held", kind: "err", value: false }],
    nodes: chain3(
      ["user", "booking", "inventory"],
      ["User", "Booking Svc", "Seat Inventory"],
      [C.client, C.accent, C.ledger],
      { inventory: "db" },
    ),
    getHops: (ctx) => ctx.toggles.soldOut
      ? [{ from: "user", to: "booking", label: "hold fail", stale: true }]
      : [
          { from: "user", to: "booking", label: "hold" },
          { from: "booking", to: "inventory", label: "lock seat" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Book seat — pessimistic lock prevents double booking", cls: "" };
      }
      return ctx.toggles.soldOut
        ? { text: "409 Seat unavailable — another user holds the lock", cls: "err" }
        : { text: "Seat held successfully — inventory row locked", cls: "ok" };
    },
  },
  "thread-pool": {
    note: "Submit tasks to bounded queue — workers drain. Toggle saturated pool to see rejection.",
    actionLabel: "Submit task",
    toggles: [{ key: "saturated", label: "Pool saturated", kind: "err", value: false }],
    nodes: chain3(
      ["tasks", "queue", "workers"],
      ["Submitters", "Work Queue", "Worker Pool"],
      [C.client, C.queue, C.service],
    ),
    getHops: (ctx) => ctx.toggles.saturated
      ? [{ from: "tasks", to: "queue", label: "rejected", stale: true }]
      : [
          { from: "tasks", to: "queue", label: "enqueue" },
          { from: "queue", to: "workers", label: "execute" },
        ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Submit task — fixed workers cap concurrency", cls: "" };
      }
      return ctx.toggles.saturated
        ? { text: "Rejected — bounded queue full, CallerRuns or fail-fast", cls: "err" }
        : { text: "Task executed by worker — queue depth bounded", cls: "ok" };
    },
  },
  "producer-consumer": {
    note: "Producer fills buffer. Toggle slow consumer — buffer backs up (backpressure signal).",
    actionLabel: "Produce item",
    toggles: [{ key: "slowConsumer", label: "Slow consumer", kind: "warn", value: false }],
    nodes: chain3(
      ["producer", "buffer", "consumer"],
      ["Producer", "Bounded Buffer", "Consumer"],
      [C.client, C.queue, C.service],
    ),
    getHops: (ctx) => [
      { from: "producer", to: "buffer", label: "produce" },
      { from: "buffer", to: "consumer", label: ctx.toggles.slowConsumer ? "slow drain" : "consume" },
    ],
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Produce item — bounded buffer decouples rates", cls: "" };
      }
      return ctx.toggles.slowConsumer
        ? { text: "Buffer backing up — producer blocks when buffer is full", cls: "warn" }
        : { text: "Steady throughput — produce and consume balanced", cls: "ok" };
    },
  },
  "readers-writers": {
    note: "Toggle writer active — readers block for exclusive access (classic RW lock).",
    actionLabel: "Acquire lock",
    toggles: [{ key: "writer", label: "Writer holds lock", kind: "warn", value: false }],
    nodes: (() => {
      const [lock, data] = layoutRow(2, { y: 260, margin: 280, w: 130, h: 56 });
      return [
        { id: "readers", x: 80, y: 200, w: 120, h: 56, title: "Readers", color: C.client },
        { id: "writers", x: 80, y: 320, w: 120, h: 56, title: "Writers", color: C.gateway },
        { ...lock, id: "lock", title: "RW Lock", color: C.accent },
        { ...data, id: "data", title: "Shared Data", color: C.ledger, kind: "db" },
      ];
    })(),
    getHops: (ctx) => {
      const actor = ctx.toggles.writer ? "writers" : "readers";
      const label = ctx.toggles.writer ? "exclusive" : "shared read";
      return [
        { from: actor, to: "lock", label: "acquire" },
        { from: "lock", to: "data", label },
      ];
    },
    status: (ctx) => {
      if (!ctx.state.lastTarget) {
        return { text: "Click Acquire lock — RW lock allows concurrent readers OR one writer", cls: "" };
      }
      return ctx.toggles.writer
        ? { text: "Writer has exclusive lock — all readers blocked", cls: "warn" }
        : { text: "Multiple readers concurrent — shared read lock", cls: "ok" };
    },
  },
};

function wrapArchitecture(id, cfg) {
  return {
    note: cfg.note,
    toggles: cfg.toggles || [],
    params: cfg.params || [],
    nodes: cfg.nodes,
    paths: {
      trace: {
        label: cfg.actionLabel || "Trace request",
        primary: true,
        getHops: cfg.getHops,
        onClick(ctx) {
          const hops = cfg.getHops(ctx);
          ctx.state.lastTarget = hops.at(-1)?.to;
        },
      },
    },
    status: cfg.status,
  };
}

export function getArchitectureConfig(topicId) {
  const cfg = ARCH[topicId];
  return cfg ? wrapArchitecture(topicId, cfg) : null;
}

export function getTopicConfig(topicId, title, lab) {
  if (lab === "architecture") return getArchitectureConfig(topicId);
  return null;
}
