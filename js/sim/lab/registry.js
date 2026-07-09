/**
 * Central topic simulation registry — dispatches to lab templates.
 */
import {
  mountLab,
  metricsLab, raceLab, queueProcessorLab, clickFlowLab,
  stateExplorerLab, algorithmLab, architectureLab,
} from "./index.js";
import { SIM_MAP } from "./simMap.js";
import { C } from "../primitives.js";
import { getTopicConfig } from "./topicConfigs.mjs";
import { layoutRow, layoutStates } from "./layout.js";
import {
  buildClickFlowConfig, buildStateConfig, buildAlgorithmConfig, buildRaceConfig,
  buildMetricsConfig, buildQueueConfig,
} from "./topicLabFactories.mjs";

const GOLD_HANDLERS = {
  "token-bucket": tokenBucketSim,
  "leaky-bucket": leakyBucketSim,
  "read-your-writes": readYourWritesSim,
  "dead-letter-queue": deadLetterQueueSim,
  "lost-update": lostUpdateSim,
  "redlock": redlockSim,
  "transactional-outbox": transactionalOutboxSim,
  "circuit-breaker": circuitBreakerSim,
  "lru-cache": lruCacheSim,
  dns: dnsSim,
};

export function createTopicSim(topicId, stage, panel, stageEl, mapEntry) {
  const entry = mapEntry || SIM_MAP[topicId] || { lab: "architecture", title: topicId };
  if (GOLD_HANDLERS[topicId]) {
    return GOLD_HANDLERS[topicId](stage, panel, stageEl);
  }
  const lab = entry.lab || "architecture";
  const title = entry.title || topicId;

  switch (lab) {
    case "metrics": {
      const mcfg = buildMetricsConfig(topicId, title);
      return metricsLab(stage, panel, stageEl, mcfg);
    }
    case "race": {
      const rcfg = buildRaceConfig(topicId, title);
      return raceLab(stage, panel, stageEl, {
        ...rcfg,
        failMessage: rcfg.failMessage || `${title} — stale write overwrote concurrent update`,
      });
    }
    case "queue": {
      const qcfg = buildQueueConfig(topicId, title);
      return queueProcessorLab(stage, panel, stageEl, qcfg);
    }
    case "clickFlow":
      return clickFlowLab(stage, panel, stageEl, buildClickFlowConfig(topicId, title));
    case "state":
      return stateExplorerLab(stage, panel, stageEl, buildStateConfig(topicId, title));
    case "algorithm":
      return algorithmLab(stage, panel, stageEl, buildAlgorithmConfig(topicId, title));
    case "architecture": {
      const custom = getTopicConfig(topicId, title, "architecture");
      return architectureLab(stage, panel, stageEl, custom || buildArchitecture(topicId, title));
    }
    case "none":
      return null;
    default:
      return metricsLab(stage, panel, stageEl, { note: title });
  }
}

function tokenBucketSim(stage, panel, stageEl) {
  return metricsLab(stage, panel, stageEl, {
    mode: "token",
    note: "Gateway token bucket: each POST /v1/charge consumes one token; empty bucket means rate-limited requests until refill.",
    capacityDefault: 35,
    refillDefault: 3,
    sendActionLabel: "Send POST /v1/charge",
    burstLabel: "Traffic spike",
    bucketLabel: "Gateway tokens",
    acceptedLabel: "ALLOWED",
    droppedLabel: "RATE-LIMITED",
    acceptedSeriesLabel: "Allowed req/s",
    droppedSeriesLabel: "Rate-limited req/s",
    chartTitle: "Gateway decision rate (req/s)",
    droppedAlertLabel: "RATE LIMITED — TOKEN BUCKET EMPTY",
    burstRate: 15,
  });
}

