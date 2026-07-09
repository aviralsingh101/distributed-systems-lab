/**
 * Metrics lab — domain-correct models per topic (token, leaky, queue, pool, fanout, latency, etc.)
 */
import { mountLab } from "../mountLab.js";
import { C, clamp } from "../../primitives.js";
import { METRICS_LAYOUT } from "../layout.js";
import { getMetricsMode } from "../metricsModes.mjs";

const SHUFFLE_SERVERS = 6;
const SHUFFLE_TENANTS = 5;

function shuffleRand(i, k) {
  const s = Math.sin(i * 37.3 + k * 91.7) * 4139.1;
  return s - Math.floor(s);
}

function tenantShards(tenant, shuffle) {
  if (!shuffle) return [0, 1];
  const a = Math.floor(shuffleRand(tenant, 1) * SHUFFLE_SERVERS);
  let b = Math.floor(shuffleRand(tenant, 2) * SHUFFLE_SERVERS);
  if (b === a) b = (b + 1) % SHUFFLE_SERVERS;
  return [a, b];
}

function shuffleBlastRadius(shuffle) {
  const badShards = new Set(tenantShards(0, shuffle));
  let affected = 0;
  for (let t = 1; t < SHUFFLE_TENANTS; t++) {
    if (tenantShards(t, shuffle).every((s) => badShards.has(s))) affected++;
  }
  return { badShards, affected };
}

export function metricsLab(stage, panel, stageEl, cfg) {
  const mode = cfg.mode || "token";
  const drawMode = cfg.drawMode || mode;
  const timelineVariant = cfg.timelineVariant || "generic";
  const L = METRICS_LAYOUT;
  const capacityKey = cfg.capacityKey || "cap";
  const refillKey = cfg.refillKey || "rate";
  const capacityDefault = cfg.capacityDefault ?? 35;
  const refillDefault = cfg.refillDefault ?? 3;
  const burstRate = cfg.burstRate ?? 15;
  const windowSec = cfg.windowSec ?? 30;
  const amplificationKind = cfg.amplificationKind;
  const capacityUnit = cfg.capacityUnit ?? (mode === "latency" ? "ms" : "");
  const refillUnit = cfg.refillUnit ?? (mode === "latency" ? " ms/s" : "/s");

  const labels = {
    capacityLabel: cfg.capacityLabel || "Capacity",
    refillLabel: cfg.refillLabel || "Rate",
    sendActionLabel: cfg.sendActionLabel || "Send Request",
    bucketLabel: cfg.bucketLabel || "Tokens",
    acceptedLabel: cfg.acceptedLabel || "ACCEPTED",
    droppedLabel: cfg.droppedLabel || "DROPPED",
    acceptedSeriesLabel: cfg.acceptedSeriesLabel || "Accepted req/s",
    droppedSeriesLabel: cfg.droppedSeriesLabel || "Dropped req/s",
    chartTitle: cfg.chartTitle || "Request rate (req/s)",
    droppedAlertLabel: cfg.droppedAlertLabel || "REQUEST DROPPED",
    fanoutHint: cfg.fanoutHint || "Many clients → shared resource",
    fanoutNodePrefix: cfg.fanoutNodePrefix || "C",
    queueStatusNote: cfg.queueStatusNote,
  };

  return mountLab(stage, panel, stageEl, {
    note: cfg.note || "Send requests or enable burst traffic.",
    init(ctx) {
      const cap = capacityDefault;
      ctx.state.tokens = cap;
      ctx.state.queueLevel = 0;
      ctx.state.poolInUse = 0;
      ctx.state.poolReleaseAcc = 0;
      ctx.state.accepted = 0;
      ctx.state.dropped = 0;
      ctx.state.seriesAccepted = [];
      ctx.state.seriesDropped = [];
      ctx.state.lastSample = 0;
      ctx.state.burstAcc = 0;
      ctx.state.leakAcc = 0;
      ctx.state.alert = "";
      ctx.state.alertCls = "";
      ctx.state.pendingA = 0;
      ctx.state.pendingD = 0;
      ctx.state.droppedAlertLabel = labels.droppedAlertLabel;
      ctx.state.latencyP99 = 12;
      ctx.state.backoffStep = 0;
      ctx.state.amplification = amplificationKind === "n-plus-one" ? 1 + cap : 1;
      ctx.state.amplificationKind = amplificationKind;
      ctx.state.metricsDrawMode = drawMode;
      ctx.state.hedgeFanout = 1;
      if (mode === "timeline") initTimelineState(ctx, timelineVariant);
      if (cfg.init) cfg.init(ctx);
    },
    params: [
      { key: capacityKey, label: labels.capacityLabel, min: cfg.capacityMin ?? (mode === "latency" ? 50 : 5), max: cfg.capacityMax ?? (mode === "latency" ? 300 : 100), step: mode === "latency" ? 5 : 1, value: capacityDefault, live: true, unit: capacityUnit,
        onChange(ctx, v) {
          if (mode === "latency") return;
          ctx.state.tokens = Math.min(ctx.state.tokens, v);
          ctx.state.queueLevel = Math.min(ctx.state.queueLevel, v);
          if (amplificationKind === "n-plus-one") ctx.state.amplification = 1 + v;
        } },
      { key: refillKey, label: labels.refillLabel, min: cfg.refillMin ?? 1, max: cfg.refillMax ?? 20, step: mode === "latency" ? 5 : 1, value: refillDefault, unit: refillUnit },
    ],
    toggles: cfg.toggles || [{ key: "burst", label: cfg.burstLabel || "Burst traffic", kind: "warn", value: false }],
    actions: [{
      id: "send",
      label: labels.sendActionLabel,
      primary: true,
      onClick(ctx) { handleSend(ctx, mode, capacityKey, timelineVariant); },
    }],
    frame(ctx, t, dt) {
      if (dt > 0) tickPhysics(ctx, mode, capacityKey, refillKey, burstRate, dt, t, windowSec, timelineVariant);
      drawFrame(ctx, mode, L, labels, capacityKey, refillKey, windowSec, drawMode, timelineVariant);
    },
    status(ctx) {
      return statusFor(ctx, mode, labels, drawMode);
    },
    onReset: cfg.onReset,
  });
}

