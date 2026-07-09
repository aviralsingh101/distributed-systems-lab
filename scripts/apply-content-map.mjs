/**
 * Apply content-map.json to topic files — sim + figure alignment.
 * Run: node scripts/apply-content-map.mjs [--wave failures|hld|lld|strip|figures|all]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";
import { buildFigure } from "./lib/figure-templates.mjs";
import { buildUmlFigure, buildErFigure } from "./lib/uml-templates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "scripts", "content-map.json");

function depthToRegistry(modulePath) {
  const parts = modulePath.replace(/^\.\//, "").split("/");
  return "../".repeat(parts.length - 1) + "sim/lab/registry.js";
}

function escBacktick(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function formatFiguresJs(figures) {
  const items = figures.map((f) => {
    const svg = escBacktick(f.svg.replace(/\s+/g, " ").trim());
    const cap = escBacktick(f.caption);
    return `    { id: "${f.id}", svg: \`${svg}\`, caption: \`${cap}\` }`;
  });
  return `  figures: [\n${items.join(",\n")},\n  ],`;
}

function buildFigureForEntry(entry, mapEntry) {
  const figType = mapEntry.figure;
  if (figType === "umlClass") return buildUmlFigure(entry.id, entry.title);
  if (figType === "er") return buildErFigure(entry.id, entry.title);
  return buildFigure(figType, entry.id, entry.title, mapEntry.figureOpts || {});
}

function removeFigures(raw) {
  if (!raw.includes("figures:")) return raw;
  return raw.replace(/\n  figures:\s*\[[\s\S]*?\],\n/, "\n");
}

function injectFigures(raw, figuresJs) {
  if (raw.includes("@figure-handcrafted") && raw.includes("figures:")) return raw;
  if (raw.includes("figures:")) {
    return raw.replace(/  figures:\s*\[[\s\S]*?\],/, figuresJs);
  }
  const secEnd = raw.search(/\n  related:/);
  if (secEnd >= 0) return raw.slice(0, secEnd) + "\n" + figuresJs + raw.slice(secEnd);
  return raw;
}

function removeLegacySimBlock(raw) {
  let updated = raw.replace(/\n  sim:\s*\(\)\s*=>\s*\(\{[\s\S]*?\}\),/g, "");
  updated = updated.replace(/\n  template: "(?:layer|tradeoff|flow|topology|pipeline|stateMachine|dataModel)",[\s\S]*?\n  \}\),\n/g, "\n");
  updated = updated.replace(/\n  template: "(?:layer|tradeoff|flow|topology|pipeline|stateMachine|dataModel)",\n/g, "\n");
  return updated;
}

function removeFactorySimExport(raw) {
  if (!raw.includes("makeTopic(")) return raw;
  return raw.replace(/\nexport const meta = topic\.meta;\nexport const content = topic\.content;\nexport function createSimulation[\s\S]*$/, "\nexport const meta = topic.meta;\nexport const content = topic.content;\n");
}

function removeSimExport(raw) {
  let updated = raw;
  updated = updated.replace(/\nimport \{ createTopicSim \} from "[^"]+registry\.js";\n/g, "\n");
  updated = updated.replace(/^\/\/ @sim-lab\n/m, "");
  updated = updated.replace(/\nexport function createSimulation\([^)]*\)\s*\{[\s\S]*?\n\}/, "");
  updated = updated.replace(/\nimport \{ mountSimulation \} from "[^"]+controls\.js";\n/g, "\n");
  return updated;
}

function addSimExport(raw, topicId, registryImport) {
  if (raw.includes("@sim-handcrafted") || raw.includes("@sim-gold")) return raw;
  let updated = removeSimExport(raw);
  const importLine = `import { createTopicSim } from "${registryImport}";`;
  if (!updated.includes("createTopicSim")) {
    const firstImport = updated.match(/^import .+$/m);
    if (firstImport) {
      updated = updated.replace(firstImport[0], firstImport[0] + "\n" + importLine);
    } else {
      updated = importLine + "\n" + updated;
    }
  }
  const newSim = `
export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("${topicId}", stage, panel, stageEl);
}`;
  if (updated.includes("export function createSimulation")) {
    updated = updated.replace(/export function createSimulation\([^)]*\)\s*\{[\s\S]*?\n\}/, newSim.trim());
  } else {
    updated = updated.trimEnd() + "\n" + newSim;
  }
  if (!updated.includes("@sim-lab")) {
    updated = updated.replace(/^(\/\/ @article-v2\n)?/, (m) => (m || "") + "// @sim-lab\n");
  }
  return updated;
}

function topicInWave(topic, wave) {
  if (!wave || wave === "all") return true;
  if (wave === "strip") return true;
  if (wave === "figures") return true;
  if (wave === "failures") return topic.track === "failures";
  if (wave === "hld") return topic.track === "hld";
  if (wave === "lld") return topic.track === "lld";
  return topic.category.id === wave;
}

function applyTopic(entry, mapEntry) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) return { status: "missing" };
  let raw = readFileSync(path, "utf8");
  const before = raw;

  raw = removeLegacySimBlock(raw);

  if (mapEntry.sim === "none") {
    raw = removeSimExport(raw);
    raw = removeFactorySimExport(raw);
  } else {
    const registryImport = depthToRegistry(entry.module.replace(/^\.\//, ""));
    raw = addSimExport(raw, entry.id, registryImport);
  }

  if (mapEntry.figure === "none") {
    if (!raw.includes("@figure-handcrafted")) raw = removeFigures(raw);
  } else if (!raw.includes("@figure-handcrafted")) {
    const fig = buildFigureForEntry(entry, mapEntry);
    raw = injectFigures(raw, formatFiguresJs([fig]));
  }

  if (raw === before) return { status: "unchanged" };
  writeFileSync(path, raw, "utf8");
  return { status: "updated" };
}

if (!existsSync(MAP_PATH)) {
  console.error("Run: node scripts/gen-content-map.mjs first");
  process.exit(1);
}

const contentMap = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const wave = process.argv.find((a) => a.startsWith("--wave="))?.split("=")[1] || "all";
const idFilter = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];

let updated = 0, skipped = 0;

for (const entry of FLAT_TOPICS) {
  if (idFilter && entry.id !== idFilter) continue;
  if (!topicInWave(entry, wave)) continue;
  const mapEntry = contentMap.topics[entry.id];
  if (!mapEntry) { skipped++; continue; }
  const result = applyTopic(entry, mapEntry);
  if (result.status === "updated") { updated++; console.log("OK:", entry.id); }
  else skipped++;
}

console.log(`Done: ${updated} updated, ${skipped} skipped`);
