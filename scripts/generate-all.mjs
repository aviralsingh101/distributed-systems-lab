/**
 * Generates topic modules, registry-hld.js, registry-lld.js from topic-manifest.js
 * Run: node scripts/generate-all.mjs
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { HLD_CATEGORIES, LLD_CATEGORIES } from "./topic-manifest.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function defaultTradeoffs(title) {
  return {
    pros: [
      `Addresses a real gap that naive designs miss with <b>${title}</b>.`,
      "Fits the payment-platform example: clearer boundaries between Wallet, Order, Gateway, and Ledger.",
      "Scales or simplifies operations as traffic and team size grow.",
    ],
    cons: [
      "Adds moving parts — more components to deploy, monitor, and reason about.",
      "Often trades strong consistency or simplicity for availability or throughput.",
      "Wrong context or half-applied pattern can be worse than a simpler design.",
    ],
    whenToUse: [
      "The requirement clearly matches the problem this pattern was invented for.",
      "You have observability and runbooks to operate it in production.",
      "Simpler alternatives (single DB, sync calls) are exhausted or failing SLOs.",
    ],
    whenNotToUse: [
      "Early MVP with low traffic — YAGNI applies.",
      "Team lacks experience operating the pattern (outbox without idempotent consumers, etc.).",
      "Requirements demand strong synchronous consistency end-to-end.",
    ],
  };
}

function defaultContent(t, track) {
  const tradeoffs = defaultTradeoffs(t.title);
  return {
    oneliner: t.blurb,
    problem: `<p>Without <b>${t.title}</b>, the payment platform hits limits: duplicated charges, stale balances, coupling, or scale walls. Teams feel the pain in incidents and rising latency.</p>`,
    solution: `<p><b>${t.title}</b> gives a proven structure for the Wallet → Order → Gateway → Ledger flow. Apply it deliberately: define boundaries, data ownership, and failure modes before writing code.</p>`,
    tradeoffs,
    after: `<p>With ${t.title} in place, the system behaves predictably under retries, skewed load, and partial outages — at the cost of the tradeoffs above.</p>`,
    example: `<p>In our payment system: a client pays via Order Service, Gateway settles, Ledger records, and the Event Queue notifies downstream. ${t.title} shows where this pattern sits and what breaks if you skip it.</p>`,
    related: t.related || [],
  };
}

function simForTemplate(template, t) {
  const note = `Explore ${t.title} in the payment platform.`;
  switch (template) {
    case "flow":
      return `{
    note: \`${esc(note)}\`,
    toggles: [{ key: "fix", label: "Apply ${esc(t.title)}", kind: "ok", value: false }],
    scenario(ctx) {
      const fix = ctx.toggles.fix;
      const actors = [
        { id: "client", label: "Client", color: C.client },
        { id: "order", label: "Order Service", color: C.service },
        { id: "ledger", label: "Ledger", color: C.ledger, kind: "db", value: "balance" },
        { id: "queue", label: "Event Queue", color: C.queue },
      ];
      const steps = fix ? [
        { from: "client", to: "order", label: "pay", good: true },
        { from: "order", to: "ledger", label: "${esc(t.title)} ✓", good: true, set: { ledger: "committed" } },
        { from: "ledger", to: "queue", label: "event", good: true },
      ] : [
        { from: "client", to: "order", label: "pay" },
        { from: "order", to: "ledger", label: "naive write", bad: true, set: { ledger: "risk" } },
        { from: "order", to: "queue", label: "dual write?", dashed: true, bad: true },
      ];
      return {
        actors, steps, stepDur: 1.2,
        status: (r) => !r.done ? { text: "processing…", cls: "" }
          : fix ? { text: "${esc(t.title)} applied", cls: "ok" } : { text: "pattern missing", cls: "err" },
      };
    },
  }`;
    case "tradeoff":
      return `{
    note: \`${esc(note)}\`,
    toggleLabel: "Switch approach",
    labelA: "Without pattern",
    labelB: "With ${esc(t.title)}",
    sideA: () => ({ nodes: [
      { title: "Monolith path", active: true },
      { title: "Tight coupling", value: "risk" },
      { title: "Scale wall", value: "soon" },
    ]}),
    sideB: () => ({ nodes: [
      { title: "Clear boundary", active: true },
      { title: "${esc(t.title)}", value: "applied" },
      { title: "Independent scale", value: "ok" },
    ]}),
    status: (ctx, t, useB) => ({ text: useB ? "${esc(t.title)} — better fit" : "naive — hits limits", cls: useB ? "ok" : "warn" }),
  }`;
    case "pipeline":
      return `{
    note: \`${esc(note)}\`,
    toggles: [{ key: "fix", label: "Enable ${esc(t.title)}", kind: "ok", value: false }],
    stages: (ctx) => [
      { title: "Client", color: C.client },
      { title: "Order", color: C.service },
      { title: "${esc(t.title)}", color: ctx.toggles.fix ? C.ok : C.warn },
      { title: "Ledger", color: C.ledger },
      { title: "Queue", color: C.queue },
    ],
    activeIndex: (ctx, t) => ctx.toggles.fix ? Math.min(4, Math.floor(t * 0.6) % 5) : Math.min(2, Math.floor(t * 0.6) % 3),
    status: (ctx) => ({ text: ctx.toggles.fix ? "pipeline complete" : "bottleneck mid-pipeline", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }`;
    case "layer":
      return `{
    note: \`${esc(note)}\`,
    toggles: [{ key: "fix", label: "Apply layering", kind: "ok", value: false }],
    layers: (ctx) => [
      { name: "API", components: [{ title: "REST/gRPC", active: true }] },
      { name: "Domain", components: [{ title: "${esc(t.title)}", active: ctx.toggles.fix, color: C.accent }] },
      { name: "Data", components: [{ title: "Ledger", color: C.ledger }, { title: "Queue", color: C.queue }] },
    ],
    status: (ctx) => ({ text: ctx.toggles.fix ? "clean separation" : "logic leaks across layers", cls: ctx.toggles.fix ? "ok" : "err" }),
  }`;
    case "dataModel":
      return `{
    note: \`${esc(note)} — schema view\`,
    toggles: [{ key: "fix", label: "Normalized design", kind: "ok", value: false }],
    tables: (ctx) => ctx.toggles.fix ? [
      { name: "payments", cols: [{ name: "id", pk: true }, { name: "wallet_id", fk: true }, { name: "amount" }] },
      { name: "wallets", cols: [{ name: "id", pk: true }, { name: "balance" }] },
      { name: "outbox", cols: [{ name: "id", pk: true }, { name: "event", fk: true }] },
    ] : [
      { name: "everything", cols: [{ name: "blob", pk: true }, { name: "misc" }] },
    ],
    relations: [{ from: "payments", to: "wallets" }],
    status: (ctx) => ({ text: ctx.toggles.fix ? "schema supports ${esc(t.title)}" : "schema fights the pattern", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }`;
    case "stateMachine":
      return `{
    note: \`${esc(note)}\`,
    toggles: [{ key: "fix", label: "Valid transitions only", kind: "ok", value: false }],
    states: (ctx) => [
      { id: "pending", label: "Pending", x: 200, y: 280, color: C.service },
      { id: "active", label: "${esc(t.title)}", x: 500, y: 280, color: C.accent, good: true },
      { id: "done", label: "Settled", x: 800, y: 280, color: C.ok, good: true },
      { id: "bad", label: "Invalid", x: 500, y: 420, color: C.err, bad: true },
    ],
    currentState: (ctx, t) => {
      if (!ctx.toggles.fix && (t % 6) > 4) return "bad";
      return ["pending", "active", "done"][Math.floor((t * 0.35) % 3)];
    },
    transitions: [{ from: "pending", to: "active", label: "apply" }, { from: "active", to: "done", label: "commit" }],
    status: (ctx) => ({ text: ctx.toggles.fix ? "state machine guards flow" : "illegal states possible", cls: ctx.toggles.fix ? "ok" : "err" }),
  }`;
    default: // topology
      return `{
    note: \`${esc(note)}\`,
    toggles: [{ key: "fix", label: "Apply ${esc(t.title)}", kind: "ok", value: false }],
    nodes: (ctx) => [
      { id: "c", x: 160, y: 280, title: "Client", color: C.client },
      { id: "o", x: 400, y: 200, title: "Order", color: C.service, active: true },
      { id: "g", x: 640, y: 280, title: "Gateway", color: C.gateway },
      { id: "l", x: 500, y: 400, title: "Ledger", color: C.ledger, value: ctx.toggles.fix ? "ok" : "?" },
      { id: "q", x: 840, y: 200, title: "Queue", color: C.queue },
    ],
    edges: (ctx) => [
      { from: "c", to: "o", active: true },
      { from: "o", to: "g", active: ctx.toggles.fix },
      { from: "g", to: "l", active: ctx.toggles.fix },
      { from: "l", to: "q", active: ctx.toggles.fix, label: "${esc(t.title)}" },
    ],
    activeEdge: (ctx, t) => ctx.toggles.fix ? { from: "l", to: "q" } : { from: "c", to: "o" },
    status: (ctx) => ({ text: ctx.toggles.fix ? "${esc(t.title)} in path" : "pattern absent", cls: ctx.toggles.fix ? "ok" : "warn" }),
  }`;
  }
}

function generateTopicFile(track, catId, t) {
  const existingPath = join(ROOT, "js/topics", track === "backend" ? catId : `${track}/${catId}`, `${t.id}.js`);
  if (existsSync(existingPath)) {
    const raw = readFileSync(existingPath, "utf8");
    if (raw.includes("@content-enriched") || raw.includes("@article-v2")) {
      return null; // skip — do not overwrite enriched content
    }
  }

  const c = defaultContent(t, track);
  const tr = c.tradeoffs;
  const simBody = simForTemplate(t.template, t);
  const related = (t.related || []).map((r) => `"${r}"`).join(", ");

  return `import { makeTopic } from "../../_shared/topicFactory.js";
import { C } from "../../../sim/primitives.js";
import { ${t.template === "flow" ? "flowTemplate" : t.template + "Template"} } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "${t.id}",
  title: "${esc(t.title)}",
  category: "${catId}",
  track: "${track}",
  tier: "${t.tier || "essential"}",
  oneliner: \`${esc(c.oneliner)}\`,
  plainEnglish: \`<p><em>Content in progress.</em></p>\`,
  technical: \`<p><em>Content in progress.</em></p>\`,
  problem: \`${esc(c.problem)}\`,
  solution: \`${esc(c.solution)}\`,
  tradeoffs: {
    pros: ${JSON.stringify(tr.pros)},
    cons: ${JSON.stringify(tr.cons)},
    whenToUse: ${JSON.stringify(tr.whenToUse)},
    whenNotToUse: ${JSON.stringify(tr.whenNotToUse)},
  },
  after: \`${esc(c.after)}\`,
  example: \`${esc(c.example)}\`,
  related: [${related}],
  template: "${t.template}",
  sim: () => (${simBody}),
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return topic.createSimulation(stage, panel, stageEl);
}
`;
}

function writeRegistry(track, categories, exportName) {
  const enriched = categories.map((cat) => ({
    ...cat,
    track,
    topics: cat.topics.map((t) => ({
      id: t.id,
      title: t.title,
      blurb: t.blurb,
      tier: t.tier || "essential",
      related: t.related || [],
    })),
  }));

  const body = `/**
 * ${track.toUpperCase()} track categories — auto-generated from topic-manifest.js
 */
export const ${exportName} = ${JSON.stringify(enriched, null, 2)};
`;
  writeFileSync(join(ROOT, `js/registry-${track}.js`), body);
}

let hldCount = 0, lldCount = 0;

for (const cat of HLD_CATEGORIES) {
  const dir = join(ROOT, "js/topics/hld", cat.id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const t of cat.topics) {
    const content = generateTopicFile("hld", cat.id, t);
    if (content) writeFileSync(join(dir, `${t.id}.js`), content);
    hldCount++;
  }
}

for (const cat of LLD_CATEGORIES) {
  const dir = join(ROOT, "js/topics/lld", cat.id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const t of cat.topics) {
    const content = generateTopicFile("lld", cat.id, t);
    if (content) writeFileSync(join(dir, `${t.id}.js`), content);
    lldCount++;
  }
}

writeRegistry("hld", HLD_CATEGORIES, "HLD_CATEGORIES");
writeRegistry("lld", LLD_CATEGORIES, "LLD_CATEGORIES");

console.log(`Generated ${hldCount} HLD + ${lldCount} LLD topic modules`);
