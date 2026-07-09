/**
 * Race lab — step-through concurrent interleaving on a shared resource.
 */
import { mountLab } from "../mountLab.js";
import { C } from "../../primitives.js";

function normalizeLockId(value) {
  return String(value).replace(/^row\s+/i, "");
}

function drawLockFrame(ctx, d, cfg, workersBase, lockIds) {
  const lockX = 420;
  const lockW = 156;
  const lockH = 72;
  const lockTop = 118;
  const lockGap = 148;
  const lockAnchors = new Map();

  d.text(498, 52, cfg.resourceLabel || "Locks", { size: 12, align: "center", color: C.muted });

  lockIds.forEach((lockId, i) => {
    const y = lockTop + i * lockGap;
    const holder = ctx.state.lockHolders[lockId];
    const waitingOn = Object.entries(ctx.state.waiting).find(([, target]) => target === lockId);
    const anchor = d.node(lockX, y, lockW, lockH, {
      title: `Lock ${lockId}`,
      value: holder ? `held by ${holder}` : "free",
      color: holder ? C.lock : C.ledger,
      state: waitingOn && ctx.state.finalBad ? "err" : holder ? "warn" : "",
      active: Boolean(holder),
    });
    lockAnchors.set(lockId, anchor);
  });

  const workerTop = 88;
  const workerBottom = 372;
  const workerX = 72;
  const workerW = 116;
  const workerH = 52;
  const gap = workersBase.length > 1 ? (workerBottom - workerTop) / (workersBase.length - 1) : 0;
  const workerAnchors = new Map();
  workersBase.forEach((w, i) => {
    const y = Math.round(workerTop + i * gap);
    const active = ctx.state.done.some((s) => s.worker === w.id);
    const waiting = ctx.state.waiting[w.id];
    const anchor = d.node(workerX, y, workerW, workerH, {
      title: w.id,
      value: waiting ? `waits ${waiting}` : "",
      color: w.color,
      state: waiting && ctx.state.finalBad ? "err" : "",
      active,
    });
    workerAnchors.set(w.id, anchor);
  });

  const laneByWorker = new Map();
  const targetLanes = [-24, -8, 8, 24];
  ctx.state.done.forEach((s, i) => {
    const worker = workerAnchors.get(s.worker);
    const lockId = normalizeLockId(s.value);
    const lock = lockAnchors.get(lockId);
    if (!worker || !lock) return;
    const lane = laneByWorker.get(s.worker) || 0;
    laneByWorker.set(s.worker, lane + 1);
    const sourceOffset = (lane % 2 === 0 ? 1 : -1) * (8 + Math.floor(lane / 2) * 10);
    const targetOffset = targetLanes[i % targetLanes.length];
    const waiting = s.action === "wait";
    d.arrow(worker.right, worker.cy + sourceOffset, lock.left, lock.cy + targetOffset, {
      color: waiting ? C.err : C.lock,
      label: `${s.action} ${lockId}`,
      head: true,
      dashed: waiting,
      width: waiting ? 2.2 : 2,
    });
  });

  if (ctx.state.finalBad) {
    const lockA = lockAnchors.get(lockIds[0]);
    const lockB = lockAnchors.get(lockIds[1]);
    if (lockA && lockB) {
      d.arrow(lockA.right, lockA.cy - 10, lockB.left, lockB.cy - 10, {
        color: C.err,
        dashed: true,
        width: 1.6,
        alpha: 0.7,
      });
      d.arrow(lockB.right, lockB.cy + 10, lockA.left, lockA.cy + 10, {
        color: C.err,
        dashed: true,
        width: 1.6,
        alpha: 0.7,
      });
    }
    d.badge(500, 96, cfg.failBadge || "Circular wait — deadlock", { color: C.err, filled: true, align: "center" });
  }
}

