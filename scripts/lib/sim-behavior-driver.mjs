/**
 * Headless sim behavior driver for automated QA.
 */
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { Stage } from "../../js/sim/engine.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

class El {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.childNodes = this.children;
    this.className = "";
    this.textContent = "";
    this.innerHTML = "";
    this.style = {};
    this.type = "";
    this.min = "";
    this.max = "";
    this.step = "";
    this.value = "";
    this.checked = false;
    this.clientWidth = 800;
    this.clientHeight = 480;
    this._listeners = {};
    this.dataset = {};
  }
  appendChild(c) { this.children.push(c); return c; }
  append(...nodes) { nodes.forEach((n) => this.appendChild(n)); return nodes[0]; }
  remove() {}
  removeChild(c) { this.children = this.children.filter((x) => x !== c); }
  addEventListener(ev, fn) { (this._listeners[ev] ||= []).push(fn); }
  setAttribute() {}
  querySelector(sel) { return this._find(sel); }
  querySelectorAll(sel) { return this._findAll(sel); }
  _find(sel) {
    if (sel.startsWith("#")) {
      const id = sel.slice(1);
      return this._walk((el) => el.id === id) || null;
    }
    const dataMatch = sel.match(/\[data-id="([^"]+)"\]/);
    if (dataMatch) {
      const dataId = dataMatch[1];
      return this._walk((el) => el.dataset?.id === dataId) || null;
    }
    return null;
  }
  _findAll(sel) {
    const dataMatch = sel.match(/\[data-id="([^"]+)"\]/);
    if (!dataMatch) return [];
    const dataId = dataMatch[1];
    return this._walkAll((el) => el.dataset?.id === dataId);
  }
  _walkAll(fn, out = []) {
    if (fn(this)) out.push(this);
    for (const c of this.children) c._walkAll?.(fn, out);
    return out;
  }
  _walk(fn) {
    if (fn(this)) return this;
    for (const c of this.children) {
      const r = c._walk?.(fn) || (c.children && c.children.reduce((acc, ch) => acc || ch._walk?.(fn), null));
      if (r) return r;
    }
    return null;
  }
  getContext() { return createCtx2d(); }
}

const CTX2D = {
  setTransform() {},
  clearRect() {},
  save() {},
  restore() {},
  translate() {},
  scale() {},
  fillRect() {},
  strokeRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  arcTo() {},
  closePath() {},
  quadraticCurveTo() {},
  bezierCurveTo() {},
  fill() {},
  stroke() {},
  measureText: (t) => ({ width: (t || "").length * 7 }),
  setLineDash: () => {},
  fillText() {},
  strokeText() {},
  clip() {},
  createLinearGradient: () => ({ addColorStop() {} }),
};

function createCtx2d() {
  return new Proxy(CTX2D, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
  });
}

function setupDom() {
  if (!global.document) {
    global.document = {
      createElement: (tag) => {
        const el = new El(tag);
        if (tag === "canvas") {
          el.width = 800;
          el.height = 480;
          el.getContext = () => createCtx2d();
        }
        return el;
      },
    };
    global.window = { devicePixelRatio: 1 };
    global.performance = { now: () => Date.now() };
    let rafCount = 0;
    global.requestAnimationFrame = () => { rafCount++; return rafCount; };
    global.cancelAnimationFrame = () => {};
    global.ResizeObserver = class { observe() {} disconnect() {} };
  }
}

export async function mountTopicSim(topicId) {
  setupDom();
  const registryUrl = pathToFileURL(join(ROOT, "js", "sim", "lab", "registry.js")).href;
  const { createTopicSim } = await import(registryUrl);
  const stageEl = new El("div");
  const panelEl = new El("div");
  const stage = new Stage(stageEl);
  const handle = createTopicSim(topicId, stage, panelEl, stageEl);
  return { handle, stage, stageEl, panelEl, ctx: handle?.ctx };
}

export function tickSim(stage, ctx, seconds = 2) {
  const steps = Math.ceil(seconds / 0.05);
  for (let i = 0; i < steps; i++) {
    stage._tick?.(0.05);
  }
}

export function setToggle(ctx, key, value) {
  ctx.toggles[key] = value;
}

