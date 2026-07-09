# Systems Lab — Production Failures, HLD & LLD

A frontend-only, no-build learning site with **366 interactive topics** across three tracks:

| Track | Topics | Focus |
|-------|--------|-------|
| **Production Failures** | 42 | Failure modes, concurrency bugs, production traps |
| **HLD** | 176 | Building blocks, architecture, data systems, consistency, scale |
| **LLD** | 148 | OOP, GoF patterns, transactions, locks, async/outbox/sidecar |

Every topic uses the same **payment platform** cast (Wallet, Order Service, Payment Gateway, Event Queue, Ledger) and includes **Medium-style article sections**:

1. Flexible `sections[]` prose (topic-specific headings — not forced Problem/Solution on concepts)
2. Optional `figures[]` static SVG diagrams
3. `archetype`: concept | pattern | failure | tradeoff | classic
4. Interactive canvas diagram (Play / Pause / Step / Reset + parameter sliders)

Gold-standard exemplars: **DNS** (concept), **reverse-proxy** (concept), **lost-update** (failure), **transactional-outbox** (pattern), **singleton** (pattern).

No backend. No build step. Pure HTML/CSS/JS (ES modules).

## Running it

Serve over HTTP (not `file://`):

```bash
npx http-server . -p 8123 -c-1
```

Open <http://localhost:8123>.

## Navigation

- `#/` — Home with three track cards
- `#/track/failures` — Production failures roadmap
- `#/track/hld` — High-level design roadmap
- `#/track/lld` — Low-level design roadmap
- `#/topic/<id>` — Individual concept page

Sidebar has **track tabs** (Failures | HLD | LLD) and search across all topics. Topics marked **◆** are *hidden gems* — lesser-known concepts worth learning.

## Content authoring

See [`docs/ARTICLE_GUIDE.md`](docs/ARTICLE_GUIDE.md) for the article-v2 schema, archetypes, and forbidden boilerplate.

Gold-standard examples:

- **Concept:** `js/topics/hld/hld-networking/dns.js`, `js/topics/hld/hld-blocks/reverse-proxy.js`
- **Failure:** `js/topics/failures/concurrency/lost-update.js`
- **Pattern:** `js/topics/lld/lld-dist-patterns/transactional-outbox.js`, `js/topics/lld/lld-creational/singleton.js`

Rewritten topic files are marked with `// @article-v2` at the top.

### Verification

```bash
node scripts/verify-content.mjs          # article-v2 schema + forbidden boilerplate
node scripts/verify-content-quality.mjs  # archetype rubric
node scripts/verify-sims.mjs             # headless sim mount for all 366 topics
node scripts/verify.mjs                  # registry integrity + sample imports
```

### Migration (development)

```bash
node scripts/migrate-to-article-v2.mjs   # convert legacy topics to sections[] (batch)
node scripts/repair-articles.mjs         # fix syntax + expand short sections
```

`apply-enrichment.mjs` is **disabled** — it stamped identical boilerplate. Do not re-run it.

## Suggested learning order

1. **LLD** — OOP/SOLID → creational/structural/behavioral patterns → transactions, locks, idempotency → distributed patterns (outbox, inbox, sidecar, saga, CQRS)
2. **HLD** — building blocks (LB, gateway, cache, queues) → architecture patterns → data systems → classic designs
3. **Production Failures** — deepen with failure modes and production war stories (lost update, retry storms, hot partitions)

## Project structure

```
js/
  registry.js           # Merges all three tracks
  registry-failures.js  # Production failures categories (42 topics)
  registry-hld.js       # HLD categories (auto-generated + relocated)
  registry-lld.js       # LLD categories (auto-generated + relocated)
  app.js                # Router, hub pages, educator section order
  sim/
    engine.js, primitives.js, controls.js, sequence.js
    templates/          # flow, topology, pipeline, tradeoff, layer, dataModel, stateMachine
  topics/
    failures/<cat>/     # Production failures track
    hld/<cat>/          # HLD topics
    lld/<cat>/          # LLD topics
    _shared/topicFactory.js
scripts/
  topic-relocation.json # Phase 0 mapping (topic id → track, category, path)
  relocate-topics.mjs   # Move topic files per mapping
  topic-manifest.js     # Source list for HLD/LLD topics
  generate-all.mjs      # Regenerate topic modules + registries (skips @article-v2)
  migrate-to-article-v2.mjs  # Batch migrate to sections[] schema
  apply-enrichment.mjs  # DISABLED — old boilerplate generator
  lib/article-quality.mjs
  lib/article-writer.mjs
  verify.mjs            # Registry integrity
  verify-content.mjs    # Content schema gate
  verify-content-quality.mjs
  verify-sims.mjs
docs/
  ARTICLE_GUIDE.md
  CONTENT_TEMPLATE.md   # legacy rubric (deprecated)
```

## Regenerating HLD/LLD topics

After editing `scripts/topic-manifest.js`:

```bash
node scripts/generate-all.mjs
node scripts/verify.mjs
```

Files with `// @content-enriched` are **skipped** by the generator. Hand-crafted topics are preserved.

## Production Failures categories (track 1)

Concurrency, Locking, Retry Problems, Cache Problems, Messaging Failures, Failure Handling, Production Engineering Failures.

## HLD categories (track 2)

Foundations, Networking, Building Blocks, Distributed Theory, Data Systems, Architecture Patterns, Reliability & Ops, Security, Trade-off Decisions, Classic System Designs, Consistency Models, Database Scaling, Performance & Capacity, Cache Strategies, Rate Limiting & Traffic Control, Messaging Operations, Reliability Patterns.

## LLD categories (track 3)

OOP & Principles, Creational/Structural/Behavioral Patterns, Distributed Patterns, Async & Messaging, API Design, Database Design, Concurrency, DDD & Clean Architecture, Testing, Classic LLD Problems, Transactions, Distributed Locking, Event Ordering, Idempotency, Concurrency Strategies.
