/**
 * Headless simulation mount verification for all topics.
 * Run: node scripts/verify-sims.mjs
 */
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { Stage } from "../js/sim/engine.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  }
  appendChild(c) { this.children.push(c); return c; }
  append(...nodes) { nodes.forEach((n) => this.appendChild(n)); return nodes[0]; }
  remove() {}
  removeChild(c) { this.children = this.children.filter((x) => x !== c); }
  addEventListener(ev, fn) { (this._listeners[ev] ||= []).push(fn); }
  setAttribute() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
}

global.document = {
  createElement: (tag) => {
    const el = new El(tag);
    if (tag === "canvas") {
      el.width = 800;
      el.height = 480;
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

let errors = 0;
const failures = [];

for (const entry of FLAT_TOPICS) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) {
    failures.push({ id: entry.id, err: "missing file" });
    errors++;
    continue;
  }

  try {
    rafCount = 0;
    const modUrl = pathToFileURL(path).href + `?v=${entry.id}`;
    const mod = await import(modUrl);

    if (!mod.createSimulation) {
      failures.push({ id: entry.id, err: "no createSimulation" });
      errors++;
      continue;
    }

    const stageEl = new El("div");
    const panelEl = new El("div");
    const stage = new Stage(stageEl);
    const handle = mod.createSimulation(stage, panelEl, stageEl);

    if (handle?.dispose) handle.dispose();
    stage.dispose();
  } catch (e) {
    failures.push({ id: entry.id, err: e.message?.slice(0, 120) });
    errors++;
  }
}

if (failures.length) {
  console.error(`${failures.length} sim failure(s):`);
  failures.slice(0, 30).forEach((f) => console.error(`  ${f.id}: ${f.err}`));
  process.exit(1);
}

console.log(`All ${FLAT_TOPICS.length} simulations mounted successfully.`);