function leakyBucketSim(stage, panel, stageEl) {
  return metricsLab(stage, panel, stageEl, {
    mode: "leaky",
    note: "Leaky bucket: requests queue in the bucket and drain at a fixed leak rate. Overflow is dropped.",
    capacityDefault: 20,
    refillDefault: 2,
    capacityLabel: "Bucket capacity",
    refillLabel: "Leak rate",
    bucketLabel: "Queued requests",
    acceptedLabel: "PROCESSED",
    droppedLabel: "OVERFLOW",
    acceptedSeriesLabel: "Processed req/s",
    droppedSeriesLabel: "Overflow req/s",
    chartTitle: "Leak rate (req/s)",
    droppedAlertLabel: "OVERFLOW — BUCKET FULL",
    burstRate: 12,
  });
}

function readYourWritesSim(stage, panel, stageEl) {
  const [routerSlot, masterSlot, replicaSlot] = layoutRow(3, { y: 220, margin: 80, w: 130, h: 56 });
  const router = { ...routerSlot, id: "router", title: "Router", color: C.service };
  const master = { ...masterSlot, id: "master", y: 140, title: "Master DB", color: C.warn, kind: "db" };
  const replica = { ...replicaSlot, id: "replica", y: 300, title: "Replica", color: C.ok, kind: "db" };
  const phone = { id: "phone", x: 780, y: 220, w: 120, h: 72, title: "Phone UI", color: C.client };
  return clickFlowLab(stage, panel, stageEl, {
    note: "Update bio, then read before replication completes. Router sends recent writes to master.",
    initialValues: { master: "Hello", replica: "Hello", phone: "Hello", router: "REPLICA" },
    components: [router, master, replica, phone],
    toggles: [],
    init(ctx) {
      ctx.state.writeTime = 0;
      ctx.state.replicating = false;
      ctx.state.readEnabled = false;
    },
    actions: [
      {
        id: "write",
        label: "1. Update Bio",
        primary: true,
        onClick(ctx) {
          ctx.state.values.master = "I love coding";
          ctx.state.values.phone = "I love coding";
          ctx.state.values.router = "MASTER";
          ctx.state.writeTime = Date.now();
          ctx.state.replicating = true;
          ctx.state.readEnabled = true;
          setTimeout(() => {
            ctx.state.values.replica = "I love coding";
            ctx.state.replicating = false;
            setTimeout(() => { ctx.state.values.router = "REPLICA"; }, 3000);
          }, 2000);
        },
      },
      {
        id: "read",
        label: "2. Read Bio",
        disabled: (ctx) => !ctx.state.readEnabled,
        onClick(ctx) {
          const src = ctx.state.replicating ? "master" : "replica";
          ctx.state.values.phone = ctx.state.values[src];
        },
      },
    ],
    draw(ctx, d) {
      d.codePanel(router.x, 80, 150, 52, [
        "if (recentWrite)",
        `  route = ${ctx.state.values.router}`,
      ], ctx.state.values.router === "MASTER" ? 1 : -1);
      if (ctx.state.replicating) {
        d.arrow(master.x + master.w / 2, master.y + master.h, replica.x + replica.w / 2, replica.y, { color: C.accent, dashed: true, label: "replicating" });
      }
    },
    status(ctx) {
      if (ctx.state.replicating) return { text: "Replication in progress — router pins reads to master", cls: "warn" };
      return { text: "Read-your-writes: user sees their own update", cls: "ok" };
    },
  });
}

function deadLetterQueueSim(stage, panel, stageEl) {
  return queueProcessorLab(stage, panel, stageEl, buildQueueConfig("dead-letter-queue", "Dead Letter Queue"));
}

function lostUpdateSim(stage, panel, stageEl) {
  return raceLab(stage, panel, stageEl, {
    note: "Step through T1/T2 interleaving on the Ledger balance row.",
    initialBalance: 100,
    expectedBalance: 150,
    resourceLabel: "Ledger balance",
    steps: [
      { id: "t1r", worker: "T1", action: "read", value: "100" },
      { id: "t2r", worker: "T2", action: "read", value: "100" },
      { id: "t1w", worker: "T1", action: "write", value: "120" },
      { id: "t2w", worker: "T2", action: "write", value: "130", stale: true },
    ],
  });
}

