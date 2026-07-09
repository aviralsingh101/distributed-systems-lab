/**
 * UML / ER SVG builders for LLD static figures.
 */
const C = {
  panel: "#1a2236",
  ink: "#cdd6e8",
  muted: "#93a1bd",
  accent: "#5b9dff",
  ledger: "#3ddc97",
};

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function umlClassDiagram(topicId, classes) {
  const boxes = classes.map((cls, i) => {
    const x = 40 + (i % 2) * 220;
    const y = 40 + Math.floor(i / 2) * 130;
    const fields = (cls.fields || []).map((f) => `<text x="${x + 10}" y="${y + 52 + f.i * 14}" fill="${C.muted}" font-size="10" font-family="ui-monospace,monospace">${esc(f.text)}</text>`).join("");
    const methods = (cls.methods || []).map((m) => `<text x="${x + 10}" y="${y + 70 + m.i * 14}" fill="${C.ink}" font-size="10" font-family="ui-monospace,monospace">${esc(m.text)}</text>`).join("");
    return `<rect x="${x}" y="${y}" width="200" height="100" rx="6" fill="${C.panel}" stroke="${cls.stroke || C.accent}" stroke-width="1.5"/>
<text x="${x + 100}" y="${y + 22}" text-anchor="middle" fill="${C.ink}" font-size="12" font-weight="600" font-family="system-ui">${esc(cls.name)}</text>
<line x1="${x}" y1="${y + 32}" x2="${x + 200}" y2="${y + 32}" stroke="#26324a"/>
${fields}${methods}`;
  }).join("\n");
  return {
    id: "uml-class",
    svg: `<svg viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(topicId)} UML">${boxes}</svg>`,
    caption: `${topicId}: class structure and responsibilities.`,
  };
}

export function erDiagram(topicId, tables, relations = []) {
  const tableSvgs = tables.map((t, i) => {
    const x = 30 + i * 150;
    const rows = t.cols.map((c, j) => `<text x="${x + 8}" y="${58 + j * 14}" fill="${c.pk ? C.accent : C.muted}" font-size="10" font-family="ui-monospace,monospace">${c.pk ? "PK " : c.fk ? "FK " : "   "}${esc(c.name)}</text>`).join("");
    return `<rect x="${x}" y="30" width="130" height="${40 + t.cols.length * 14}" rx="6" fill="${C.panel}" stroke="${C.ledger}" stroke-width="1.5"/>
<text x="${x + 65}" y="48" text-anchor="middle" fill="${C.ink}" font-size="11" font-weight="600" font-family="system-ui">${esc(t.name)}</text>
${rows}`;
  }).join("\n");
  return {
    id: "er-diagram",
    svg: `<svg viewBox="0 0 ${Math.max(480, tables.length * 150 + 40)} 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(topicId)} ER">${tableSvgs}</svg>`,
    caption: `${topicId}: entity-relationship schema.`,
  };
}

export function solidPrincipleFigure(topicId, title) {
  return umlClassDiagram(topicId, [
    { name: "BadDesign", stroke: "#ff5c6c", fields: [{ text: "+ everything", i: 0 }], methods: [{ text: "+ doAll()", i: 0 }] },
    { name: "GoodDesign", stroke: "#3ddc97", fields: [{ text: "- focused state", i: 0 }], methods: [{ text: "+ oneJob()", i: 0 }] },
  ]);
}

const OOP_UML = {
  encapsulation: [
    { name: "Wallet", fields: [{ text: "- balance: int", i: 0 }], methods: [{ text: "+ credit(amount)", i: 0 }, { text: "+ getBalance()", i: 1 }] },
    { name: "Client", methods: [{ text: "+ pay()", i: 0 }] },
  ],
  abstraction: [
    { name: "PaymentGateway", stroke: "#7c5cff", methods: [{ text: "+ charge()", i: 0 }] },
    { name: "StripeAdapter", methods: [{ text: "+ charge()", i: 0 }] },
  ],
  polymorphism: [
    { name: "Notifier", stroke: "#7c5cff", methods: [{ text: "+ send()", i: 0 }] },
    { name: "EmailNotifier", methods: [{ text: "+ send()", i: 0 }] },
  ],
};

