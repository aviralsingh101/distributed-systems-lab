/**
 * Spot-check 15 topics across visualization modes.
 * Run: node scripts/spot-check-content.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getTopic } from "../js/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(readFileSync(join(ROOT, "scripts", "content-map.json"), "utf8")).topics;

const SPOTS = [
  "lost-update", "managed-vs-self-hosted", "dry-principle",
  "single-responsibility-principle", "er-modeling", "connection-pooling",
  "token-bucket", "dns", "polling-vs-websocket-family",
  "singleton", "saga-choreography", "thread-pool",
  "conways-law", "api-gateway", "read-your-writes",
];

let ok = 0;
for (const id of SPOTS) {
  const entry = getTopic(id);
  const map = MAP[id];
  const path = join(ROOT, "js", entry.module.replace(/^\.\//, ""));
  const raw = readFileSync(path, "utf8");
  const hasSim = raw.includes("export function createSimulation") || (raw.includes("createTopicSim") && map.sim !== "none");
  const hasFig = raw.includes("figures:") || raw.includes("@figure-handcrafted");
  const simOk = map.sim === "none" ? !raw.includes("export function createSimulation") : hasSim;
  const figOk = map.figure === "none" ? !hasFig || raw.includes("@figure-handcrafted") === false && !raw.includes("figures:") : hasFig || raw.includes("@figure-handcrafted");
  const pass = simOk && (map.figure === "none" ? !raw.includes("figures:") || raw.includes("@figure-handcrafted") : figOk);
  console.log(`${pass ? "OK" : "FAIL"} ${id}: sim=${map.sim} figure=${map.figure}`);
  if (pass) ok++;
}
console.log(`\n${ok}/${SPOTS.length} spot checks passed`);
if (ok !== SPOTS.length) process.exit(1);