const REDLOCK_NODES = 5;
const REDLOCK_QUORUM = Math.floor(REDLOCK_NODES / 2) + 1;

function redlockSim(stage, panel, stageEl) {
  const steps = [
    { id: "r1", label: "SET lock on R1", node: 0, ok: true },
    { id: "r2", label: "SET lock on R2", node: 1, ok: true },
    { id: "r3", label: "SET lock on R3", node: 2, ok: true },
    { id: "r4", label: "SET lock on R4", node: 3, ok: false },
    { id: "r5", label: "SET lock on R5", node: 4, ok: true },
    { id: "quorum", label: "Check quorum (3/5)", kind: "quorum" },
    { id: "work", label: "Critical section", kind: "work" },
    { id: "rel", label: "Unlock all nodes", kind: "release" },
  ];

  return mountLab(stage, panel, stageEl, {
    note: "Redlock: acquire SET NX on N independent Redis nodes. Quorum = N/2 + 1 required.",
    init(ctx) {
      ctx.state.stepIdx = -1;
      ctx.state.locked = Array(REDLOCK_NODES).fill(false);
      ctx.state.acquired = 0;
      ctx.state.quorumMet = false;
      ctx.state.failed = false;
      ctx.state.holding = false;
      ctx.state.done = [];
    },
    actions: steps.map((s, i) => ({
      id: s.id,
      label: s.label,
      primary: i === 0,
      onClick(ctx) {
        if (ctx.state.stepIdx >= i) return;
        ctx.state.stepIdx = i;
        ctx.state.done.push(s);

        if (s.kind === "quorum") {
          ctx.state.quorumMet = ctx.state.acquired >= REDLOCK_QUORUM;
          ctx.state.failed = !ctx.state.quorumMet;
          ctx.state.holding = ctx.state.quorumMet;
        } else if (s.kind === "work") {
          if (!ctx.state.quorumMet) return;
        } else if (s.kind === "release") {
          ctx.state.locked = Array(REDLOCK_NODES).fill(false);
          ctx.state.acquired = 0;
          ctx.state.holding = false;
        } else if (s.ok) {
          ctx.state.locked[s.node] = true;
          ctx.state.acquired += 1;
        }
      },
    })),
    frame(ctx) {
      const d = ctx.d;
      d.grid();

      const client = d.node(72, 220, 116, 52, {
        title: "Client",
        color: C.client,
        active: ctx.state.holding || ctx.state.acquired > 0,
        value: ctx.state.holding ? "holding" : ctx.state.acquired ? "acquiring" : "idle",
      });

      const nodeW = 88;
      const nodeH = 48;
      const gap = 18;
      const totalW = REDLOCK_NODES * nodeW + (REDLOCK_NODES - 1) * gap;
      const startX = 500 - totalW / 2;
      const nodeY = 200;

      d.text(500, 148, `Redis instances (quorum ${REDLOCK_QUORUM}/${REDLOCK_NODES})`, {
        size: 12,
        align: "center",
        color: C.muted,
      });

      const nodeAnchors = [];
      for (let i = 0; i < REDLOCK_NODES; i++) {
        const x = startX + i * (nodeW + gap);
        const locked = ctx.state.locked[i];
        const anchor = d.node(x, nodeY, nodeW, nodeH, {
          title: `R${i + 1}`,
          color: locked ? C.lock : C.service,
          active: locked,
          value: locked ? "locked" : "free",
        });
        nodeAnchors.push(anchor);
        if (locked) {
          d.arrow(client.right, client.cy + (i - 2) * 6, anchor.left, anchor.cy, {
            color: C.lock,
            label: "SET NX",
            head: true,
            alpha: 0.85,
          });
        }
      }

      if (ctx.state.acquired > 0 && !ctx.state.done.some((s) => s.kind === "release")) {
        const qColor = ctx.state.quorumMet ? C.ok : ctx.state.failed ? C.err : C.warn;
        d.badge(500, 100, `Acquired ${ctx.state.acquired}/${REDLOCK_NODES}`, {
          color: qColor,
          filled: ctx.state.quorumMet || ctx.state.failed,
          align: "center",
        });
        if (ctx.state.quorumMet) {
          d.badge(500, 126, `Quorum ${REDLOCK_QUORUM} met — lock valid`, { color: C.ok, align: "center" });
        } else if (ctx.state.failed) {
          d.badge(500, 126, `Quorum not met — rollback`, { color: C.err, filled: true, align: "center" });
        }
      }
    },
    status(ctx) {
      if (ctx.state.done.some((s) => s.kind === "release")) {
        return { text: "Locks released on all nodes", cls: "ok" };
      }
      if (ctx.state.holding && ctx.state.done.some((s) => s.kind === "work")) {
        return { text: "Redlock held — critical section active", cls: "ok" };
      }
      if (ctx.state.failed) {
        return { text: "Quorum failed — partial locks must be released", cls: "err" };
      }
      if (ctx.state.quorumMet) {
        return { text: `Quorum ${REDLOCK_QUORUM}/${REDLOCK_NODES} — lock acquired`, cls: "ok" };
      }
      if (ctx.state.stepIdx >= 0) {
        return { text: `Step ${ctx.state.stepIdx + 1} of ${steps.length}`, cls: "" };
      }
      return { text: "Step through Redlock acquisition on N Redis nodes", cls: "" };
    },
  });
}

