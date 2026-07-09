/**
 * Detect boilerplate and validate article-v2 content quality.
 * Does NOT generate content — only checks.
 */

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
];

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
export function archetypeIssues(raw, archetype) {
  const issues = [];
  const text = raw.replace(/<[^>]+>/g, " ");

  if (archetype === "concept") {
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
  if (hasGenericStackBoilerplate(raw, archetype)) {
    issues.push("concept: generic nginx/postgres/broker boilerplate");
  }
  return issues;
}

export function validateArticleV2(raw) {
  const issues = [];
  if (!hasSections(raw)) issues.push("missing sections[]");
  if (hasForbidden(raw)) issues.push("forbidden boilerplate");

  const archetypeMatch = raw.match(/archetype:\s*["'](\w+)["']/);
  const archetype = archetypeMatch?.[1] || "concept";

  const totalWords = sectionWordCount(raw);
  if (totalWords < 280) issues.push(`sections too short (${totalWords} < 280 words)`);

  issues.push(...archetypeIssues(raw, archetype));
  return issues;
}
