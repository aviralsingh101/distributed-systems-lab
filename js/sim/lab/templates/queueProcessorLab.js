/**
 * Queue processor lab — poison/DLQ, backpressure, pub/sub, visibility timeout, etc.
 * Tick-driven (no setTimeout) so behavior specs can verify state transitions.
 */
import { mountLab } from "../mountLab.js";
import { createDomOverlay } from "../domOverlay.js";
import { C, withAlpha } from "../../primitives.js";

const CHIP_TOP = 44;

function msgLabel(m) {
  return m.label || `M${m.id}`;
}

function slotCenter(slot) {
  return { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };
}

function launchFlight(ctx, fromSlot, toSlot, msg, opts = null) {
  const a = slotCenter(fromSlot);
  const b = slotCenter(toSlot);
  const color = opts?.color
    ?? (msg?.type === "poison" ? C.err : msg?.type === "duplicate" ? C.warn : C.accent);
  const flight = {
    fromX: a.x,
    fromY: a.y,
    toX: b.x,
    toY: b.y,
    p: 0,
    msg,
    color,
    onComplete: opts?.onComplete || null,
    label: opts?.label || "",
  };
  if (ctx.state.activeFlight) {
    if (!ctx.state.flightQueue) ctx.state.flightQueue = [];
    ctx.state.flightQueue.push(flight);
  } else {
    ctx.state.activeFlight = flight;
  }
  ctx.state.flight = ctx.state.activeFlight;
}

function tickFlight(ctx, dt) {
  const f = ctx.state.activeFlight;
  if (!f || dt <= 0) return;
  f.p += dt * 2.2;
  if (f.p >= 1) {
    const onComplete = f.onComplete;
    ctx.state.activeFlight = ctx.state.flightQueue?.shift() || null;
    if (ctx.state.activeFlight) ctx.state.activeFlight.p = 0;
    ctx.state.flight = ctx.state.activeFlight;
    if (onComplete) onComplete();
  }
}

function drawFlight(ctx, d) {
  const f = ctx.state.activeFlight;
  if (!f) return;
  const p = Math.min(1, f.p);
  const pos = d.along(f.fromX, f.fromY, f.toX, f.toY, p);
  d.arrow(f.fromX, f.fromY, f.toX, f.toY, { color: f.color || C.accent, width: 1.5, head: false, alpha: 0.18, dashed: true });
  d.arrow(f.fromX, f.fromY, pos.x, pos.y, { color: f.color || C.accent, width: 3, head: p > 0.75, alpha: 0.85 });
  d.token(pos.x, pos.y, {
    r: 11,
    color: f.color || C.accent,
    text: f.msg ? msgLabel(f.msg).slice(0, 8) : "",
    glow: true,
    skipLayout: true,
  });
  if (f.label && p > 0.35) {
    d.badge(pos.x, pos.y - 22, f.label, { color: f.color || C.accent, align: "center" });
  }
}

function queueChipHtml(m, color) {
  const label = msgLabel(m);
  const w = m.label ? Math.max(36, label.length * 5.5 + 12) : 28;
  const bg = color || (m.type === "poison" ? "#333" : m.type === "duplicate" ? "#ffb454" : "#5b9dff");
  return `<span style="display:inline-block;min-width:${w}px;height:22px;border-radius:4px;padding:0 4px;background:${bg};color:#fff;font-size:8px;text-align:center;line-height:22px;flex-shrink:0;">${label}</span>`;
}

function stackChipsHtml(msgs, color) {
  if (!msgs?.length) return "";
  return `<div style="display:flex;flex-wrap:wrap;align-content:flex-start;gap:3px;width:100%;">${msgs.map((m) => queueChipHtml(m, color)).join("")}</div>`;
}

function chipOverlayStyle(slot, scaleStyle) {
  return scaleStyle(slot.x + 8, slot.y + CHIP_TOP, {
    width: `${slot.w - 16}px`,
    height: `${slot.h - CHIP_TOP - 22}px`,
    overflow: "hidden",
  });
}

function syncCounts(ctx) {
  ctx.state.dlqCount = ctx.state.dlq?.length ?? 0;
  ctx.state.processedCount = ctx.state.success?.length ?? 0;
  ctx.state.queueDepth = ctx.state.queue?.length ?? 0;
}

function schedule(ctx, seconds, fn) {
  if (!ctx.state._timers) ctx.state._timers = [];
  ctx.state._timers.push({ remaining: seconds, fn });
}

function tickTimers(ctx, dt) {
  if (!ctx.state._timers?.length || dt <= 0) return;
  for (const t of ctx.state._timers) t.remaining -= dt;
  const ready = ctx.state._timers.filter((t) => t.remaining <= 0);
  ctx.state._timers = ctx.state._timers.filter((t) => t.remaining > 0);
  for (const t of ready) t.fn();
  if (ready.length) syncCounts(ctx);
}