function transactionalOutboxSim(stage, panel, stageEl) {
  return clickFlowLab(stage, panel, stageEl, {
    note: "Commit ledger + outbox in one txn, then relay publishes async.",
    initialValues: { ledger: "pending", outbox: "0 rows", queue: "empty" },
    components: [
      { id: "order", x: 80, y: 220, title: "Order Svc", color: C.service },
      { id: "ledger", x: 280, y: 160, title: "Ledger", color: C.ledger, kind: "db" },
      { id: "outbox", x: 280, y: 300, title: "Outbox", color: C.queue, kind: "db" },
      { id: "relay", x: 500, y: 230, title: "Relay", color: C.accent },
      { id: "queue", x: 700, y: 230, title: "Queue", color: C.queue },
    ],
    actions: [
      {
        id: "commit",
        label: "Commit txn",
        primary: true,
        flowKey: "commit",
        onClick() {},
      },
      {
        id: "relay",
        label: "Relay publish",
        flowKey: "relay",
        onClick() {},
      },
    ],
    flows: {
      commit: [
        { from: "order", to: "ledger", set: { ledger: "paid ✓" } },
        { from: "order", to: "outbox", set: { outbox: "1 event" } },
      ],
      relay: [
        { from: "outbox", to: "relay", set: { outbox: "published" } },
        { from: "relay", to: "queue", set: { queue: "event ✓" } },
      ],
    },
    status: () => ({ text: "Atomic local commit + async relay", cls: "ok" }),
  });
}

function circuitBreakerSim(stage, panel, stageEl) {
  const states = layoutStates([
    { id: "closed", label: "Closed", color: C.ok, desc: "passing" },
    { id: "open", label: "Open", color: C.err, desc: "fail fast" },
    { id: "half", label: "Half-open", color: C.warn, desc: "probing" },
  ], 176);
  const left = states[0].x;
  const right = states[states.length - 1].x + states[states.length - 1].w;
  const gaugeW = 380;
  const gaugeX = (left + right - gaugeW) / 2;
  const gaugeY = states[0].y + states[0].h + 132;

  return stateExplorerLab(stage, panel, stageEl, {
    note: "Inject failures to open the breaker. Probe to half-open, then close on success.",
    initialState: "closed",
    params: [{ key: "err", label: "Error rate %", min: 0, max: 100, step: 5, value: 10 }],
    states,
    transitions: [
      { id: "fail", label: "Failures spike", from: "closed", to: "open", primary: true },
      { id: "timeout", label: "Timeout elapsed", from: "open", to: "half" },
      { id: "probe-ok", label: "Probe succeeds", from: "half", to: "closed" },
      { id: "probe-fail", label: "Probe fails", from: "half", to: "open" },
    ],
    draw(ctx, d) {
      const err = ctx.params.err;
      d.gauge(gaugeX, gaugeY, gaugeW, 14, err / 100, {
        color: err > 50 ? C.err : C.ok,
        label: "downstream error rate",
        value: err + "%",
      });
    },
  });
}