function initTimelineState(ctx, variant) {
  ctx.state.timelineVariant = variant;
  ctx.state.heapPressure = 0;
  ctx.state.inStw = false;
  ctx.state.stwRemaining = 0;
  ctx.state.timelineSegments = [];
  ctx.state.timelineEvents = [];
  ctx.state.timelineOrigin = ctx.t || 0;
}

function handleSend(ctx, mode, capKey, timelineVariant = "generic") {
  const cap = ctx.params[capKey];
  switch (mode) {
    case "leaky":
      if (ctx.state.queueLevel < cap) {
        ctx.state.queueLevel += 1;
      } else {
        ctx.state.dropped++;
        ctx.state.pendingD++;
        flashDrop(ctx);
      }
      break;
    case "pool":
      if (ctx.state.poolInUse < cap) {
        ctx.state.poolInUse++;
        ctx.state.accepted++;
        ctx.state.pendingA++;
      } else {
        ctx.state.dropped++;
        ctx.state.pendingD++;
        flashDrop(ctx);
      }
      break;
    case "queue":
      ctx.state.queueLevel = Math.min(cap * 1.5, ctx.state.queueLevel + 1);
      if (ctx.state.queueLevel >= cap) {
        ctx.state.dropped++;
        ctx.state.pendingD++;
        flashDrop(ctx);
      } else {
        ctx.state.accepted++;
        ctx.state.pendingA++;
      }
      break;
    case "latency":
      ctx.state.accepted++;
      ctx.state.pendingA++;
      ctx.state.latencyP99 = ctx.toggles.burst ? 180 + Math.random() * 120 : 15 + Math.random() * 30;
      if (ctx.state.metricsDrawMode === "hedged") {
        const hedgeThreshold = cap;
        if (ctx.state.latencyP99 > hedgeThreshold || ctx.toggles.burst) {
          ctx.state.dropped++;
          ctx.state.pendingD++;
          ctx.state.hedgeFanout = 2 + Math.floor(Math.random() * 2);
          flashDrop(ctx);
        } else {
          ctx.state.hedgeFanout = 1;
        }
      } else if (ctx.state.latencyP99 > cap) {
        ctx.state.dropped++;
        ctx.state.pendingD++;
        flashDrop(ctx);
      }
      break;
    case "backoff": {
      const maxStep = ctx.params[capKey];
      ctx.state.backoffStep = Math.min(maxStep, ctx.state.backoffStep + 1);
      ctx.state.accepted++;
      ctx.state.pendingA++;
      break;
    }
    case "amplification":
      if (ctx.state.amplificationKind === "n-plus-one") {
        const n = Math.round(cap);
        const queries = 1 + n;
        ctx.state.amplification = queries;
        ctx.state.accepted += queries;
        ctx.state.pendingA += queries;
        if (queries > 15) {
          ctx.state.dropped++;
          ctx.state.pendingD++;
          flashDrop(ctx);
        }
      } else {
        ctx.state.amplification = Math.min(12, ctx.state.amplification + (ctx.toggles.burst ? 3 : 1));
        ctx.state.accepted++;
        ctx.state.pendingA++;
      }
      break;
    case "timeline":
      if (timelineVariant === "gc") {
        handleGcAllocation(ctx, cap);
      } else {
        ctx.state.accepted++;
        ctx.state.pendingA++;
        ctx.state.timelineEvents = ctx.state.timelineEvents || [];
        ctx.state.timelineEvents.push({ t: Date.now(), label: ctx.toggles.burst ? "GC pause" : "event" });
        if (ctx.state.timelineEvents.length > 8) ctx.state.timelineEvents.shift();
      }
      break;
    case "fanout":
      processTokenRequest(ctx, capKey);
      break;
    default:
      processTokenRequest(ctx, capKey);
  }
}

