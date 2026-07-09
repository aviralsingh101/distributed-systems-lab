# Content Template — Educator-Style Topic Enrichment

This document defines the content schema and quality bar for all 366 topics (Backend, HLD, LLD).

## Target reader

Software engineer with solid fundamentals (HTTP, DB, concurrency, queues). **Assume fundamentals, never assume mastery** — every page must teach something new even to engineers who have heard the concept name.

## Content schema

```js
{
  oneliner,           // 1 sentence hook
  plainEnglish,       // Overview — orientation + distinctions (≥250 words)
  technical,          // How it works — mechanics, tools, gotchas (≥350 words)
  problem,            // Specific failure scenario
  solution,           // Actionable fix / architecture
  tradeoffs: { pros, cons, whenToUse, whenNotToUse },
  after,              // What changes in practice
  example,            // Payment cast walkthrough
  related,            // Cross-links
}
```

## Depth layers (weave across sections)

1. Definition + distinctions (X vs Y)
2. Mechanics (step-by-step flow)
3. Implementation detail (tools, config, schema)
4. Failure modes
5. Production nuance (monitoring, tuning)
6. Expert insight (one non-obvious fact)

## Section order in UI

Overview → How it works → Problem → Solution → Tradeoffs → After → Example → Related

## Forbidden phrases

- `payment platform hits limits`
- `gives a proven structure for the Wallet`
- `Addresses a real gap that naive designs miss`

## Marker

Add `// @content-enriched` at top of enriched files. `generate-all.mjs` will not overwrite these.

## Internet research protocol

Before writing each topic:

1. WebSearch 2–4 queries (`"{concept}" system design`, `X vs Y`, `site:martinfowler.com`)
2. WebFetch 1–2 authoritative pages when snippets are thin
3. Extract: definition, distinctions, mechanics, when-to-use, downsides, expert gotchas
4. Synthesize in project voice — no copy-paste, no URLs in topic files

### Sources by track

| Track | Sources |
|-------|---------|
| HLD | AWS Architecture Blog, nginx/Envoy docs, DDIA summaries |
| LLD | Fowler bliki, microservices.io, refactoring.guru |
| Backend | PostgreSQL docs, Jepsen, vendor isolation guides |

## Gold-standard examples

- **HLD:** `js/topics/hld/hld-blocks/reverse-proxy.js`
- **LLD:** `js/topics/lld/lld-dist-patterns/transactional-outbox.js`
- **Backend:** `js/topics/concurrency/lost-update.js`

## Verification commands

```bash
node scripts/verify-content.mjs          # word counts, markers, forbidden phrases
node scripts/verify-content-quality.mjs  # rubric: distinctions, expert insight
node scripts/verify-sims.mjs             # headless sim mount
node scripts/verify.mjs                  # registry + imports
```

## Payment cast

Client → Order Service → Payment Gateway → Ledger → Event Queue → Wallet / analytics

Use in every `example` section where applicable.