export function setParam(ctx, key, value) {
  ctx.params[key] = value;
  if (key === "cap" && ctx.state.tokens !== undefined) {
    ctx.state.tokens = Math.min(ctx.state.tokens, value);
  }
  if (key === "cap" && ctx.state.queueLevel !== undefined) {
    ctx.state.queueLevel = Math.min(ctx.state.queueLevel, value);
  }
}

export function setSelect(ctx, key, value) {
  ctx.selects[key] = value;
}

export function clickAction(ctx, actionId, actions) {
  const act = actions.find((a) => a.id === actionId);
  if (!act) throw new Error(`Action not found: ${actionId}`);
  act.onClick(ctx);
}

export function getStatusText(stageEl) {
  return walkTree(stageEl, () => true)
    .find((el) => el.className?.includes?.("sim-status"))?.textContent || "";
}

export function getStatusClass(stageEl) {
  const el = walkTree(stageEl, () => true).find((n) => n.className?.includes?.("sim-status"));
  const cls = el?.className || "";
  if (cls.includes("err")) return "err";
  if (cls.includes("ok")) return "ok";
  if (cls.includes("warn")) return "warn";
  return "";
}

export async function runBehaviorCase(topicId, spec) {
  const failures = [];
  const { handle, stage, stageEl, ctx } = await mountTopicSim(topicId);
  if (!ctx) {
    handle?.dispose?.();
    stage.dispose();
    return { passed: false, failures: [{ condition: "mount", expected: "ctx", actual: "null" }] };
  }

  try {
    for (const [k, v] of Object.entries(spec.setup?.toggles || {})) setToggle(ctx, k, v);
    for (const [k, v] of Object.entries(spec.setup?.params || {})) setParam(ctx, k, v);
    for (const [k, v] of Object.entries(spec.setup?.selects || {})) setSelect(ctx, k, v);

    if (spec.action) {
      const panelActions = findPanelActions(stageEl);
      const act = panelActions.find((a) => a.id === `lab-${spec.action}` || a.id === spec.action);
      if (act?._onClick) act._onClick(ctx);
      else {
        const registryUrl = pathToFileURL(join(ROOT, "js", "sim", "lab", "registry.js")).href;
        // fallback: invoke via config actions stored on ctx - use clickAction from mountLab panel
        const btn = stageEl.querySelector(`#lab-${spec.action}`);
        if (btn?._listeners?.click) btn._listeners.click.forEach((fn) => fn());
      }
    }

    if (spec.actions) {
      for (const actId of spec.actions) {
        const btn = findButton(panelEl, actId);
        if (btn?._listeners?.click) btn._listeners.click.forEach((fn) => fn());
      }
    }

    tickSim(stage, ctx, spec.tickSeconds ?? 3);

    const exp = spec.expect || {};
    if (exp.lastTarget !== undefined && ctx.state.lastTarget !== exp.lastTarget) {
      failures.push({ condition: "lastTarget", expected: exp.lastTarget, actual: ctx.state.lastTarget });
    }
    if (exp.state) {
      for (const [k, v] of Object.entries(exp.state)) {
        const actual = ctx.state[k];
        if (actual !== v) failures.push({ condition: `state.${k}`, expected: v, actual });
      }
    }
    if (exp.statusIncludes) {
      const text = getStatusText(stageEl);
      if (!text.includes(exp.statusIncludes)) {
        failures.push({ condition: "statusIncludes", expected: exp.statusIncludes, actual: text });
      }
    }
    if (exp.statusCls) {
      const cls = getStatusClass(stageEl);
      if (cls !== exp.statusCls) failures.push({ condition: "statusCls", expected: exp.statusCls, actual: cls });
    }
    if (exp.toggleAffectsState && exp.toggleKey) {
      failures.push({ condition: "cosmeticToggle", expected: "toggle changes state", actual: "not verified" });
    }
  } finally {
    handle?.dispose?.();
    stage.dispose();
  }

  return { passed: failures.length === 0, failures };
}

function findButton(el, actionId) {
  const id = actionId.startsWith("lab-") ? actionId : `lab-${actionId}`;
  return walkTree(el, (node) => node.id === id).find(Boolean) || null;
}

function walkTree(node, fn, out = []) {
  if (fn(node)) out.push(node);
  for (const c of node.children || []) walkTree(c, fn, out);
  return out;
}

function findPanelActions(el) { return []; }
