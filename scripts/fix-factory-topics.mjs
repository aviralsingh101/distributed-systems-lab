/**
 * Repair factory topic files broken by partial sim removal.
 * Run: node scripts/fix-factory-topics.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function repair(raw) {
  let updated = raw;
  updated = updated.replace(/\n  template: "(?:layer|tradeoff|flow|topology|pipeline|stateMachine|dataModel)",[\s\S]*?\n  \}\),\n/g, "\n");
  updated = updated.replace(/\n  template: "(?:layer|tradeoff|flow|topology|pipeline|stateMachine|dataModel)",\n  \}\),\n/g, "\n");
  updated = updated.replace(/\nimport \{ C \} from "[^"]+primitives\.js";\nimport \{ (?:layer|tradeoff)Template \} from "[^"]+templates\/index\.js";\n/g, "\n");
  updated = updated.replace(/\nimport \{ C \} from "[^"]+primitives\.js";\n/g, "\n");
  updated = updated.replace(/\nimport \{ (?:layer|tradeoff)Template \} from "[^"]+templates\/index\.js";\n/g, "\n");
  return updated;
}

let fixed = 0;
for (const entry of FLAT_TOPICS) {
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) continue;
  const raw = readFileSync(path, "utf8");
  if (!raw.includes("makeTopic(")) continue;
  const next = repair(raw);
  if (next !== raw) {
    writeFileSync(path, next, "utf8");
    fixed++;
    console.log("FIX:", entry.id);
  }
}
console.log(`Repaired ${fixed} factory topics`);
