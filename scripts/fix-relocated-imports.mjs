/**
 * Fix relative sim/ imports after topic relocation (extra directory level).
 * Run: node scripts/fix-relocated-imports.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { topics } = JSON.parse(readFileSync(join(ROOT, "scripts/topic-relocation.json"), "utf8"));

const REPLACEMENTS = [
  [/from "\.\.\/\.\.\/sim\//g, 'from "../../../sim/'],
  [/from '\.\.\/\.\.\/sim\//g, "from '../../../sim/"],
];

let fixed = 0;

for (const entry of Object.values(topics)) {
  const path = join(ROOT, entry.newPath);
  let src = readFileSync(path, "utf8");
  let changed = false;
  for (const [re, rep] of REPLACEMENTS) {
    if (re.test(src)) {
      src = src.replace(re, rep);
      changed = true;
    }
    re.lastIndex = 0;
  }
  if (changed) {
    writeFileSync(path, src);
    fixed++;
  }
}

console.log(`Fixed sim imports in ${fixed} topic files`);