export function queueProcessorLab(stage, panel, stageEl, cfg) {
  const overlay = createDomOverlay(stageEl);
  const variant = cfg.variant || "poison-dlq";
  const messages = cfg.messages || [
    { id: 1, type: "valid" },
    { id: 2, type: "valid" },
    { id: 3, type: "poison" },
    { id: 4, type: "valid" },
    { id: 5, type: "valid" },
  ];
  const maxRetries = cfg.maxRetries ?? 3;
  const queueCapacity = cfg.queueCapacity ?? 4;
  const publishCount = cfg.publishCount ?? messages.length * 2;
  const producerRate = cfg.producerRate ?? 0.32;
  const consumerSlowMs = cfg.consumerSlowMs ?? 1.15;
  const consumerFastMs = cfg.consumerFastMs ?? 0.38;
  const queueSlot = { x: 50, y: 120, w: 270, h: 160 };
  const workerSlot = { x: 370, y: 150, w: 150, h: 88 };
  const processedSlot = { x: 620, y: 70, w: 230, h: 130 };
  const dlqSlot = { x: 620, y: 230, w: 230, h: 130 };
  const producerSlot = { x: 120, y: 48, w: 130, h: 56 };

  const scaleStyle = (x, y, style = {}) => {
    const scale = stage.scale ?? 1;
    const offx = stage.offx ?? 0;
    const offy = stage.offy ?? 0;
    return {
      left: `${offx + x * scale}px`,
      top: `${offy + y * scale}px`,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      ...style,
    };
  };

  const defaultModeSelect = {
    key: "mode",
    label: "Mode",
    value: "with_dlq",
    options: [
      { value: "no_dlq", label: "Without DLQ (infinite retry)" },
      { value: "with_dlq", label: "With DLQ (safe handling)" },
    ],
  };

  function initPoison(ctx) {
    ctx.state.queue = messages.map((m) => ({ ...m, retries: 0 }));
    ctx.state.success = [];
    ctx.state.dlq = [];
    ctx.state.processing = false;
    ctx.state.workerMsg = null;
    ctx.state.workerStatus = "Idle";
    ctx.state.shake = false;
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Start Processing".';
    ctx.state.activeFlight = null;
    ctx.state.flightQueue = [];
    ctx.state.flight = null;
    ctx.state._timers = [];
    syncCounts(ctx);
  }

  function processNextPoison(ctx) {
    if (!ctx.state.queue.length) {
      ctx.state.processing = false;
      ctx.state.workerStatus = "Done";
      ctx.state.scenario = "complete";
      ctx.state.explainer = "<b style='color:#3ddc97'>Processing complete.</b>";
      syncCounts(ctx);
      return;
    }
    ctx.state.processing = true;
    const msg = ctx.state.queue.shift();
    launchFlight(ctx, queueSlot, workerSlot, msg);
    ctx.state.workerMsg = msg;
    ctx.state.workerStatus = "Processing...";
    syncCounts(ctx);

    schedule(ctx, 0.7, () => {
      if (msg.type === "valid" || msg.type === "slow") {
        launchFlight(ctx, workerSlot, processedSlot, msg);
        schedule(ctx, 0.45, () => {
          ctx.state.success.push(msg);
          ctx.state.workerMsg = null;
          ctx.state.workerStatus = "Idle";
          schedule(ctx, 0.4, () => processNextPoison(ctx));
        });
      } else {
        ctx.state.shake = true;
        ctx.state.workerStatus = "CRASH!";
        schedule(ctx, 0.6, () => {
          ctx.state.shake = false;
          msg.retries++;
          ctx.state.workerMsg = null;
          const useDlq = ctx.selects.mode !== "no_dlq";
          const name = msgLabel(msg);
          if (!useDlq) {
            launchFlight(ctx, workerSlot, queueSlot, msg, { color: C.err });
            schedule(ctx, 0.45, () => {
              ctx.state.queue.unshift(msg);
              const blocked = ctx.state.queue.length - 1;
              ctx.state.scenario = "retry_loop";
              ctx.state.explainer = blocked
                ? `<b style='color:#ff5c6c'>Retry loop!</b> ${name} requeued — ${blocked} event(s) blocked behind it.`
                : `Worker crashed on <b>${name}</b>. Requeued (no DLQ).`;
              ctx.state.workerStatus = "Recovering...";
              schedule(ctx, 0.8, () => processNextPoison(ctx));
              syncCounts(ctx);
            });
          } else if (msg.retries < maxRetries) {
            launchFlight(ctx, workerSlot, queueSlot, msg, { color: C.warn });
            schedule(ctx, 0.45, () => {
              ctx.state.queue.unshift(msg);
              ctx.state.scenario = "retrying";
              ctx.state.explainer = `Worker crashed on <b>${name}</b>. Requeued. Attempt ${msg.retries}/${maxRetries}.`;
              ctx.state.workerStatus = "Recovering...";
              schedule(ctx, 0.8, () => processNextPoison(ctx));
              syncCounts(ctx);
            });
          } else {
            launchFlight(ctx, workerSlot, dlqSlot, msg, {
              color: C.err,
              label: "→ DLQ",
              onComplete: () => {
                ctx.state.dlq.push(msg);
                ctx.state.scenario = "dlq_offloaded";
                ctx.state.explainer = `<b style='color:#3ddc97'>System saved!</b> ${name} moved to DLQ after ${maxRetries} failures. Queue unblocked.`;
                ctx.state.workerStatus = "Idle";
                syncCounts(ctx);
                schedule(ctx, 0.6, () => processNextPoison(ctx));
              },
            });
          }
          syncCounts(ctx);
        });
      }
      syncCounts(ctx);
    });
  }

  function initBackpressure(ctx) {
    ctx.state.queue = [];
    ctx.state.success = [];
    ctx.state.dlq = [];
    ctx.state.producerIdx = 0;
    ctx.state.producerDone = false;
    ctx.state.producerPaused = false;
    ctx.state.pauseCount = 0;
    ctx.state.droppedCount = 0;
    ctx.state.processing = false;
    ctx.state.workerMsg = null;
    ctx.state.workerBusy = false;
    ctx.state.workerStatus = "Idle";
    ctx.state.producerStatus = "Idle";
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Run pipeline".';
    ctx.state.activeFlight = null;
    ctx.state.flightQueue = [];
    ctx.state._timers = [];
    syncCounts(ctx);
  }

  function maybeFinishPipeline(ctx, bounded) {
    if (!ctx.state.producerDone || ctx.state.workerBusy || ctx.state.queue.length) return;
    ctx.state.processing = false;
    ctx.state.workerStatus = "Done";
    ctx.state.producerStatus = "Done";
    ctx.state.scenario = bounded ? "backpressure_applied" : "unbounded_growth";
    ctx.state.explainer = bounded
      ? `<b style='color:#3ddc97'>Backpressure worked.</b> Producer paused ${ctx.state.pauseCount} time(s) while the slow consumer drained the queue.`
      : `<b style='color:#ff5c6c'>Unbounded backlog.</b> Queue grew to ${ctx.state.queueDepth} — no backpressure applied.`;
    syncCounts(ctx);
  }

  function runConsumerStep(ctx, bounded, consumerMs) {
    if (ctx.state.workerBusy) return;
    if (!ctx.state.queue.length) {
      maybeFinishPipeline(ctx, bounded);
      return;
    }
    const msg = ctx.state.queue.shift();
    ctx.state.workerBusy = true;
    ctx.state.workerMsg = msg;
    ctx.state.workerStatus = `Processing ${msgLabel(msg)}`;
    launchFlight(ctx, queueSlot, workerSlot, msg);
    syncCounts(ctx);

    schedule(ctx, consumerMs * 0.55, () => {
      launchFlight(ctx, workerSlot, processedSlot, msg);
      schedule(ctx, 0.4, () => {
        ctx.state.success.push(msg);
        ctx.state.workerMsg = null;
        ctx.state.workerBusy = false;
        ctx.state.workerStatus = "Draining...";
        syncCounts(ctx);
        schedule(ctx, 0.15, () => runConsumerStep(ctx, bounded, consumerMs));
      });
    });
  }

  function runBackpressure(ctx) {
    if (ctx.state.processing) return;
    ctx.state.processing = true;
    ctx.state.scenario = "running";
    ctx.state.workerStatus = "Draining...";
    ctx.state.producerStatus = "Publishing";
    const bounded = ctx.toggles.bounded !== false;
    const consumerMs = 0.95;

    function tickProducer() {
      if (ctx.state.producerDone) return;

      if (ctx.state.producerIdx >= messages.length) {
        ctx.state.producerDone = true;
        ctx.state.producerStatus = bounded ? "Finished" : "Finished";
        ctx.state.producerPaused = false;
        maybeFinishPipeline(ctx, bounded);
        return;
      }

      const m = { ...messages[ctx.state.producerIdx], retries: 0 };

      if (bounded && ctx.state.queue.length >= queueCapacity) {
        ctx.state.producerPaused = true;
        ctx.state.pauseCount++;
        ctx.state.explainer = `<b style='color:#ffb454'>Backpressure!</b> Queue full (${queueCapacity}/${queueCapacity}) — producer blocked until consumer drains.`;
        schedule(ctx, 0.35, tickProducer);
        syncCounts(ctx);
        return;
      }

      ctx.state.producerPaused = false;
      ctx.state.queue.push(m);
      ctx.state.producerIdx++;
      launchFlight(ctx, producerSlot, queueSlot, m);
      ctx.state.explainer = bounded
        ? `Producer published <b>${msgLabel(m)}</b> — queue depth ${ctx.state.queue.length}/${queueCapacity}.`
        : `Producer published <b>${msgLabel(m)}</b> — unbounded depth ${ctx.state.queue.length}.`;
      syncCounts(ctx);
      schedule(ctx, producerRate, tickProducer);
    }

    tickProducer();
    runConsumerStep(ctx, bounded, consumerMs);
  }

  function initSlowConsumer(ctx) {
    ctx.state.queue = [];
    ctx.state.success = [];
    ctx.state.dlq = [];
    ctx.state.producerIdx = 0;
    ctx.state.producerDone = false;
    ctx.state.publishedCount = 0;
    ctx.state.processing = false;
    ctx.state.workerMsg = null;
    ctx.state.workerBusy = false;
    ctx.state.workerStatus = "Idle";
    ctx.state.producerStatus = "Idle";
    ctx.state.consumerLag = 0;
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Start pipeline".';
    ctx.state.activeFlight = null;
    ctx.state.flightQueue = [];
    ctx.state._timers = [];
    syncCounts(ctx);
  }

  function updateConsumerLag(ctx) {
    ctx.state.consumerLag = ctx.state.queue.length + (ctx.state.workerBusy ? 1 : 0);
  }

  function maybeFinishSlowConsumer(ctx, fast) {
    if (!ctx.state.producerDone || ctx.state.workerBusy || ctx.state.queue.length) return;
    ctx.state.processing = false;
    ctx.state.workerStatus = "Caught up";
    ctx.state.producerStatus = "Done";
    ctx.state.consumerLag = 0;
    ctx.state.scenario = fast ? "scaled_complete" : "lag_cleared";
    ctx.state.explainer = fast
      ? "<b style='color:#3ddc97'>Scaled out.</b> Extra workers raised consume rate — lag cleared."
      : "<b style='color:#3ddc97'>Lag cleared.</b> Consumer eventually drained the backlog.";
    syncCounts(ctx);
  }

  function runSlowConsumerStep(ctx, processMs, fast) {
    if (ctx.state.workerBusy) return;
    if (!ctx.state.queue.length) {
      updateConsumerLag(ctx);
      maybeFinishSlowConsumer(ctx, fast);
      return;
    }
    const msg = ctx.state.queue.shift();
    updateConsumerLag(ctx);
    ctx.state.workerBusy = true;
    ctx.state.workerMsg = msg;
    ctx.state.workerStatus = fast ? "Fast worker pool" : "Slow consumer";
    ctx.state.explainer = fast
      ? `Workers processing <b>${msgLabel(msg)}</b> — lag ${ctx.state.consumerLag}.`
      : `<b style='color:#ffb454'>Consumer lag ${ctx.state.consumerLag}</b> — producer still outpacing a single slow worker.`;
    launchFlight(ctx, queueSlot, workerSlot, msg);
    syncCounts(ctx);

    schedule(ctx, processMs * 0.55, () => {
      launchFlight(ctx, workerSlot, processedSlot, msg);
      schedule(ctx, 0.38, () => {
        ctx.state.success.push(msg);
        ctx.state.workerMsg = null;
        ctx.state.workerBusy = false;
        updateConsumerLag(ctx);
        syncCounts(ctx);
        schedule(ctx, 0.12, () => runSlowConsumerStep(ctx, processMs, fast));
      });
    });
  }

  function processSlowConsumer(ctx) {
    if (ctx.state.processing) return;
    ctx.state.processing = true;
    const fast = !!ctx.toggles.scaleOut;
    const processMs = fast ? consumerFastMs : consumerSlowMs;
    ctx.state.scenario = fast ? "scaled" : "lagging";
    ctx.state.producerStatus = "Publishing";
    ctx.state.workerStatus = fast ? "Fast worker pool" : "Slow consumer";

    function tickProducer() {
      if (ctx.state.producerDone) return;

      if (ctx.state.publishedCount >= publishCount) {
        ctx.state.producerDone = true;
        ctx.state.producerStatus = "Done";
        maybeFinishSlowConsumer(ctx, fast);
        return;
      }

      const src = messages[ctx.state.publishedCount % messages.length];
      const m = { ...src, id: ctx.state.publishedCount + 1, retries: 0 };
      ctx.state.publishedCount++;
      ctx.state.producerIdx = ctx.state.publishedCount;
      ctx.state.queue.push(m);
      updateConsumerLag(ctx);
      launchFlight(ctx, producerSlot, queueSlot, m);
      ctx.state.explainer = `<b style='color:#ffb454'>Producer rate &gt; consume rate.</b> Published <b>${msgLabel(m)}</b> — lag now ${ctx.state.consumerLag}.`;
      syncCounts(ctx);
      schedule(ctx, producerRate, tickProducer);
    }

    tickProducer();
    runSlowConsumerStep(ctx, processMs, fast);
  }

  function initVisibility(ctx) {
    ctx.state.queue = [{ ...messages[0], retries: 0, deliveries: 0 }];
    ctx.state.success = [];
    ctx.state.dlq = [];
    ctx.state.inFlight = null;
    ctx.state.visibilityExpired = false;
    ctx.state.deliveryCount = 0;
    ctx.state.processing = false;
    ctx.state.workerStatus = "Idle";
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Receive message".';
    ctx.state._timers = [];
    syncCounts(ctx);
  }

  function runVisibility(ctx) {
    if (ctx.state.processing) return;
    const msg = ctx.state.queue.shift() || ctx.state.inFlight;
    if (!msg) return;
    ctx.state.processing = true;
    ctx.state.inFlight = msg;
    msg.deliveries = (msg.deliveries || 0) + 1;
    ctx.state.deliveryCount = msg.deliveries;
    ctx.state.workerMsg = msg;
    ctx.state.workerStatus = "In-flight (hidden)";
    ctx.state.explainer = `Message <b>${msgLabel(msg)}</b> received — visibility clock started.`;
    launchFlight(ctx, queueSlot, workerSlot, msg);
    syncCounts(ctx);

    const ackInTime = ctx.toggles.ackInTime !== false;
    if (ackInTime) {
      schedule(ctx, 0.8, () => {
        launchFlight(ctx, workerSlot, processedSlot, msg);
        schedule(ctx, 0.45, () => {
          ctx.state.success.push(msg);
          ctx.state.inFlight = null;
          ctx.state.workerMsg = null;
          ctx.state.processing = false;
          ctx.state.workerStatus = "Acked";
          ctx.state.scenario = "acked";
          ctx.state.explainer = `<b style='color:#3ddc97'>Acked in time.</b> ${msgLabel(msg)} deleted from queue.`;
          syncCounts(ctx);
        });
      });
    } else {
      schedule(ctx, 1.0, () => {
        ctx.state.visibilityExpired = true;
        ctx.state.workerStatus = "Timeout!";
        ctx.state.explainer = `<b style='color:#ff5c6c'>Visibility timeout!</b> Worker crashed before ack — message returns.`;
        schedule(ctx, 0.4, () => {
          launchFlight(ctx, workerSlot, queueSlot, msg, { color: C.warn });
          schedule(ctx, 0.45, () => {
            ctx.state.queue.unshift(msg);
            ctx.state.inFlight = null;
            ctx.state.workerMsg = null;
            ctx.state.processing = false;
            ctx.state.workerStatus = "Re-visible";
            ctx.state.scenario = "redelivered";
            ctx.state.explainer = `<b style='color:#ffb454'>Redelivered.</b> ${msgLabel(msg)} visible again — delivery #${msg.deliveries + 1} risk.`;
            syncCounts(ctx);
          });
        });
      });
    }
  }

  function initRebalance(ctx) {
    ctx.state.partitions = [
      { id: "P0", msgs: ["evt-1", "evt-4"] },
      { id: "P1", msgs: ["evt-2", "evt-5"] },
      { id: "P2", msgs: ["evt-3"] },
    ];
    ctx.state.consumers = ["C1", "C2"];
    ctx.state.assignments = { C1: ["P0", "P1"], C2: ["P2"] };
    ctx.state.rebalancing = false;
    ctx.state.processing = false;
    ctx.state.workerStatus = "Stable";
    ctx.state.scenario = "stable";
    ctx.state.explainer = cfg.explainer || 'Click "Rebalance group".';
    syncCounts(ctx);
  }

  function runRebalance(ctx) {
    if (ctx.state.rebalancing) return;
    ctx.state.rebalancing = true;
    ctx.state.processing = true;
    ctx.state.workerStatus = "Rebalancing...";
    ctx.state.scenario = "rebalancing";
    ctx.state.explainer = "<b style='color:#ffb454'>Rebalance triggered</b> — revoking partitions, pausing consumption.";
    schedule(ctx, 0.9, () => {
      if (ctx.toggles.newConsumer) {
        ctx.state.consumers = ["C1", "C2", "C3"];
        ctx.state.assignments = { C1: ["P0"], C2: ["P1"], C3: ["P2"] };
        ctx.state.explainer = "<b style='color:#3ddc97'>C3 joined.</b> Partitions redistributed 1:1 across three consumers.";
        ctx.state.scenario = "expanded";
      } else {
        ctx.state.consumers = ["C1", "C2"];
        ctx.state.assignments = { C1: ["P0", "P2"], C2: ["P1"] };
        ctx.state.explainer = "<b style='color:#3ddc97'>Rebalance complete.</b> Partitions reassigned across two consumers.";
        ctx.state.scenario = "reassigned";
      }
      ctx.state.rebalancing = false;
      ctx.state.processing = false;
      ctx.state.workerStatus = "Consuming";
      syncCounts(ctx);
    });
  }

  function initPubSub(ctx) {
    ctx.state.topic = cfg.topicLabel || "payment.captured";
    ctx.state.subscribers = (cfg.subscribers || ["Ledger", "Notify", "Fraud"]).map((name) => ({
      name,
      inbox: [],
    }));
    ctx.state.success = [];
    ctx.state.processing = false;
    ctx.state.fanoutCount = 0;
    ctx.state.workerStatus = "Idle";
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Publish event".';
    syncCounts(ctx);
  }

  function runPubSub(ctx) {
    if (ctx.state.processing) return;
    ctx.state.processing = true;
    const event = { ...messages[0], retries: 0 };
    const durable = ctx.toggles.durable !== false;
    const topicSlot = { x: 120, y: 190, w: 200, h: 72 };
    ctx.state.workerStatus = "Publishing";
    ctx.state.explainer = `Publishing <b>${msgLabel(event)}</b> to topic <code>${ctx.state.topic}</code>.`;
    let i = 0;

    function deliverNext() {
      if (i >= ctx.state.subscribers.length) {
        ctx.state.processing = false;
        ctx.state.workerStatus = "Published";
        ctx.state.fanoutCount = ctx.state.subscribers.reduce((n, s) => n + s.inbox.length, 0);
        ctx.state.scenario = durable ? "fanout_complete" : "ephemeral_miss";
        ctx.state.explainer = durable
          ? `<b style='color:#3ddc97'>Fan-out complete.</b> ${ctx.state.fanoutCount} subscriber copies delivered.`
          : `<b style='color:#ffb454'>Ephemeral fan-out.</b> Offline subscribers missed the event.`;
        syncCounts(ctx);
        return;
      }
      const sub = ctx.state.subscribers[i];
      const subY = 120 + i * 88;
      const subSlot = { x: 480, y: subY, w: 170, h: 64 };
      const offline = !durable && sub.name === "Fraud";
      if (!offline) {
        launchFlight(ctx, topicSlot, subSlot, event, {
          color: C.accent,
          onComplete: () => {
            sub.inbox.push({ ...event });
            ctx.state.success.push({ subscriber: sub.name, event: msgLabel(event) });
            syncCounts(ctx);
          },
        });
      }
      i++;
      schedule(ctx, 0.55, deliverNext);
    }
    deliverNext();
  }

  function initWorkQueue(ctx) {
    ctx.state.queue = messages.map((m) => ({ ...m, retries: 0 }));
    ctx.state.success = [];
    ctx.state.dlq = [];
    ctx.state.processing = false;
    ctx.state.workersActive = 1;
    ctx.state.workerStatus = "Idle";
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Start workers".';
    syncCounts(ctx);
  }

  function runWorkQueue(ctx) {
    if (ctx.state.processing || !ctx.state.queue.length) return;
    ctx.state.processing = true;
    const workers = ctx.toggles.twoWorkers ? 2 : 1;
    ctx.state.workersActive = workers;
    ctx.state.scenario = workers > 1 ? "competing" : "single_worker";

    function next() {
      if (!ctx.state.queue.length) {
        ctx.state.processing = false;
        ctx.state.workerStatus = "Queue empty";
        ctx.state.scenario = workers > 1 ? "drained_fast" : "drained_slow";
        ctx.state.explainer = workers > 1
          ? "<b style='color:#3ddc97'>Competing consumers.</b> Two workers drained the shared queue faster."
          : "Single worker drained the queue — add workers to increase throughput.";
        syncCounts(ctx);
        return;
      }
      const msg = ctx.state.queue.shift();
      launchFlight(ctx, queueSlot, workerSlot, msg);
      ctx.state.workerMsg = msg;
      ctx.state.workerStatus = workers > 1 ? `W1+W2 → ${msgLabel(msg)}` : `W1 → ${msgLabel(msg)}`;
      const processMs = workers > 1 ? 0.35 : 0.85;
      schedule(ctx, processMs, () => {
        launchFlight(ctx, workerSlot, processedSlot, msg);
        schedule(ctx, 0.35, () => {
          ctx.state.success.push(msg);
          ctx.state.workerMsg = null;
          syncCounts(ctx);
          schedule(ctx, 0.15, next);
        });
      });
    }
    next();
  }

  function initOutboxInbox(ctx) {
    ctx.state.outbox = messages.map((m) => ({ ...m, retries: 0, status: "pending" }));
    ctx.state.inboxSeen = new Set();
    ctx.state.success = [];
    ctx.state.dlq = [];
    ctx.state.inboxSkipped = 0;
    ctx.state.appliedCount = 0;
    ctx.state.processing = false;
    ctx.state.workerStatus = "Idle";
    ctx.state.scenario = "idle";
    ctx.state.explainer = cfg.explainer || 'Click "Relay from outbox".';
    syncCounts(ctx);
  }

  function runOutboxInbox(ctx) {
    if (ctx.state.processing) return;
    ctx.state.processing = true;
    ctx.state.workerStatus = "Relaying";
    const duplicate = !!ctx.toggles.duplicateDelivery;
    const events = [...ctx.state.outbox];
    if (duplicate && events.length) events.push({ ...events[0], type: "duplicate" });
    let i = 0;

    function relayNext() {
      if (i >= events.length) {
        ctx.state.processing = false;
        ctx.state.workerStatus = "Applied";
        ctx.state.scenario = duplicate ? "deduped" : "relayed";
        ctx.state.explainer = duplicate
          ? `<b style='color:#3ddc97'>Inbox deduped.</b> ${ctx.state.inboxSkipped} duplicate(s) skipped; ${ctx.state.appliedCount} applied once.`
          : `<b style='color:#3ddc97'>Outbox relayed.</b> ${ctx.state.appliedCount} event(s) applied exactly once.`;
        syncCounts(ctx);
        return;
      }
      const evt = events[i];
      const key = evt.eventId || evt.label || String(evt.id);
      i++;
      if (ctx.state.inboxSeen.has(key)) {
        ctx.state.inboxSkipped++;
        ctx.state.explainer = `<b style='color:#ffb454'>Duplicate blocked.</b> Inbox already saw <code>${key}</code>.`;
        launchFlight(ctx, queueSlot, workerSlot, evt, { color: C.warn, label: "dup" });
      } else {
        launchFlight(ctx, queueSlot, workerSlot, evt, {
          color: C.accent,
          onComplete: () => {
            ctx.state.inboxSeen.add(key);
            ctx.state.success.push(evt);
            ctx.state.appliedCount++;
            ctx.state.explainer = `Inbox applied <b>${msgLabel(evt)}</b> — recorded <code>${key}</code>.`;
            syncCounts(ctx);
            schedule(ctx, 0.35, () => {
              launchFlight(ctx, workerSlot, processedSlot, evt, { color: C.ok });
            });
          },
        });
      }
      syncCounts(ctx);
      schedule(ctx, 0.5, relayNext);
    }
    relayNext();
  }

  const inits = {
    "poison-dlq": initPoison,
    backpressure: initBackpressure,
    "slow-consumer": initSlowConsumer,
    "visibility-timeout": initVisibility,
    "consumer-rebalancing": initRebalance,
    "pub-sub": initPubSub,
    "work-queue": initWorkQueue,
    "outbox-inbox": initOutboxInbox,
  };

  const starters = {
    "poison-dlq": (ctx) => {
      if (ctx.state.processing || !ctx.state.queue.length) return;
      processNextPoison(ctx);
    },
    backpressure: runBackpressure,
    "slow-consumer": processSlowConsumer,
    "visibility-timeout": runVisibility,
    "consumer-rebalancing": runRebalance,
    "pub-sub": runPubSub,
    "work-queue": runWorkQueue,
    "outbox-inbox": runOutboxInbox,
  };

  return mountLab(stage, panel, stageEl, {
    note: cfg.note || "Start processing. Message 3 is poison — watch with/without DLQ.",
    selects: cfg.selects ?? (cfg.showModeSelect !== false ? [defaultModeSelect] : []),
    toggles: cfg.toggles || [],
    init(ctx) {
      (inits[variant] || initPoison)(ctx);
    },
    actions: [
      {
        id: "start",
        label: cfg.startLabel || "Start Processing",
        primary: true,
        onClick(ctx) {
          (starters[variant] || starters["poison-dlq"])(ctx);
        },
      },
    ],
    frame(ctx, _t, dt) {
      tickTimers(ctx, dt);
      tickFlight(ctx, dt);
      const d = ctx.d;
      d.grid();

      if (variant === "pub-sub") {
        const topicSlot = { x: 120, y: 190, w: 200, h: 72 };
        d.node(topicSlot.x, topicSlot.y, topicSlot.w, topicSlot.h, { title: "Topic", color: C.accent, value: ctx.state.topic });
        ctx.state.subscribers.forEach((sub, i) => {
          const y = 120 + i * 88;
          d.node(480, y, 170, 64, { title: sub.name, color: C.service, value: `${sub.inbox.length} msgs` });
        });
        d.node(730, 190, 180, 72, { title: "Delivered", color: C.ok, value: String(ctx.state.success.length) });
        drawFlight(ctx, d);
      } else if (variant === "consumer-rebalancing") {
        ctx.state.partitions.forEach((p, i) => {
          const x = 140 + i * 200;
          d.node(x, 150, 150, 56, { title: p.id, color: C.queue, value: `${p.msgs.length} msgs` });
        });
        ctx.state.consumers.forEach((c, i) => {
          const x = 180 + i * 200;
          const parts = ctx.state.assignments[c] || [];
          d.node(x, 280, 130, 56, {
            title: c,
            color: ctx.state.rebalancing ? C.warn : C.service,
            value: parts.join(", ") || "—",
          });
          parts.forEach((pid, j) => {
            const px = 140 + ["P0", "P1", "P2"].indexOf(pid) * 200 + 75;
            d.arrow(px, 206, x + 65, 280, { color: ctx.state.rebalancing ? C.faint : C.accent, dashed: ctx.state.rebalancing, head: true, alpha: 0.7 - j * 0.15 });
          });
        });
        if (ctx.state.rebalancing) {
          d.badge(500, 100, "REBALANCING — consumption paused", { color: C.warn, align: "center" });
        }
      } else if (variant === "outbox-inbox") {
        d.node(queueSlot.x, queueSlot.y, queueSlot.w, queueSlot.h, {
          title: "Outbox",
          color: C.queue,
          value: `${ctx.state.outbox?.length ?? 0} events`,
        });
        d.node(workerSlot.x, workerSlot.y, workerSlot.w, workerSlot.h, {
          title: "Inbox dedupe",
          color: C.service,
          value: `${ctx.state.inboxSeen?.size ?? 0} seen`,
        });
        d.node(processedSlot.x, processedSlot.y, processedSlot.w, processedSlot.h, {
          title: "Applied",
          color: C.ok,
          value: String(ctx.state.appliedCount ?? 0),
        });
        d.node(dlqSlot.x, dlqSlot.y, dlqSlot.w, dlqSlot.h, {
          title: "Skipped dupes",
          color: C.warn,
          value: String(ctx.state.inboxSkipped ?? 0),
        });
        const chips = stackChipsHtml(ctx.state.outbox || []);
        overlay.place("queue", chips, chipOverlayStyle(queueSlot, scaleStyle));
        drawFlight(ctx, d);
      } else {
        const isPipeline = variant === "backpressure" || variant === "slow-consumer";
        const qTitle = cfg.queueTitle || (variant === "backpressure" ? "Bounded Queue" : "Main Queue");
        const wTitle = cfg.workerTitle || (variant === "backpressure" ? "Slow Consumer" : variant === "slow-consumer" ? "Consumer" : "Worker");
        const pTitle = cfg.processedTitle || "Processed";
        const dTitle = cfg.dlqTitle || "DLQ";
        const qColor = ctx.state.producerPaused ? C.warn : C.queue;
        const qValue = variant === "backpressure"
          ? (ctx.toggles.bounded !== false
            ? `${ctx.state.queueDepth}/${queueCapacity}${ctx.state.producerPaused ? " PAUSED" : ""}`
            : `${ctx.state.queueDepth} (unbounded)`)
          : `${ctx.state.queueDepth} pending`;

        if (isPipeline) {
          d.node(producerSlot.x, producerSlot.y, producerSlot.w, producerSlot.h, {
            title: "Producer",
            color: ctx.state.producerPaused ? C.warn : C.client,
            value: ctx.state.producerStatus || "Idle",
            active: ctx.state.processing && !ctx.state.producerDone,
          });
          d.arrow(producerSlot.x + producerSlot.w / 2, producerSlot.y + producerSlot.h, queueSlot.x + queueSlot.w / 2, queueSlot.y, {
            color: ctx.state.producerPaused ? C.warn : C.client,
            width: 1.8,
            head: true,
            alpha: ctx.state.producerPaused ? 0.35 : 0.55,
            dashed: ctx.state.producerPaused,
          });
        }

        d.node(queueSlot.x, queueSlot.y, queueSlot.w, queueSlot.h, { title: qTitle, color: qColor, value: qValue });
        d.node(workerSlot.x, workerSlot.y, workerSlot.w, workerSlot.h, {
          title: wTitle,
          color: ctx.state.shake ? C.err : C.service,
          value: ctx.state.workerStatus?.length > 18 ? ctx.state.workerStatus.slice(0, 16) + "…" : ctx.state.workerStatus,
        });
        d.node(processedSlot.x, processedSlot.y, processedSlot.w, processedSlot.h, { title: pTitle, color: C.ok, value: String(ctx.state.processedCount) });
        if (!ctx.state.activeFlight) {
          d.arrow(queueSlot.x + queueSlot.w, queueSlot.y + queueSlot.h / 2, workerSlot.x, workerSlot.y + workerSlot.h / 2, { color: C.faint, width: 1.5, head: true, alpha: 0.35 });
          d.arrow(workerSlot.x + workerSlot.w, workerSlot.y + workerSlot.h / 2 - 12, processedSlot.x, processedSlot.y + processedSlot.h / 2, { color: C.faint, width: 1.5, head: true, alpha: 0.35 });
          if (variant === "poison-dlq") {
            d.arrow(workerSlot.x + workerSlot.w, workerSlot.y + workerSlot.h / 2 + 12, dlqSlot.x, dlqSlot.y + dlqSlot.h / 2, { color: withAlpha(C.err, 0.5), width: 1.5, head: true, alpha: 0.45, dashed: true });
          }
        }
        if (variant === "visibility-timeout") {
          d.node(dlqSlot.x, dlqSlot.y, dlqSlot.w, dlqSlot.h, { title: "Deliveries", color: C.warn, value: String(ctx.state.deliveryCount ?? 0) });
        } else if (variant === "poison-dlq") {
          d.node(dlqSlot.x, dlqSlot.y, dlqSlot.w, dlqSlot.h, { title: dTitle, color: C.err, value: String(ctx.state.dlqCount) });
        } else if (variant === "slow-consumer") {
          d.node(dlqSlot.x, dlqSlot.y, dlqSlot.w, dlqSlot.h, {
            title: "Consumer lag",
            color: ctx.state.consumerLag > 0 ? C.warn : C.ok,
            value: String(ctx.state.consumerLag ?? 0),
          });
        } else if (variant === "backpressure") {
          d.node(dlqSlot.x, dlqSlot.y, dlqSlot.w, dlqSlot.h, {
            title: ctx.toggles.bounded !== false ? "Producer pauses" : "No cap",
            color: ctx.state.pauseCount > 0 ? C.warn : C.client,
            value: ctx.toggles.bounded !== false ? String(ctx.state.pauseCount ?? 0) : "∞",
          });
        } else if (variant === "work-queue") {
          d.node(dlqSlot.x, dlqSlot.y, dlqSlot.w, dlqSlot.h, { title: "Workers", color: C.accent, value: String(ctx.state.workersActive ?? 1) });
        }

        const inFlightId = ctx.state.activeFlight?.msg?.id;
        const chipSource = variant === "visibility-timeout"
          ? [...(ctx.state.queue || []), ...(ctx.state.inFlight ? [ctx.state.inFlight] : [])]
          : (ctx.state.queue || []);
        const visibleQueue = chipSource.filter((m) => m.id !== inFlightId);
        overlay.place("queue", stackChipsHtml(visibleQueue), chipOverlayStyle(queueSlot, scaleStyle));
        overlay.place("processed", stackChipsHtml(ctx.state.success || [], "#3ddc97"), chipOverlayStyle(processedSlot, scaleStyle));
        if (variant === "poison-dlq" || ctx.state.dlqCount > 0) {
          overlay.place("dlq", stackChipsHtml(ctx.state.dlq || [], "#ff5c6c"), chipOverlayStyle(dlqSlot, scaleStyle));
        }

        if (ctx.state.workerMsg && !ctx.state.activeFlight) {
          d.token(workerSlot.x + workerSlot.w / 2, workerSlot.y + workerSlot.h / 2 + 10, {
            r: 12,
            color: ctx.state.workerMsg.type === "poison" ? C.err : C.accent,
            text: msgLabel(ctx.state.workerMsg).slice(0, 10),
          });
        }
        drawFlight(ctx, d);
      }

      overlay.place(
        "explainer",
        `<div style="background:rgba(19,27,43,0.92);border:1px solid #26324a;border-radius:8px;padding:8px 12px;font-size:11px;color:#cdd6e8;width:880px;box-sizing:border-box;line-height:1.4;">${ctx.state.explainer}</div>`,
        scaleStyle(60, 468, { width: "880px" }),
      );
    },
    status(ctx) {
      if (variant === "backpressure") {
        if (ctx.state.producerPaused) return { text: "Backpressure — producer blocked at queue capacity", cls: "warn" };
        if (ctx.state.scenario === "backpressure_applied") return { text: "Bounded queue — producer paused until consumer caught up", cls: "ok" };
        if (ctx.state.scenario === "unbounded_growth") return { text: "Unbounded queue — backlog grew without producer pause", cls: "err" };
      }
      if (ctx.state.scenario === "scaled_complete") return { text: "Scaled out — consumer caught up", cls: "ok" };
      if (variant === "slow-consumer" && ctx.state.consumerLag > 0 && ctx.state.processing) {
        return { text: `Consumer lag: ${ctx.state.consumerLag} messages behind`, cls: "warn" };
      }
      if (variant === "visibility-timeout" && ctx.state.visibilityExpired) {
        return { text: "Visibility timeout — message redelivered", cls: "err" };
      }
      if (variant === "consumer-rebalancing" && ctx.state.rebalancing) {
        return { text: "Rebalancing — partitions reassigned", cls: "warn" };
      }
      if (variant === "pub-sub" && ctx.state.fanoutCount > 0) {
        return { text: `Fan-out: ${ctx.state.fanoutCount} subscriber deliveries`, cls: "ok" };
      }
      if (variant === "work-queue" && ctx.toggles.twoWorkers) {
        return { text: `Competing consumers: ${ctx.state.workersActive} workers active`, cls: "ok" };
      }
      if (variant === "outbox-inbox" && ctx.state.scenario === "relayed") {
        return { text: "Outbox relayed — events applied once", cls: "ok" };
      }
      if (variant === "outbox-inbox" && ctx.state.inboxSkipped > 0) {
        return { text: `Inbox deduped ${ctx.state.inboxSkipped} duplicate(s)`, cls: "ok" };
      }
      if (ctx.state.scenario === "retry_loop") return { text: "Poison message retry loop — queue blocked", cls: "err" };
      if (ctx.state.scenario === "dlq_offloaded") return { text: "Poison moved to DLQ — queue unblocked", cls: "ok" };
      if (!ctx.state.processing && ctx.state.scenario === "complete") return { text: "Processing complete", cls: "ok" };
      return { text: ctx.state.workerStatus, cls: ctx.state.shake ? "err" : "" };
    },
    onReset() { overlay.clear(); },
    transport: true,
  });
}