export function raceLab(stage, panel, stageEl, cfg) {
  const steps = cfg.steps || [
    { id: "t1r", worker: "T1", action: "read", value: "100", color: C.service },
    { id: "t2r", worker: "T2", action: "read", value: "100", color: C.gateway },
    { id: "t1w", worker: "T1", action: "write", value: "120", color: C.service },
    { id: "t2w", worker: "T2", action: "write", value: "130", stale: true, color: C.gateway },
  ];
  const isLockMode = cfg.mode === "locks" || (cfg.resources && cfg.resources.length > 0);
  const lockIds = cfg.resources || (isLockMode ? ["A", "B"] : []);
  const workerPalette = [C.service, C.gateway, C.accent, C.warn, C.lock, C.client];
  const workerIds = (cfg.workers && cfg.workers.length ? cfg.workers : [...new Set(steps.map((s) => s.worker))]).filter(Boolean);
  const workersBase = (workerIds.length ? workerIds : ["T1", "T2"]).map((id, i) => {
    const stepColor = steps.find((s) => s.worker === id && s.color)?.color;
    return { id, color: stepColor || workerPalette[i % workerPalette.length] };
  });

  return mountLab(stage, panel, stageEl, {
    note: cfg.note || "Click each step to replay the interleaving. Watch the shared row.",
    init(ctx) {
      ctx.state.stepIdx = -1;
      ctx.state.balance = cfg.initialBalance ?? 100;
      ctx.state.done = [];
      ctx.state.finalBad = false;
      if (isLockMode) {
        ctx.state.lockHolders = {};
        ctx.state.waiting = {};
      }
    },
    actions: steps.map((s, i) => ({
      id: s.id,
      label: `${s.worker}: ${s.action} ${s.value}`,
      primary: i === 0,
      onClick(ctx) {
        if (ctx.state.stepIdx >= i) return;
        ctx.state.stepIdx = i;
        ctx.state.done.push(s);
        if (isLockMode) {
          const lockId = normalizeLockId(s.value);
          if (s.action === "lock") ctx.state.lockHolders[lockId] = s.worker;
          else if (s.action === "wait") ctx.state.waiting[s.worker] = lockId;
        } else if (s.action === "write") {
          ctx.state.balance = parseInt(s.value, 10);
        }
        if (s.stale) ctx.state.finalBad = true;
      },
    })),
    frame(ctx) {
      const d = ctx.d;
      d.grid();

      if (isLockMode) {
        drawLockFrame(ctx, d, cfg, workersBase, lockIds);
        return;
      }

      const ledger = d.db(410, 184, 210, 112, {
        title: cfg.resourceLabel || "Ledger row",
        color: C.ledger,
        value: `balance = ${ctx.state.balance}`,
      });

      const workerTop = 88;
      const workerBottom = 420;
      const workerX = 72;
      const workerW = 116;
      const workerH = 52;
      const gap = workersBase.length > 1 ? (workerBottom - workerTop) / (workersBase.length - 1) : 0;
      const workerAnchors = new Map();
      workersBase.forEach((w, i) => {
        const y = Math.round(workerTop + i * gap);
        const active = ctx.state.done.some((s) => s.worker === w.id);
        const anchor = d.node(workerX, y, workerW, workerH, { title: w.id, color: w.color, active });
        workerAnchors.set(w.id, anchor);
      });

      const laneByWorker = new Map();
      const targetLanes = [-28, -14, 0, 14, 28, 42];
      ctx.state.done.forEach((s, i) => {
        const worker = workerAnchors.get(s.worker);
        if (!worker) return;
        const lane = laneByWorker.get(s.worker) || 0;
        laneByWorker.set(s.worker, lane + 1);
        const sourceOffset = (lane % 2 === 0 ? 1 : -1) * (7 + Math.floor(lane / 2) * 10);
        const targetOffset = targetLanes[i % targetLanes.length];
        d.arrow(worker.right, worker.cy + sourceOffset, ledger.left, ledger.cy + targetOffset, {
          color: s.stale ? C.err : C.accent,
          label: `${s.action} ${s.value}`,
          head: true,
        });
      });

      if (ctx.state.finalBad && cfg.expectedBalance != null) {
        d.badge(500, 100, `Expected ${cfg.expectedBalance ?? 150}, got ${ctx.state.balance}`, { color: C.err, filled: true, align: "center" });
      }
    },
    status(ctx) {
      if (ctx.state.finalBad) return { text: cfg.failMessage || "Lost update — second write overwrote first", cls: "err" };
      if (ctx.state.stepIdx >= steps.length - 1) return { text: "Interleaving complete", cls: ctx.state.finalBad ? "err" : "ok" };
      return { text: `Step ${ctx.state.stepIdx + 1} of ${steps.length}`, cls: "" };
    },
  });
}
