import {
  flowTemplate, topologyTemplate, pipelineTemplate, stateMachineTemplate,
  tradeoffTemplate, layerTemplate, dataModelTemplate,
} from "../../sim/templates/index.js";
import { C } from "../../sim/primitives.js";

const TEMPLATES = {
  flow: flowTemplate,
  topology: topologyTemplate,
  pipeline: pipelineTemplate,
  stateMachine: stateMachineTemplate,
  tradeoff: tradeoffTemplate,
  layer: layerTemplate,
  dataModel: dataModelTemplate,
};

function listHtml(items) {
  if (!items?.length) return "";
  return `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;
}

function tradeoffsHtml(t) {
  if (!t) return "";
  return `
    <div class="tradeoff-grid">
      <div class="tradeoff-col pros"><h4>Pros</h4>${listHtml(t.pros)}</div>
      <div class="tradeoff-col cons"><h4>Cons</h4>${listHtml(t.cons)}</div>
      <div class="tradeoff-col use"><h4>Use when</h4>${listHtml(t.whenToUse)}</div>
      <div class="tradeoff-col avoid"><h4>Avoid when</h4>${listHtml(t.whenNotToUse)}</div>
    </div>`;
}

/** Build standard topic exports from declarative config. */
export function makeTopic(cfg) {
  const meta = { id: cfg.id, title: cfg.title, category: cfg.category, track: cfg.track, tier: cfg.tier || "essential" };

  const content = {
    oneliner: cfg.oneliner,
    archetype: cfg.archetype,
    sections: cfg.sections,
    figures: cfg.figures,
    plainEnglish: cfg.plainEnglish,
    technical: cfg.technical,
    problem: cfg.problem,
    solution: cfg.solution,
    tradeoffs: cfg.tradeoffs,
    tradeoffsHtml: tradeoffsHtml(cfg.tradeoffs),
    after: cfg.after,
    example: cfg.example,
    related: cfg.related || [],
  };

  function createSimulation(stage, panel, stageEl) {
    const tmpl = TEMPLATES[cfg.template] || topologyTemplate;
    const simCfg = typeof cfg.sim === "function" ? cfg.sim : () => cfg.sim;
    return tmpl(stage, panel, stageEl, simCfg());
  }

  return { meta, content, createSimulation };
}

/** Default payment-platform flow for quick topic authoring. */
export function paymentFlow(cfg) {
  const fix = (ctx) => ctx.toggles?.fix;
  return {
    note: cfg.note,
    toggles: cfg.toggles || [{ key: "fix", label: cfg.fixLabel || "Apply pattern", kind: "ok", value: false }],
    params: cfg.params,
    scenario(ctx) {
      const actors = cfg.actors(ctx);
      const steps = fix(ctx) ? cfg.stepsFixed(ctx) : cfg.stepsBroken(ctx);
      return {
        actors, steps, stepDur: cfg.stepDur || 1.2,
        status: (r) => {
          if (!r.done) return { text: cfg.statusRunning || "in progress…", cls: "" };
          return fix(ctx)
            ? { text: cfg.statusOk || "pattern applied", cls: "ok" }
            : { text: cfg.statusBad || "without pattern", cls: "err" };
        },
      };
    },
  };
}

/** Standard actor presets for payment cast. */
export const actors = {
  client: (v) => ({ id: "client", label: "Client", color: C.client, value: v || "" }),
  wallet: (v) => ({ id: "wallet", label: "Wallet", color: C.wallet, value: v || "" }),
  order: (v) => ({ id: "order", label: "Order Service", color: C.service, value: v || "" }),
  gateway: (v) => ({ id: "gateway", label: "Payment Gateway", color: C.gateway, value: v || "" }),
  ledger: (v) => ({ id: "ledger", label: "Ledger", color: C.ledger, kind: "db", value: v || "" }),
  queue: (v) => ({ id: "queue", label: "Event Queue", color: C.queue, value: v || "" }),
};