const GOF_UML = {
  singleton: [
    { name: "Config", fields: [{ text: "- instance: Config", i: 0 }], methods: [{ text: "+ getInstance()", i: 0 }] },
  ],
  "factory-method": [
    { name: "Creator", stroke: "#7c5cff", methods: [{ text: "+ create()", i: 0 }] },
    { name: "Product", methods: [{ text: "+ use()", i: 0 }] },
  ],
  adapter: [
    { name: "Target", stroke: "#7c5cff", methods: [{ text: "+ request()", i: 0 }] },
    { name: "Adapter", methods: [{ text: "+ request()", i: 0 }] },
  ],
  observer: [
    { name: "Subject", methods: [{ text: "+ attach()", i: 0 }, { text: "+ notify()", i: 1 }] },
    { name: "Observer", stroke: "#7c5cff", methods: [{ text: "+ update()", i: 0 }] },
  ],
  strategy: [
    { name: "Context", methods: [{ text: "+ execute()", i: 0 }] },
    { name: "Strategy", stroke: "#7c5cff", methods: [{ text: "+ algorithm()", i: 0 }] },
  ],
  state: [
    { name: "Order", methods: [{ text: "+ transition()", i: 0 }] },
    { name: "State", stroke: "#7c5cff", methods: [{ text: "+ handle()", i: 0 }] },
  ],
};

const ER_PRESETS = {
  "er-modeling": [
    { name: "Customer", cols: [{ name: "id", pk: true }, { name: "email" }] },
    { name: "Order", cols: [{ name: "id", pk: true }, { name: "customer_id", fk: true }, { name: "total" }] },
  ],
  "primary-foreign-keys": [
    { name: "users", cols: [{ name: "id", pk: true }] },
    { name: "orders", cols: [{ name: "id", pk: true }, { name: "user_id", fk: true }] },
  ],
  "multi-tenant-schema": [
    { name: "tenant", cols: [{ name: "id", pk: true }, { name: "name" }] },
    { name: "record", cols: [{ name: "id", pk: true }, { name: "tenant_id", fk: true }] },
  ],
};

const DEFAULT_ER = [
  { name: "Entity", cols: [{ name: "id", pk: true }, { name: "name" }] },
  { name: "Related", cols: [{ name: "id", pk: true }, { name: "entity_id", fk: true }] },
];

function titleCase(id) {
  return id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function buildUmlFigure(topicId, titleText) {
  if (topicId.includes("principle") || topicId === "dry-principle" || topicId === "kiss-yagni-principles") {
    const fig = solidPrincipleFigure(topicId, titleText);
    fig.caption = `${titleText}: refactor toward a single responsibility per class.`;
    return fig;
  }
  if (OOP_UML[topicId]) {
    const fig = umlClassDiagram(topicId, OOP_UML[topicId]);
    fig.caption = `${titleText}: class relationships illustrating the concept.`;
    return fig;
  }
  if (GOF_UML[topicId]) {
    const fig = umlClassDiagram(topicId, GOF_UML[topicId]);
    fig.caption = `${titleText}: pattern structure with collaborating classes.`;
    return fig;
  }
  const name = titleCase(topicId.replace(/-pattern$/, ""));
  return umlClassDiagram(topicId, [
    { name: "Client", methods: [{ text: "+ use()", i: 0 }] },
    { name: name, stroke: "#7c5cff", methods: [{ text: "+ operation()", i: 0 }] },
  ]);
}

export function buildErFigure(topicId, titleText) {
  const tables = ER_PRESETS[topicId] || DEFAULT_ER.map((t) => ({
    ...t,
    name: topicId === "er-modeling" ? t.name : titleCase(topicId).slice(0, 12),
  }));
  const fig = erDiagram(topicId, tables);
  fig.caption = `${titleText}: tables, keys, and relationships.`;
  return fig;
}
