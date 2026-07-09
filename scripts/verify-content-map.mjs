/**
 * Verify topic files match content-map.json assignments.
 * Run: node scripts/verify-content-map.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FLAT_TOPICS } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_PATH = join(ROOT, "scripts", "content-map.json");

if (!existsSync(MAP_PATH)) {
  console.error("Missing content-map.json — run: node scripts/gen-content-map.mjs");
  process.exit(1);
}

const contentMap = JSON.parse(readFileSync(MAP_PATH, "utf8"));
let errors = 0;
const PAYMENT_PATH = /Client.*Order.*Gateway|HTTP Handler.*Ledger DB/i;
const UML_CATS = new Set(["lld-oop", "lld-creational", "lld-structural", "lld-behavioral"]);

for (const entry of FLAT_TOPICS) {
  const mapEntry = contentMap.topics[entry.id];
  if (!mapEntry) {
    console.error(`MISSING MAP ENTRY: ${entry.id}`);
    errors++;
    continue;
  }

  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  if (!existsSync(path)) continue;
  const raw = readFileSync(path, "utf8");

  const factoryHasSim = raw.includes("makeTopic(") && /\bsim:\s*\(/.test(raw);

  if (mapEntry.sim === "none") {
    if (raw.includes("export function createSimulation")) {
      console.error(`SHOULD NOT HAVE SIM: ${entry.id}`);
      errors++;
    }
    if (factoryHasSim) {
      console.error(`FACTORY STILL HAS sim: ${entry.id}`);
      errors++;
    }
  } else {
    if (!raw.includes("createSimulation") && !raw.includes("createTopicSim")) {
      console.error(`MISSING SIM: ${entry.id}`);
      errors++;
    }
  }

  if (mapEntry.figure === "none") {
    if (raw.includes("figures:") && !raw.includes("@figure-handcrafted")) {
      console.error(`SHOULD NOT HAVE FIGURES: ${entry.id}`);
      errors++;
    }
  } else if (!raw.includes("@figure-handcrafted")) {
    if (!raw.includes("figures:")) {
      console.error(`MISSING FIGURES: ${entry.id} (expected ${mapEntry.figure})`);
      errors++;
    }
    if (UML_CATS.has(entry.category.id) && mapEntry.figure === "umlClass") {
      if (raw.includes('id: "structure"') || PAYMENT_PATH.test(raw.match(/figures:\s*\[[\s\S]*?\]/)?.[0] || "")) {
        console.error(`WRONG FIGURE TYPE (need umlClass): ${entry.id}`);
        errors++;
      }
    }
    if (entry.category.id === "lld-db" && mapEntry.figure === "er") {
      if (!raw.includes("er-diagram") && !raw.includes("uml-class")) {
        // ER figures use id er-diagram
        if (!raw.includes('"er-diagram"') && !raw.includes("id: \"er")) {
          console.error(`WRONG FIGURE TYPE (need er): ${entry.id}`);
          errors++;
        }
      }
    }
    if (entry.category.id === "hld-tradeoffs" && mapEntry.figure === "comparison") {
      if (!raw.includes('"comparison"') && !raw.includes("id: \"comparison")) {
        console.error(`TRADEOFF NEEDS comparison: ${entry.id}`);
        errors++;
      }
    }
  }

  if (mapEntry.sim === "none" && PAYMENT_PATH.test(raw.match(/createSimulation[\s\S]*$/)?.[0] || "")) {
    console.error(`GENERIC PAYMENT SIM: ${entry.id}`);
    errors++;
  }
}

const simCount = Object.values(contentMap.topics).filter((t) => t.sim !== "none").length;
const proseCount = Object.values(contentMap.topics).filter((t) => t.sim === "none" && t.figure === "none").length;

if (errors) {
  console.error(`\n${errors} content-map error(s) (${simCount} interactive, ${proseCount} prose-only)`);
  process.exit(1);
}
console.log(`Content-map verification passed: ${simCount} interactive, ${proseCount} prose-only, ${FLAT_TOPICS.length} topics`);
