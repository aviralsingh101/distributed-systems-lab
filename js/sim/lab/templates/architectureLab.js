/**
 * Architecture lab — click to trace request paths through system components.
 */
import { mountLab } from "../mountLab.js";
import { C, clamp } from "../../primitives.js";

function resolveHops(pathCfg, ctx) {
  if (typeof pathCfg.getHops === "function") return pathCfg.getHops(ctx);
  if (typeof pathCfg.hops === "function") return pathCfg.hops(ctx);
  return pathCfg.hops || [];
}

function resolveNodes(cfg, ctx) {
  const nodes = cfg.nodes;
  if (typeof nodes === "function") return nodes(ctx);
  return nodes || [];
}

function isNodeDown(node, ctx) {
  if (typeof node.down === "function") return node.down(ctx);
  return !!node.down;
}

export function architectureLab(stage, panel, stageEl, cfg) {
  const paths = cfg.paths || {};

  return mountLab(stage, panel, stageEl, {
    note: cfg.note,
    toggles: cfg.toggles || [],
    params: cfg.params || [],
    init(ctx) {
      ctx.state.activePath = null;
      ctx.state.pathIdx = 0;
      ctx.state.animP = 0;
      ctx.state.highlight = new Set();
      ctx.state.lastTarget = null;
      if (cfg.init) cfg.init(ctx);
    },
    actions: Object.entries(paths).map(([key, p]) => ({
      id: key,
      label: p.label,
      primary: p.primary,
      onClick(ctx) {
        const hops = resolveHops(p, ctx);
        ctx.state.activePath = hops;
        ctx.state.pathIdx = 0;
        ctx.state.animP = 0;
        ctx.state.highlight = new Set();
        ctx.state.lastTarget = hops.length ? hops[hops.length - 1].to : null;
        if (p.onClick) p.onClick(ctx);
      },
    })),
    frame(ctx, t, dt) {
      const d = ctx.d;
      d.grid();
      const nodes = resolveNodes(cfg, ctx);

      if (ctx.state.activePath && dt > 0) {
        ctx.state.animP += dt * 1.5;
        if (ctx.state.animP >= 1) {
          ctx.state.animP = 0;
          const hop = ctx.state.activePath[ctx.state.pathIdx];
          if (hop) ctx.state.highlight.add(hop.to);
          ctx.state.pathIdx++;
          if (ctx.state.pathIdx >= ctx.state.activePath.length) ctx.state.activePath = null;
        }
      }

      nodes.forEach((n) => {
        const down = isNodeDown(n, ctx);
        const w = n.w || 130;
        const h = n.h || 56;
        d.component(n.x, n.y, w, h, {
          title: n.title + (down ? " ✗" : ""),
          color: down ? C.err : (n.color || C.service),
          active: ctx.state.highlight.has(n.id),
          value: n.value || "",
          kind: n.kind,
          state: down ? "dim" : "",
        });
      });

      if (ctx.state.activePath && ctx.state.pathIdx < ctx.state.activePath.length) {
        const hop = ctx.state.activePath[ctx.state.pathIdx];
        const a = nodes.find((n) => n.id === hop.from);
        const b = nodes.find((n) => n.id === hop.to);
        if (a && b) {
          const stale = hop.stale || (isNodeDown(b, ctx) && ctx.toggles?.cached);
          const aw = a.w || 130;
          const bw = b.w || 130;
          const ah = a.h || 56;
          const pos = d.along(a.x + aw / 2, a.y + ah / 2, b.x + bw / 2, b.y + ah / 2, ctx.state.animP);
          d.token(pos.x, pos.y, {
            r: 9,
            color: stale ? C.err : C.accent,
            glow: true,
            label: hop.label,
          });
        }
      }

      if (cfg.draw) cfg.draw(ctx, d, t);
    },
    status: cfg.status || (() => ({ text: "Click a path to trace the request", cls: "" })),
  });
}