function lruCacheSim(stage, panel, stageEl) {
  return algorithmLab(stage, panel, stageEl, {
    note: "Click keys to access. LRU evicts the least-recently-used entry when full.",
    init(ctx) {
      ctx.state.capacity = 3;
      ctx.state.order = [];
      ctx.state.map = {};
      ctx.state.lastEvict = null;
    },
    actions: ["A", "B", "C", "D", "A", "B"].map((k, i) => ({
      id: `key-${k}-${i}`,
      label: `get(${k})`,
      primary: i === 0,
      onClick(ctx) {
        const key = k;
        if (ctx.state.map[key] !== undefined) {
          ctx.state.order = ctx.state.order.filter((x) => x !== key);
          ctx.state.order.push(key);
        } else {
          if (ctx.state.order.length >= ctx.state.capacity) {
            const evict = ctx.state.order.shift();
            delete ctx.state.map[evict];
            ctx.state.lastEvict = evict;
          }
          ctx.state.map[key] = true;
          ctx.state.order.push(key);
        }
      },
    })),
    draw(ctx, d) {
      const nodeW = 96;
      const nodeH = 46;
      const gap = 44;
      const listY = 118;
      const count = ctx.state.order.length;
      const totalW = count ? nodeW * count + gap * (count - 1) : 0;
      const startX = 500 - totalW / 2;

      d.text(500, 40, "Hash map + LRU list (LRU → MRU)", { size: 12, align: "center", color: C.muted });
      ctx.state.order.forEach((key, i) => {
        const x = startX + i * (nodeW + gap);
        d.node(x, listY, nodeW, nodeH, {
          title: key,
          color: i === count - 1 ? C.accent : C.service,
          value: "cached",
        });
        if (i > 0) {
          d.arrow(x - gap, listY + nodeH / 2, x, listY + nodeH / 2, { color: C.faint, head: true });
        }
      });
      if (count > 0) {
        d.badge(startX + nodeW / 2, listY - 16, "LRU", { color: C.warn, align: "center" });
        const mruY = totalW < 200 ? listY + nodeH + 18 : listY - 16;
        d.badge(startX + totalW - nodeW / 2, mruY, "MRU", { color: C.accent, align: "center" });
      }
      if (ctx.state.lastEvict) {
        d.text(500, 196, "Last eviction", { size: 11, align: "center", color: C.muted, mono: true });
        d.badge(500, 218, `Evicted: ${ctx.state.lastEvict}`, { color: C.err, align: "center" });
      }
    },
    status(ctx) {
      return { text: `Cache: [${ctx.state.order.join(", ")}]`, cls: "ok" };
    },
  });
}