function processTokenRequest(ctx, capKey) {
  if (ctx.state.tokens >= 1) {
    ctx.state.tokens -= 1;
    ctx.state.accepted++;
    ctx.state.pendingA++;
  } else {
    ctx.state.dropped++;
    ctx.state.pendingD++;
    flashDrop(ctx);
  }
}

function flashDrop(ctx, msg) {
  ctx.state.alert = msg || ctx.state.droppedAlertLabel || "REQUEST DROPPED";
  ctx.state.alertCls = "err";
  setTimeout(() => { ctx.state.alert = ""; }, 1500);
}

function handleGcAllocation(ctx, cap) {
  const alloc = ctx.toggles.burst ? 10 : 6;
  if (ctx.state.inStw) {
    ctx.state.dropped++;
    ctx.state.pendingD++;
    return;
  }
  ctx.state.heapPressure = Math.min(cap, (ctx.state.heapPressure || 0) + alloc);
  if (ctx.state.heapPressure >= cap) {
    startGcPause(ctx, cap);
    ctx.state.dropped++;
    ctx.state.pendingD++;
    flashDrop(ctx, "STOP-THE-WORLD GC");
    return;
  }
  ctx.state.accepted++;
  ctx.state.pendingA++;
}

function startGcPause(ctx, cap) {
  const rate = Math.max(ctx.params.rate ?? 1, 0.5);
  const duration = clamp(2.4 / rate, 0.35, 2.5);
  closeTimelineSegment(ctx, "run");
  ctx.state.inStw = true;
  ctx.state.stwRemaining = duration;
  ctx.state.heapPressure = Math.max(0, ctx.state.heapPressure - cap * 0.55);
  ctx.state.timelineSegments.push({ tStart: ctx.t, tEnd: ctx.t + duration, type: "stw" });
}

function closeTimelineSegment(ctx, type) {
  const segs = ctx.state.timelineSegments || [];
  const last = segs[segs.length - 1];
  if (last && last.type === type && last.tEnd == null) {
    last.tEnd = ctx.t;
  }
}

function appendRunSegment(ctx) {
  const segs = ctx.state.timelineSegments || [];
  const last = segs[segs.length - 1];
  if (!last || last.tEnd != null) {
    segs.push({ tStart: ctx.t, tEnd: null, type: "run" });
  }
}

function tickPhysics(ctx, mode, capKey, refillKey, burstRate, dt, t, windowSec, timelineVariant = "generic") {
  const cap = ctx.params[capKey];
  const rate = ctx.params[refillKey];

  if (mode === "token" || mode === "fanout") {
    ctx.state.tokens = clamp(ctx.state.tokens + dt * rate, 0, cap);
  }
  if (mode === "leaky") {
    ctx.state.leakAcc += dt * rate;
    while (ctx.state.leakAcc >= 1 && ctx.state.queueLevel > 0) {
      ctx.state.leakAcc -= 1;
      ctx.state.queueLevel -= 1;
      ctx.state.accepted++;
      ctx.state.pendingA++;
    }
  }
  if (mode === "queue") {
    ctx.state.leakAcc += dt * rate;
    while (ctx.state.leakAcc >= 1 && ctx.state.queueLevel > 0) {
      ctx.state.leakAcc -= 1;
      ctx.state.queueLevel = Math.max(0, ctx.state.queueLevel - 1);
    }
  }
  if (mode === "pool") {
    ctx.state.poolReleaseAcc += dt * rate;
    while (ctx.state.poolReleaseAcc >= 1 && ctx.state.poolInUse > 0) {
      ctx.state.poolReleaseAcc -= 1;
      ctx.state.poolInUse -= 1;
    }
  }
  if (mode === "latency" && !ctx.toggles.burst) {
    ctx.state.latencyP99 = Math.max(12, ctx.state.latencyP99 - dt * rate);
  }
  if (mode === "backoff" && !ctx.toggles.burst) {
    ctx.state.backoffStep = Math.max(0, ctx.state.backoffStep - dt * rate);
  }
  if (mode === "amplification" && !ctx.toggles.burst && ctx.state.amplificationKind !== "n-plus-one") {
    ctx.state.amplification = Math.max(1, ctx.state.amplification - dt * 0.8);
  }
  if (mode === "timeline" && timelineVariant === "gc") {
    if (ctx.state.inStw) {
      ctx.state.stwRemaining = Math.max(0, (ctx.state.stwRemaining || 0) - dt);
      const segs = ctx.state.timelineSegments || [];
      const active = segs[segs.length - 1];
      if (active?.type === "stw") active.tEnd = ctx.t + ctx.state.stwRemaining;
      if (ctx.state.stwRemaining <= 0) {
        ctx.state.inStw = false;
        if (active?.type === "stw") active.tEnd = ctx.t;
        appendRunSegment(ctx);
      }
    } else {
      appendRunSegment(ctx);
      const segs = ctx.state.timelineSegments || [];
      const active = segs[segs.length - 1];
      if (active?.type === "run") active.tEnd = ctx.t;
    }
    const window = 12;
    ctx.state.timelineSegments = (ctx.state.timelineSegments || []).filter((s) => (s.tEnd ?? t) > t - window);
  }

  if (ctx.toggles.burst) {
    ctx.state.burstAcc += dt * burstRate;
    while (ctx.state.burstAcc >= 1) {
      ctx.state.burstAcc -= 1;
      handleSend(ctx, mode, capKey, timelineVariant);
    }
  }

  if (t - ctx.state.lastSample >= 0.5) {
    ctx.state.lastSample = t;
    const trim = (arr) => arr.filter((p) => p.t > t - windowSec);
    ctx.state.seriesAccepted = trim(ctx.state.seriesAccepted);
    ctx.state.seriesDropped = trim(ctx.state.seriesDropped);
    ctx.state.seriesAccepted.push({ t, v: ctx.state.pendingA });
    ctx.state.seriesDropped.push({ t, v: ctx.state.pendingD });
    ctx.state.pendingA = 0;
    ctx.state.pendingD = 0;
  }
}

