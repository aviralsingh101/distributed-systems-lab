/**
 * Detect boilerplate and validate article-v2 content quality.
 * Does NOT generate content — only checks.
 */
import { isShallowHldContent } from "./hld-article-writer.mjs";

export const FORBIDDEN_PHRASES = [
  "How to read this page",
  "Category context (",
  "We use the payment cast throughout",
  "When reviewing a design doc or PR, ask: where does",
  "Implementation checklist: (1) define ownership",
  "Outcomes:</b> After this page you should explain",
  "Prerequisites:</b> You should be comfortable reading sequence diagrams",
  "payment platform hits limits",
  "gives a proven structure for the Wallet",
  "Correlate logs with payment_id",
  "In the payment platform topology",
];

/** Generic HLD production checklist opener */
export const GENERIC_HLD_CHECKLIST_MARKERS = [
  "Before shipping",
  "Load-test with parallel requests on the same wallet or hot key",
  "Write a runbook entry with rollback steps",
];

export function hasGenericHldChecklist(raw) {
  const titles = [...raw.matchAll(/title:\s*[`'"]Production checklist[`'"]/g)];
  if (titles.length === 0) return false;
  return GENERIC_HLD_CHECKLIST_MARKERS.filter((m) => raw.includes(m)).length >= 2;
}

export function hasDuplicateChecklistSections(raw) {
  const matches = [...raw.matchAll(/title:\s*[`'"]Production checklist[`'"]/g)];
  return matches.length > 1;
}

/** Generic nginx/Postgres/broker paragraphs on concept topics */
export const GENERIC_STACK_MARKERS = [
  "nginx/Envoy <code>upstream</code>",
  "EXPLAIN ANALYZE",
  "broker lag vs publish throughput",
];

export function wordCount(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

export function hasForbidden(raw) {
  return FORBIDDEN_PHRASES.some((p) => raw.includes(p));
}

export function hasGenericStackBoilerplate(raw, archetype) {
  if (archetype !== "concept") return false;
  const hits = GENERIC_STACK_MARKERS.filter((m) => raw.includes(m));
  return hits.length >= 2;
}

export function isArticleV2(raw) {
  return raw.includes("@article-v2");
}

export function hasSections(raw) {
  return /sections:\s*\[/.test(raw);
}

export function sectionWordCount(raw) {
  const bodies = [...raw.matchAll(/body:\s*`([^`]*(?:\\.[^`]*)*)`/gs)];
  return bodies.reduce((n, m) => n + wordCount(m[1].replace(/\\`/g, "`")), 0);
}

/** Archetype-appropriate checks for @article-v2 topics */
export function archetypeIssues(raw, archetype, track = "", catId = "") {
  const issues = [];
  const text = raw.replace(/<[^>]+>/g, " ");

  if (raw.includes("@hld-gold")) return issues;

  if (archetype === "concept" && !catId.startsWith("hld-foundations")) {
    if (!/how it works|how a |lookup|works by|resolves|protocol/i.test(text)) {
      issues.push("concept: missing how-it-works explanation");
    }
  }
  if (archetype === "failure") {
    if (!/symptom|root cause|what goes wrong|what happens/i.test(text)) {
      issues.push("failure: missing symptom description");
    }
    if (!/fix|prevent|mitigat|solution|remedy/i.test(text)) {
      issues.push("failure: missing fix/prevention");
    }
  }
  if (archetype === "pattern") {
    if (!/structure|step|flow|implement/i.test(text)) {
      issues.push("pattern: missing structure/flow");
    }
  }
  if (archetype === "classic") {
    if (!/requirements|functional/i.test(text)) {
      issues.push("classic: missing requirements section");
    }
    if (!/high-level design|high level design|components:/i.test(text)) {
      issues.push("classic: missing high-level design");
    }
  }
  if (track === "hld" && !raw.includes("@hld-gold")) {
    if (isShallowHldContent(raw)) {
      issues.push("hld: shallow template content (needs hand-authored depth)");
    }
    if (!/pitfall|interview|interviewer|incident pattern|failure behavior|common mistake/i.test(text)) {
      issues.push("hld: missing pitfalls/interview section");
    }
    if (!/design decision|tradeoff|why this|when it wins|hld placement|key design|evolution path/i.test(text)) {
      issues.push("hld: missing design decision framing");
    }
    if (hasGenericHldChecklist(raw)) {
      issues.push("hld: generic production checklist");
    }
    if (hasDuplicateChecklistSections(raw)) {
      issues.push("hld: duplicate production checklist sections");
    }
  }
  if (hasGenericStackBoilerplate(raw, archetype)) {
    issues.push("concept: generic nginx/postgres/broker boilerplate");
  }
  return issues;
}

export function validateArticleV2(raw, track = "", catId = "") {
  const issues = [];
  if (!hasSections(raw)) issues.push("missing sections[]");
  if (hasForbidden(raw)) issues.push("forbidden boilerplate");

  const archetypeMatch = raw.match(/archetype:\s*["'](\w+)["']/);
  const archetype = archetypeMatch?.[1] || "concept";

  const totalWords = sectionWordCount(raw);
  const minWords = raw.includes("@hld-gold") ? 280 : track === "hld" ? 400 : 280;
  if (totalWords < minWords) issues.push(`sections too short (${totalWords} < ${minWords} words)`);

  issues.push(...archetypeIssues(raw, archetype, track, catId));
  return issues;
}
