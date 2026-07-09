/**
 * Move backend topic files per scripts/topic-relocation.json
 * Run: node scripts/relocate-topics.mjs [--dry-run]
 */
import { readFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const mapPath = join(ROOT, "scripts/topic-relocation.json");

if (!existsSync(mapPath)) {
  console.error("Missing scripts/topic-relocation.json — run: node scripts/gen-relocation-json.mjs");
  process.exit(1);
}

const { topics, counts } = JSON.parse(readFileSync(mapPath, "utf8"));
let moved = 0;
let skipped = 0;
const errors = [];

for (const [id, entry] of Object.entries(topics)) {
  const src = join(ROOT, entry.oldPath);
  const dest = join(ROOT, entry.newPath);

  if (!existsSync(src)) {
    if (existsSync(dest)) {
      skipped++;
      continue;
    }
    errors.push(`MISSING source for ${id}: ${entry.oldPath}`);
    continue;
  }

  if (existsSync(dest) && src !== dest) {
    errors.push(`DEST exists for ${id}: ${entry.newPath}`);
    continue;
  }

  mkdirSync(dirname(dest), { recursive: true });

  if (DRY) {
    console.log(`[dry-run] ${entry.oldPath} → ${entry.newPath}`);
  } else {
    renameSync(src, dest);
    console.log(`Moved ${id}: ${entry.oldPath} → ${entry.newPath}`);
  }
  moved++;
}

console.log(`\n${DRY ? "Would move" : "Moved"}: ${moved}, skipped (already at dest): ${skipped}`);
console.log(`Expected counts: failures ${counts.failures}, hld ${counts.hld}, lld ${counts.lld}`);

if (errors.length) {
  console.error("\nErrors:");
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}
