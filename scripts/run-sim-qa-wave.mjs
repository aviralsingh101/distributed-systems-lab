/**
 * Print topic IDs and subagent mandate for an interactive-lab QA wave.
 * Run: node scripts/run-sim-qa-wave.mjs --lab=architecture
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const interactive = JSON.parse(readFileSync(join(ROOT, "scripts", "interactive-topics.json"), "utf8"));
const simMap = JSON.parse(readFileSync(join(ROOT, "scripts", "sim-map.json"), "utf8")).topics;

const lab = process.argv.find((a) => a.startsWith("--lab="))?.split("=")[1];
if (!lab || !interactive[lab]) {
  console.error("Usage: node scripts/run-sim-qa-wave.mjs --lab=<architecture|clickFlow|metrics|race|queue|state|algorithm>");
  process.exit(1);
}

const MANDATE = `Mandate:
1. Read the article sections and understand what the interactive model should teach.
2. List every user control: action buttons, toggles, sliders, selects.
3. For EACH control combination, define expected behavior (path, values, status text, error state).
4. Reproduce current behavior using sim-behavior-driver or manual trace through onClick/frame logic.
5. Fix on the go:
   - Gold topics: edit handler in registry.js
   - Generic topics: replace build* stub with topic-specific config OR add gold handler
   - Do NOT leave toggles that only change status text without changing sim state/path
6. Add entry to scripts/sim-behavior-specs.json with test cases for all toggles/actions.
7. Run: node scripts/verify-sim-behavior.mjs --id=<topic-id>
8. Return: { topicId, controls, bugsFound, fixesMade, specAdded, pass: true/false }`;

const ids = interactive[lab];
console.log(`# Wave: ${lab} (${ids.length} topics)\n`);
for (const topicId of ids) {
  const title = simMap[topicId]?.title || topicId;
  console.log(`---\nTopic: ${topicId}\nLab type: ${lab}\nTitle: ${title}\nFiles to read first:
  - js/topics/**/${topicId}.js  (article + concept)
  - js/sim/lab/registry.js (gold handler or build* config)
  - js/sim/lab/topicConfigs.mjs / topicLabFactories.mjs
  - js/sim/lab/templates/${lab}Lab.js (or architectureLab.js, etc.)

${MANDATE}\n`);
}