function drawFrame(ctx, mode, L, labels, capKey, refillKey, windowSec, drawMode, timelineVariant = "generic") {
  const d = ctx.d;
  const cap = ctx.params[capKey];
  const rate = ctx.params[refillKey];
  const visual = drawMode || mode;
  d.grid();

  switch (visual) {
    case "admission": {
      d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y - 10, "Gateway admission gate", { size: 11, align: "center", color: C.muted, weight: 600 });
      d.tokenBucket(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.tokens, cap, { label: labels.bucketLabel, refillRate: rate });
      const flowY = L.bucket.y + L.bucket.h + 52;
      const clientX = 36;
      const gwX = L.bucket.x + L.bucket.w / 2 - 45;
      const svcX = L.bucket.x + L.bucket.w + 8;
      d.node(clientX, flowY, 58, 34, { title: "Client", color: C.client });
      d.node(gwX, flowY, 90, 34, { title: "Gateway", color: C.gateway, active: true });
      d.node(svcX, flowY, 78, 34, { title: "Service", color: C.service });
      const admit = ctx.state.tokens < cap || ctx.state.accepted > 0;
      d.arrow(clientX + 58, flowY + 17, gwX, flowY + 17, { color: C.client, label: "request", head: true });
      if (admit) {
        d.arrow(gwX + 90, flowY + 17, svcX, flowY + 17, { color: C.ok, label: "ADMITTED", head: true });
      } else {
        d.arrow(gwX + 45, flowY + 34, gwX + 45, flowY + 58, { color: C.err, label: "REJECTED", head: true });
        d.badge(gwX + 45, flowY + 72, "503 at gate", { color: C.err, align: "center" });
      }
      break;
    }
    case "leaky":
      d.leakyBucket(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.queueLevel, cap, { label: labels.bucketLabel, leakRate: rate });
      break;
    case "pool":
      d.poolGrid(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.poolInUse, cap, { label: labels.bucketLabel });
      break;
    case "queue":
      d.queueMeter(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.queueLevel, cap, { label: labels.bucketLabel });
      d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + L.bucket.h + 24,
        labels.queueStatusNote
          ? `${ctx.state.queueLevel.toFixed(0)} in-flight / ${cap} limit`
          : `L ≈ ${(ctx.state.queueLevel / Math.max(rate, 0.1)).toFixed(1)} (depth / rate)`,
        { size: 11, align: "center", color: C.muted });
      break;
    case "latency": {
      const slo = cap;
      const p99 = ctx.state.latencyP99;
      const breach = p99 > slo;
      const gaugeMax = slo * 2;
      d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y - 8, labels.bucketLabel, { size: 11, align: "center", color: C.muted, weight: 600 });
      d.node(L.bucket.x, L.bucket.y + 10, L.bucket.w, 60, {
        title: "p99",
        value: `${Math.round(p99)} ms`,
        color: breach ? C.err : C.ok,
      });
      d.gauge(L.bucket.x, L.bucket.y + 82, L.bucket.w, 14, clamp(p99 / gaugeMax), {
        color: breach ? C.err : C.accent,
        label: `SLO ${slo}ms`,
        value: `${Math.round(p99)}ms`,
      });
      d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + L.bucket.h - 6,
        breach ? "tail above SLO" : "within SLO target",
        { size: 10, align: "center", color: breach ? C.err : C.muted });
      break;
    }
    case "hedged": {
      const hedgeThreshold = cap;
      const hedging = ctx.state.latencyP99 > hedgeThreshold || ctx.toggles.burst;
      d.node(L.bucket.x, L.bucket.y, L.bucket.w, 64, {
        title: "p99 latency",
        value: `${Math.round(ctx.state.latencyP99)} ms`,
        color: hedging ? C.err : C.ok,
      });
      d.gauge(L.bucket.x, L.bucket.y + 74, L.bucket.w, 12, clamp(ctx.state.latencyP99 / 300), {
        color: hedging ? C.err : C.accent,
        label: `hedge at ${hedgeThreshold}ms`,
        value: `${Math.round(ctx.state.latencyP99)}ms`,
      });
      const flowY = L.bucket.y + 104;
      const clientX = 36;
      d.node(clientX, flowY, 56, 32, { title: "Client", color: C.client });
      const replicas = hedging ? (ctx.state.hedgeFanout || 2) : 1;
      for (let i = 0; i < replicas; i++) {
        const rx = L.bucket.x + 16 + i * 68;
        const isHedge = i > 0;
        d.node(rx, flowY + 44, 56, 30, {
          title: isHedge ? `R${i + 1} hedge` : "R1 primary",
          color: isHedge ? C.warn : C.ok,
        });
        d.arrow(clientX + 28, flowY + 30, rx + 28, flowY + 44, {
          color: isHedge ? C.warn : C.accent,
          label: isHedge ? "hedge" : "primary",
          dashed: isHedge,
          head: true,
        });
      }
      if (hedging) {
        d.text(L.bucket.x + L.bucket.w / 2, flowY + 88, labels.fanoutHint, { size: 11, align: "center", color: C.muted });
      }
      break;
    }
    case "backoff": {
      const step = Math.min(cap, Math.floor(ctx.state.backoffStep));
      const waitMs = 2 ** step;
      const maxWait = 2 ** cap;
      d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + 16, labels.bucketLabel, { align: "center", size: 12, color: C.muted });
      d.gauge(L.bucket.x, L.bucket.y + 36, L.bucket.w, 14, cap > 0 ? step / cap : 0, {
        color: C.warn,
        label: `Retry ${step}`,
        value: `wait ${waitMs}ms`,
      });
      const barW = 24;
      const gap = 6;
      const steps = cap;
      const totalW = steps * barW + (steps - 1) * gap;
      const startX = L.bucket.x + (L.bucket.w - totalW) / 2;
      const baseY = L.bucket.y + L.bucket.h - 16;
      for (let i = 0; i <= steps; i++) {
        const x = startX + i * (barW + gap);
        const wait = 2 ** i;
        const active = i <= step;
        d.vbar(x, baseY, barW, 72, wait, maxWait, {
          color: active ? C.warn : C.faint,
          label: i === 0 ? "init" : `R${i}`,
          value: active ? `${wait}ms` : "",
        });
      }
      break;
    }
    case "amplification": {
      const amp = ctx.state.amplification;
      const ampDisplay = Number.isInteger(amp) ? amp : amp.toFixed(1);
      d.node(L.bucket.x, L.bucket.y, L.bucket.w, 56, {
        title: "Queries per request",
        value: `×${ampDisplay}`,
        color: amp > 10 ? C.err : amp > 5 ? C.warn : C.accent,
      });
      if (ctx.state.amplificationKind === "n-plus-one") {
        const n = Math.min(Math.round(cap), 6);
        const flowY = L.bucket.y + 72;
        d.node(L.bucket.x + 8, flowY, 48, 28, { title: "App", color: C.client });
        d.node(L.bucket.x + 88, flowY, 52, 28, { title: "ORM", color: C.service });
        d.node(L.bucket.x + 168, flowY, 44, 28, { title: "DB", color: C.ledger, kind: "db" });
        d.arrow(L.bucket.x + 56, flowY + 14, L.bucket.x + 88, flowY + 14, { color: C.accent, label: "1 list", head: true });
        for (let i = 0; i < n; i++) {
          d.arrow(L.bucket.x + 114, flowY + 28, L.bucket.x + 168, flowY + 14 + i * 8, {
            color: i === 0 ? C.accent : C.faint,
            alpha: 0.5 + (i === 0 ? 0.3 : 0),
            head: i < 2,
          });
        }
        if (n > 2) {
          d.text(L.bucket.x + 190, flowY + 32, `+${n - 2} more`, { size: 9, color: C.muted });
        }
        d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + L.bucket.h - 4, `1 + ${Math.round(cap)} row lookups`, { size: 10, align: "center", color: C.muted });
      }
      break;
    }
    case "timeline":
      if (timelineVariant === "gc") {
        drawGcTimeline(d, L, ctx, labels, cap);
      } else {
        (ctx.state.timelineEvents || []).forEach((ev, i) => {
          d.badge(L.bucket.x + 40 + i * 90, L.bucket.y + 60 + (i % 2) * 40, ev.label, { color: ev.label.includes("GC") ? C.err : C.accent, align: "center" });
        });
        d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + 20, labels.bucketLabel, { align: "center", size: 12, color: C.muted });
      }
      break;
    case "shuffle-shard": {
      const shuffle = ctx.toggles.shuffle;
      const noisy = ctx.toggles.burst;
      const { badShards, affected } = shuffleBlastRadius(shuffle);
      const overloaded = noisy || ctx.state.tokens < 1;
      d.tokenBucket(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.tokens, cap, { label: labels.bucketLabel, refillRate: rate });
      d.text(L.chart.x, L.bucket.y + 12, labels.fanoutHint, { size: 11, color: C.muted });
      const serverY = L.bucket.y + L.bucket.h + 36;
      const serverGap = 62;
      const serverStartX = 52;
      const serverCenters = [];
      for (let s = 0; s < SHUFFLE_SERVERS; s++) {
        const x = serverStartX + s * serverGap;
        serverCenters[s] = x + 26;
        const bad = badShards.has(s);
        d.node(x, serverY, 52, 36, {
          title: `s${s}`,
          color: bad && overloaded ? C.err : bad ? C.warn : C.ledger,
          value: bad && overloaded ? "hot" : "",
          active: bad && noisy,
        });
      }
      const tenantY = serverY + 72;
      for (let ti = 0; ti < SHUFFLE_TENANTS; ti++) {
        const x = 90 + ti * 88;
        const shard = tenantShards(ti, shuffle);
        const hit = ti === 0 || shard.every((s) => badShards.has(s));
        const tenantBad = noisy && (ti === 0 || (shuffle && hit));
        d.node(x, tenantY, 64, 34, {
          title: `T${ti + 1}`,
          color: ti === 0 ? C.err : tenantBad ? C.warn : C.service,
          value: ti === 0 ? "noisy" : "",
        });
        shard.forEach((s) => {
          d.arrow(x + 32, tenantY, serverCenters[s], serverY + 36, {
            color: ti === 0 ? C.err : tenantBad ? C.warn : C.faint,
            alpha: ti === 0 ? 0.65 : 0.28,
            head: false,
            width: 1,
          });
        });
      }
      const blastText = shuffle
        ? `blast radius: T1 + ${affected} other tenant(s)`
        : `shared shard: all ${SHUFFLE_TENANTS} tenants affected`;
      d.badge(L.chart.x + L.chart.w / 2, tenantY + 68, blastText, {
        color: shuffle ? C.ok : C.err,
        align: "center",
      });
      break;
    }
    case "hot-shard": {
      d.tokenBucket(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.tokens, cap, { label: labels.bucketLabel, refillRate: rate });
      d.text(L.chart.x, L.bucket.y + 12, labels.fanoutHint, { size: 11, color: C.muted });
      const shardY = L.bucket.y + L.bucket.h + 44;
      const hotX = 280;
      const shards = [
        { x: hotX - 120, title: "S1", hot: false },
        { x: hotX, title: "S2", hot: true },
        { x: hotX + 120, title: "S3", hot: false },
      ];
      shards.forEach((s) => {
        d.node(s.x, shardY, 72, 40, {
          title: s.title,
          color: s.hot ? C.err : C.faint,
          value: s.hot ? "HOT" : "idle",
          active: s.hot,
        });
      });
      d.badge(hotX + 36, shardY - 14, "key:merchant:42", { color: C.err, align: "center" });
      for (let i = 0; i < 5; i++) {
        const rx = 60 + i * 70;
        const ry = shardY + 58;
        d.node(rx, ry, 50, 32, { title: `${labels.fanoutNodePrefix}${i + 1}`, color: C.client });
        d.arrow(rx + 25, ry, hotX + 36, shardY + 40, { color: i === 0 ? C.err : C.faint, alpha: 0.45 + (i === 0 ? 0.35 : 0), head: true });
      }
      break;
    }
    case "fanout": {
      d.tokenBucket(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.tokens, cap, { label: labels.bucketLabel, refillRate: rate });
      d.text(L.chart.x, L.bucket.y + 20, labels.fanoutHint, { size: 11, color: C.muted });
      for (let i = 0; i < 5; i++) {
        d.node(60 + i * 70, L.bucket.y + L.bucket.h + 30, 50, 32, { title: `${labels.fanoutNodePrefix}${i + 1}`, color: C.client });
        d.arrow(85 + i * 70, L.bucket.y + L.bucket.h + 28, L.bucket.x + 20, L.bucket.y + L.bucket.h, { color: C.faint, alpha: 0.5, head: true });
      }
      break;
    }
    default:
      d.tokenBucket(L.bucket.x, L.bucket.y, L.bucket.w, L.bucket.h, ctx.state.tokens, cap, { label: labels.bucketLabel, refillRate: rate });
  }

  d.timeSeriesChart(L.chart.x, L.chart.y, L.chart.w, L.chart.h, [
    { label: labels.acceptedSeriesLabel, color: C.accent, points: ctx.state.seriesAccepted },
    { label: labels.droppedSeriesLabel, color: C.err, points: ctx.state.seriesDropped },
  ], { windowSec, title: labels.chartTitle });
  d.counterTile(L.accepted.x, L.accepted.y, L.accepted.w, L.accepted.h, labels.acceptedLabel, ctx.state.accepted, C.accent);
  d.counterTile(L.dropped.x, L.dropped.y, L.dropped.w, L.dropped.h, labels.droppedLabel, ctx.state.dropped, C.err);

  if (ctx.state.alert) {
    d.badge(L.chart.x + L.chart.w / 2, L.chart.y - 12, ctx.state.alert, { color: C.err, filled: true, align: "center" });
  }
}