function dnsSim(stage, panel, stageEl) {
  const [client, resolver, auth] = layoutRow(3, { y: 240, margin: 50, w: 120, h: 56 });
  const regionSlots = layoutRow(2, { y: 140, margin: 520, w: 130, h: 56, totalW: 300 });
  const baseNodes = [
    { ...client, id: "client", title: "Client", color: C.client },
    { ...resolver, id: "resolver", title: "Resolver", color: C.service },
    { ...auth, id: "auth", title: "Authoritative", color: C.accent },
    { ...regionSlots[0], id: "regionA", title: "Region A", color: C.ledger, down: (ctx) => ctx.toggles.failover },
    { ...regionSlots[1], id: "regionB", y: 320, title: "Region B", color: C.ok },
  ];

  function dnsHops(ctx) {
    const { cached, failover } = ctx.toggles;
    if (cached && failover) {
      return [
        { from: "client", to: "resolver", label: "query" },
        { from: "resolver", to: "regionA", label: "stale cache", stale: true },
      ];
    }
    if (cached) {
      return [
        { from: "client", to: "resolver", label: "query" },
        { from: "resolver", to: "regionA", label: "cache hit" },
      ];
    }
    const region = failover ? "regionB" : "regionA";
    const label = failover ? "failover B" : "A record";
    return [
      { from: "client", to: "resolver", label: "query" },
      { from: "resolver", to: "auth", label: "recursive" },
      { from: "auth", to: region, label },
    ];
  }

  return architectureLab(stage, panel, stageEl, {
    note: "Click Resolve to trace DNS lookup. Toggle cache and failover.",
    toggles: [
      { key: "cached", label: "Resolver cache hit", kind: "warn", value: false },
      { key: "failover", label: "Region A down", kind: "err", value: false },
    ],
    params: [{ key: "ttl", label: "TTL (s)", min: 10, max: 300, step: 10, value: 60 }],
    nodes: baseNodes,
    paths: {
      resolve: {
        label: "Resolve hostname",
        primary: true,
        getHops: dnsHops,
        onClick(ctx) {
          ctx.state.lastTarget = dnsHops(ctx).at(-1)?.to;
        },
      },
    },
    status(ctx) {
      const target = ctx.state.lastTarget;
      if (ctx.toggles.failover && ctx.toggles.cached) {
        return { text: `Stale Region A cached for ${ctx.params.ttl}s — request hit dead region`, cls: "err" };
      }
      if (ctx.toggles.failover && target === "regionB") {
        return { text: "Failover to Region B — healthy endpoint", cls: "ok" };
      }
      if (target === "regionA") return { text: "Resolved to Region A", cls: "ok" };
      return { text: "Click Resolve to trace lookup chain", cls: "" };
    },
  });
}

function buildClickFlow(topicId, title) {
  return {
    note: `${title}: click actions to trace the flow.`,
    initialValues: {},
    components: [
      { id: "client", x: 100, y: 250, title: "Client", color: C.client },
      { id: "svc", x: 400, y: 250, title: title.slice(0, 16), color: C.service },
      { id: "db", x: 700, y: 250, title: "Store", color: C.ledger, kind: "db" },
    ],
    actions: [
      { id: "act", label: "Run operation", primary: true, flowKey: "flow", onClick() {} },
    ],
    flows: {
      flow: [
        { from: "client", to: "svc" },
        { from: "svc", to: "db", set: { db: "updated" } },
      ],
    },
    status: () => ({ text: "Operation complete", cls: "ok" }),
  };
}

function buildStateExplorer(topicId, title) {
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

function buildAlgorithm(topicId, title) {
  return {
    note: `${title}: click to manipulate the data structure.`,
    init(ctx) { ctx.state.items = []; },
    actions: [
      { id: "add", label: "Add item", primary: true, onClick(ctx) { ctx.state.items.push(ctx.state.items.length + 1); } },
      { id: "remove", label: "Remove", onClick(ctx) { ctx.state.items.pop(); } },
    ],
    draw(ctx, d) {
      ctx.state.items.forEach((item, i) => {
        d.node(150 + i * 100, 200, 80, 44, { title: String(item), color: C.accent });
      });
    },
    status: (ctx) => ({ text: `Items: ${ctx.state.items.length}`, cls: "ok" }),
  };
}

function buildArchitecture(topicId, title) {
  return {
    note: `${title}: click a path to trace requests.`,
    nodes: [
      { id: "client", x: 100, y: 250, title: "Client", color: C.client },
      { id: "edge", x: 350, y: 250, title: title.slice(0, 14), color: C.accent },
      { id: "backend", x: 600, y: 200, title: "Service", color: C.service },
      { id: "db", x: 600, y: 320, title: "Database", color: C.ledger, kind: "db" },
    ],
    paths: {
      request: {
        label: "Trace request",
        primary: true,
        hops: [
          { from: "client", to: "edge", label: "HTTPS" },
          { from: "edge", to: "backend", label: "route" },
          { from: "backend", to: "db", label: "query" },
        ],
      },
    },
  };
}
