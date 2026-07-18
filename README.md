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

No backend on GitHub Pages. For **private Notes**, run the full stack with Docker Compose (nginx + notes API + Postgres). Pure HTML/CSS/JS (ES modules) — no React.

## Running it

### Option A — Docker Compose (recommended for Notes)

```bash
docker compose up -d --build
```

Open <http://127.0.0.1:8080>. Use the **Notes** tab to create/edit notes.

- Notes persist in Docker volume `notes_pgdata` (survives `docker compose down` / restart).
- Wipe notes: `docker compose down -v`
- Postgres is not published to the host; only nginx port **8080** is exposed.

### Option B — Static only (GitHub Pages / http-server)

```bash
npx http-server . -p 8123 -c-1
```

Open <http://localhost:8123>. Learning tracks work; **Notes** shows “Notes unavailable” / “Cannot add notes” because there is no API.

### Docker Hub (build + push)

```bash
# Git Bash / WSL / macOS / Linux
chmod +x docker-push.sh docker-up.sh
./docker-push.sh
```

Or manually:

```bash
docker login
export DOCKERHUB_USER=aviralsingh101
docker compose build
docker push $DOCKERHUB_USER/dsl-web:latest
docker push $DOCKERHUB_USER/dsl-notes-api:latest
```

### Start the stack

**Windows (PowerShell) — recommended:**

```powershell
.\docker-up.ps1
.\docker-up.ps1 -NoBuild
.\docker-up.ps1 -Pull
```

Do **not** use `bash ./docker-up.sh` from PowerShell: that starts **WSL**, which cannot talk to Docker Desktop unless WSL integration is enabled.

**Git Bash / macOS / Linux / WSL (with Docker integration):**

```bash
./docker-up.sh              # build + start
./docker-up.sh --no-build   # start existing images
./docker-up.sh --pull       # pull from Hub, then start
```

Pull-only on another machine (volume is local to that machine):

```bash
export DOCKERHUB_USER=aviralsingh101
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

Postgres image stays official `postgres:16-alpine` (not pushed).

### Backup notes volume

```bash
docker run --rm -v distributed-systems-lab_notes_pgdata:/var/lib/postgresql/data -v ${PWD}:/backup alpine tar czf /backup/notes-pgdata.tgz -C /var/lib/postgresql/data .
```

(Adjust volume name with `docker volume ls` if the project directory name differs.)

## Navigation

- `#/` — Home with track cards
- `#/track/failures` — Production failures roadmap
- `#/track/hld` — High-level design roadmap
- `#/track/lld` — Low-level design roadmap
- `#/track/notes` — Private notes hub (Docker stack only)
- `#/notes/new` — Create note
- `#/notes/<id>` — Edit note
- `#/topic/<id>` — Individual concept page

Sidebar has **track tabs** (Failures | HLD | LLD | Notes) and search across learning topics. Topics marked **◆** are *hidden gems*.

## Project structure

```
docker-compose.yml      # web + api + db (named volume notes_pgdata)
docker-compose.hub.yml  # pull-only images from Docker Hub
Dockerfile.web          # nginx + static site (serves .js/.mjs as application/javascript)
Dockerfile.api          # Node notes API
deploy/nginx.conf       # static + /api proxy
notes-api/              # Express + Postgres schema
js/notes/               # Notes UI (api, editor, views)
```

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