function drawGcTimeline(d, L, ctx, labels, cap) {
  const trackX = L.bucket.x + 8;
  const trackW = L.bucket.w - 16;
  const trackY = L.bucket.y + 52;
  const trackH = 28;
  const window = 12;
  const now = ctx.t;
  const t0 = now - window;

  d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + 14, labels.bucketLabel, { align: "center", size: 12, color: C.muted, weight: 600 });
  d.text(L.bucket.x + L.bucket.w / 2, L.bucket.y + 30, "green = serving, red = stop-the-world", { align: "center", size: 10, color: C.faint });

  const c = d.ctx;
  c.save();
  d._rr(trackX, trackY, trackW, trackH, 6);
  c.fillStyle = "#0f1524";
  c.fill();
  c.strokeStyle = C.panelLine;
  c.lineWidth = 1;
  c.stroke();
  c.restore();

  const segs = ctx.state.timelineSegments || [];
  segs.forEach((seg) => {
    const end = seg.tEnd ?? now;
    const x1 = trackX + ((seg.tStart - t0) / window) * trackW;
    const x2 = trackX + ((end - t0) / window) * trackW;
    const w = Math.max(2, x2 - x1);
    if (x2 < trackX || x1 > trackX + trackW) return;
    const sx = Math.max(trackX, x1);
    const sw = Math.min(trackX + trackW, x1 + w) - sx;
    if (sw <= 0) return;
    const color = seg.type === "stw" ? C.err : C.ok;
    c.save();
    d._rr(sx, trackY + 2, sw, trackH - 4, 4);
    c.fillStyle = color;
    c.globalAlpha = seg.type === "stw" ? 0.92 : 0.55;
    c.fill();
    c.restore();
    if (seg.type === "stw" && sw > 34) {
      d.text(sx + sw / 2, trackY + trackH / 2 + 4, "STW", { size: 10, align: "center", weight: 700, color: "#0b0f1a" });
    }
  });

  if (ctx.state.inStw) {
    d.badge(trackX + trackW / 2, trackY - 10, "GC running — threads frozen", { color: C.err, align: "center", filled: true });
  }

  d.gauge(trackX, trackY + trackH + 18, trackW, 12, cap > 0 ? (ctx.state.heapPressure || 0) / cap : 0, {
    color: (ctx.state.heapPressure || 0) >= cap * 0.85 ? C.err : C.accent,
    label: "Heap pressure",
    value: `${Math.round(ctx.state.heapPressure || 0)}%`,
  });
  d.text(trackX, trackY + trackH + 44, "time →", { size: 10, color: C.faint });
}

function statusFor(ctx, mode, labels, drawMode) {
  if (ctx.toggles.burst && drawMode !== "hedged" && drawMode !== "shuffle-shard") {
    if (drawMode === "admission") return { text: "Burst ON — admission gate under overload", cls: "warn" };
    if (mode === "leaky") return { text: `Burst ON — queue filling (${ctx.state.queueLevel.toFixed(0)}/${ctx.params.cap})`, cls: "warn" };
    if (mode === "pool") return { text: `Burst ON — pool pressure ${ctx.state.poolInUse}/${ctx.params.cap}`, cls: ctx.state.poolInUse >= ctx.params.cap ? "err" : "warn" };
    return { text: "Burst ON — sustained load", cls: "warn" };
  }
  if (ctx.state.dropped > 0) {
    const suffix = drawMode === "admission" ? " at gateway" : "";
    const overflow = mode === "leaky" ? " — queue overflow" : "";
    return { text: `${ctx.state.dropped} ${labels.droppedLabel.toLowerCase()}${suffix}${overflow}`, cls: "err" };
  }
  if (drawMode === "hedged") {
    const hedgeThreshold = ctx.params.cap;
    if (ctx.toggles.burst) return { text: "Burst ON — tail latency triggers hedged fan-out", cls: "warn" };
    return { text: `p99: ${Math.round(ctx.state.latencyP99)}ms — primary only (below ${hedgeThreshold}ms)`, cls: "ok" };
  }
  if (drawMode === "admission") {
    if (ctx.toggles.burst) return { text: "Burst ON — admission gate under overload", cls: "warn" };
    return { text: `${ctx.state.tokens.toFixed(1)} admission slots free — gate open`, cls: "ok" };
  }
  if (drawMode === "hot-shard") {
    if (ctx.toggles.burst) {
      return {
        text: `${ctx.state.tokens.toFixed(1)} ${labels.bucketLabel.toLowerCase()} on hot shard S2 — stampede`,
        cls: ctx.state.tokens < 1 ? "err" : "warn",
      };
    }
    return {
      text: `${ctx.state.tokens.toFixed(1)} ${labels.bucketLabel.toLowerCase()} on hot shard S2`,
      cls: ctx.state.tokens < 1 ? "err" : "ok",
    };
  }
  if (drawMode === "shuffle-shard") {
    const shuffle = ctx.toggles.shuffle;
    const { affected } = shuffleBlastRadius(shuffle);
    if (!shuffle) {
      return {
        text: ctx.toggles.burst
          ? `Shared shard — all ${SHUFFLE_TENANTS} tenants degraded`
          : `Shared shard — enable shuffle sharding to isolate blast radius`,
        cls: ctx.toggles.burst ? "err" : "warn",
      };
    }
    return {
      text: ctx.toggles.burst
        ? `Shuffle on — blast radius: T1 + ${affected} other tenant(s)`
        : `Shuffle on — overlapping subsets limit blast radius`,
      cls: ctx.toggles.burst && affected > 0 ? "warn" : "ok",
    };
  }
  if (ctx.toggles.burst) {
    if (mode === "leaky") return { text: `Burst ON — queue filling (${ctx.state.queueLevel.toFixed(0)}/${ctx.params.cap})`, cls: "warn" };
    if (mode === "pool") return { text: `Burst ON — pool pressure ${ctx.state.poolInUse}/${ctx.params.cap}`, cls: ctx.state.poolInUse >= ctx.params.cap ? "err" : "warn" };
    return { text: "Burst ON — sustained load", cls: "warn" };
  }
  switch (mode) {
    case "leaky": return { text: `Queue: ${ctx.state.queueLevel.toFixed(1)} — leaking at fixed rate`, cls: "ok" };
    case "pool": return { text: `Pool: ${ctx.state.poolInUse}/${ctx.params.cap} connections in use`, cls: ctx.state.poolInUse >= ctx.params.cap ? "err" : "ok" };
    case "queue": return {
      text: labels.queueStatusNote
        ? `In-flight: ${ctx.state.queueLevel.toFixed(0)} — ${labels.queueStatusNote}`
        : `Depth: ${ctx.state.queueLevel.toFixed(0)} — Little's Law L=λW`,
      cls: ctx.state.queueLevel >= ctx.params.cap ? "warn" : "ok",
    };
    case "latency": {
      const slo = ctx.params.cap;
      const p99 = Math.round(ctx.state.latencyP99);
      return { text: `p99: ${p99}ms (SLO ${slo}ms)`, cls: p99 > slo ? "err" : "ok" };
    }
    case "backoff": {
      const step = Math.floor(ctx.state.backoffStep);
      return { text: `Retry ${step} — wait ${2 ** step}ms before next attempt`, cls: "warn" };
    }
    case "amplification": {
      if (ctx.state.amplificationKind === "n-plus-one") {
        const n = Math.round(ctx.params.cap);
        const q = 1 + n;
        return { text: `${q} queries per list fetch (1 + ${n})`, cls: q > 10 ? "err" : "ok" };
      }
      return { text: `${ctx.state.amplification} queries per user action`, cls: ctx.state.amplification > 5 ? "err" : "ok" };
    }
    case "timeline": {
      if (ctx.state.timelineVariant === "gc") {
        if (ctx.state.inStw) return { text: "STOP-THE-WORLD GC — all request threads paused", cls: "err" };
        const heap = Math.round(ctx.state.heapPressure || 0);
        return { text: `Heap ${heap}% — serving requests`, cls: heap >= ctx.params.cap * 0.85 ? "warn" : "ok" };
      }
      return { text: `${(ctx.state.timelineEvents || []).length} timeline events recorded`, cls: "ok" };
    }
    case "fanout": return { text: `${ctx.state.tokens.toFixed(1)} ${labels.bucketLabel.toLowerCase()} remaining`, cls: ctx.state.tokens < 1 ? "warn" : "ok" };
    default: return { text: `${ctx.state.tokens.toFixed(1)} tokens available`, cls: "ok" };
  }
}
