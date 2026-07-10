# Article authoring guide (v2)

Topics use **Medium-style prose** with flexible sections — not fixed Problem/Solution on every page.

## Schema

```js
// @article-v2
export const content = {
  oneliner: "One sentence hook",
  archetype: "concept", // concept | pattern | failure | tradeoff | classic
  sections: [
    { title: "What is DNS?", body: `<p>...</p>` },
    { title: "How a lookup works", body: `...` },
  ],
  figures: [  // optional
    { id: "lookup-chain", svg: `<svg>...</svg>`, caption: "Recursive resolver chain" }
  ],
  related: ["cdn", "global-load-balancing"],
};
```

## Archetypes

| Archetype | Use for | Typical sections (pick what fits) |
|-----------|---------|-----------------------------------|
| **concept** | DNS, HTTP, CAP | What is it → How it works → Real-world behavior → In production |
| **pattern** | Outbox, Saga, Circuit breaker | Motivation → Structure → Flow → Tradeoffs |
| **failure** | Lost update, Retry storm | Symptom → Root cause → Fixes → Prevention |
| **tradeoff** | SQL vs NoSQL | Option A vs B → Comparison → Decision guide |
| **classic** | URL shortener | Requirements → Design → Bottlenecks |

**Production Failures** topics use `archetype: "failure"`. Concepts like DNS never get "The problem" / "The solution" headings.

## HLD track — interview article standard

HLD topics teach **how to design**, not how to operate production. Interviewers expect: problem framing, high-level architecture, flow diagram, design decisions with tradeoffs, and pitfalls — **not** a generic production checklist.

### Required section order by archetype

| Archetype | Sections (in order) |
|-----------|---------------------|
| **concept** (DNS, CDN, blocks) | What it is → How it works / request path → **HLD placement** → **Design decisions** → **Pitfalls & what interviewers probe** → optional brief ops note |
| **classic** (URL shortener, chat) | Requirements → Capacity sketch → **High-level design** → Deep dives → Bottlenecks → **Interview pitfalls** |
| **tradeoff** (SQL vs NoSQL) | The decision → Option A → Option B → Comparison (+ figure) → Decision guide → **Interview framing** |
| **foundations** (system-design-framework) | Process / framework steps → When to apply → Example walkthrough → Common mistakes |

### HLD flow diagram (required)

Every HLD topic must include at least one **topic-specific** figure via `figures[]` and `figureAfter` on a section:

- Ingress/blocks → `requestFlow`
- Classics → `architecture`
- Tradeoffs → `comparison`
- Gold topics → handcrafted SVG (`// @figure-handcrafted`)

### What HLD articles must NOT do

- **No generic Production checklist** — the identical 5-bullet block (`payment_id`, `wallet_id`, runbook, load-test hot key) is forbidden on HLD topics
- **No shallow template rewrites** — `node scripts/rewrite-hld-articles.mjs` bulk mode is disabled; use hand-authored `@hld-gold` articles
- **No "Option A / Option B"** without naming the actual technologies (e.g. token bucket vs leaky bucket)
- **No payment-platform topology boilerplate** on unrelated topics (`In the payment platform topology…`)
- Pitfalls section is **last** and **short** — the article body must teach the design first

Gold references for depth: `rate-limiter-service`, `url-shortener`, `rate-limit-algorithms`, `token-bucket`, `reverse-proxy`, `dns`.

Run `node scripts/run-hld-deep-wave.mjs --category=hld-classics` to list topics still needing deep rewrites.

## Forbidden phrases (hard fail in verify)

- `How to read this page`
- `Category context (`
- `We use the payment cast throughout`
- `When reviewing a design doc or PR, ask: where does`
- `Implementation checklist: (1) define ownership`
- `Correlate logs with payment_id` (generic HLD checklist)
- `Before shipping` + `Production checklist` (generic HLD checklist)
- `In the payment platform topology` (generic HLD boilerplate)
- Generic nginx/Postgres/broker paragraphs on non-relevant topics

## Payment examples

One concrete paragraph inside a relevant section is fine. Do not repeat the payment cast mantra on every page.

## Content map (sim + figure assignment)

Each topic has **one primary teaching surface** — not sim + generic figure everywhere. Assignments live in [`scripts/content-map.json`](scripts/content-map.json).

| Mode | When |
|------|------|
| **Interactive lab** | Behavior over time: races, metrics, queues, state machines |
| **Static figure** | Structure: comparison, UML class, ER, block/request-flow |
| **Prose only** | Principles, process topics, soft foundations |

### Decision flow

1. Does the concept need **behavior over time**? → interactive lab (`metrics`, `race`, `queue`, `clickFlow`, `state`, `algorithm`, `architecture`)
2. Else does it need a **spatial diagram**? → static figure (`comparison`, `umlClass`, `er`, `requestFlow`, `architecture`, …)
3. Else → **prose only** (`sim: none`, `figure: none`) — no stage panel rendered

### Workflow

```bash
node scripts/gen-content-map.mjs      # generate from category rules + overrides
node scripts/apply-content-map.mjs    # strip/add sims and figures in topic files
node scripts/sync-figure-map.mjs      # sync figure-map.json from content-map
node scripts/gen-sim-map.mjs          # sync sim-map.json from content-map
node scripts/verify-content-map.mjs   # enforce assignments (wired into verify.mjs)
```

- Category defaults: [`scripts/lib/content-map-gen.mjs`](scripts/lib/content-map-gen.mjs)
- Per-topic exceptions: [`scripts/content-map-overrides.json`](scripts/content-map-overrides.json)
- `lab: none` returns `null` from registry — app hides the sim panel entirely
- Gold pairs (e.g. lost-update + timeline, circuit-breaker + stateMachine) may have both figure and sim

## Figures (static SVG)

High-value topics (~150) include **topic-specific** inline SVG figures — not generic payment-path diagrams on every page.

```js
figures: [
  { id: "lookup-chain", svg: `<svg viewBox="0 0 720 140">...</svg>`, caption: "..." },
],
sections: [
  { title: "How a lookup works", figureAfter: "lookup-chain", body: `...` },
],
```

### Placement

- **`figureAfter`** on a section places that figure immediately after the section heading (preferred for gold articles).
- **Fallback:** first figure after section 0, second at mid-article — when `figureAfter` is absent.

### Diagram types

| Type | Use for |
|------|---------|
| `timeline` | Concurrent interleaving (lost update, TOCTOU) |
| `stateMachine` | Circuit breaker, saga states |
| `requestFlow` | Ingress: proxy, LB, gateway, CDN |
| `cacheFlow` | Cache-aside, write-through, stampede |
| `hashRing` | Consistent hashing, sharding |
| `quorum` | R+W>N, replica lag |
| `outboxFlow` | DB txn + outbox + relay |
| `lockTimeline` | Distributed lock lease + fencing |
| `comparison` | Tradeoff topics (SQL vs NoSQL) |
| `capTriangle` | CAP / PACELC only |
| `umlClass` | OOP, SOLID, GoF class diagrams |
| `er` | LLD database schema topics |

### Authoring

- Hand-crafted gold figures: add `// @figure-handcrafted` — `apply-content-map.mjs` will not overwrite.
- Bulk figures: `node scripts/apply-content-map.mjs` reads `scripts/content-map.json`.
- Legacy bulk: `node scripts/add-figures.mjs --wave failures|hld|lld` reads `scripts/figure-map.json`.
- Verify: `node scripts/verify-figures.mjs` (also wired into `verify.mjs`).
- SVG marker IDs must be unique per topic: `fig-{topicId}-arr`.

### What to avoid

- Generic Client→Order→Gateway→Ledger on non-ingress topics
- CAP triangle on OOP/SOLID topics
- Replacing interactive sims — figures explain structure; sims show behavior

## Interactive labs (simulations)

Sims use **click-driven labs** — not auto-playing block diagrams with Play/Pause/Step.

```js
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("token-bucket", stage, panel, stageEl);
}
```

Gold reference implementations live in [`js/sim/lab/registry.js`](js/sim/lab/registry.js). Hand-crafted sims: add `// @sim-gold` or `// @sim-handcrafted`.

### Lab archetypes

| Template | Use for | Required interactions |
|----------|---------|----------------------|
| `metricsLab` | Token bucket, retry storm, rate limiters | Send button, burst toggle (continuous until off), time-series chart, counters |
| `clickFlowLab` | Read-your-writes, cache-aside, outbox | Ordered action buttons, animated request flow |
| `queueProcessorLab` | DLQ, poison message | Start processing, mode select, message chips |
| `raceLab` | Lost update, locking races | Step-through buttons per transaction |
| `stateExplorerLab` | Circuit breaker, 2PC, saga | Click to advance state phases |
| `algorithmLab` | LRU, hash ring, clocks | Click keys/operations; live structure view |
| `architectureLab` | HLD classics, CDN, DNS | Click to trace read/write path |
| `none` | Prose-only or static-figure-only topics — no sim panel |

### Authoring

- Map topics in `scripts/content-map.json` (generate: `node scripts/gen-content-map.mjs`).
- Apply: `node scripts/apply-content-map.mjs`.
- Sim registry derives from content-map via `node scripts/gen-sim-map.mjs`.
- Verify: `node scripts/verify-content-map.mjs` + `verify-sim-quality.mjs` (wired into `verify.mjs`).
- LLD UML figures: `scripts/lib/uml-templates.mjs`.

### Quality rubric (4 of 5 required)

1. User-driven — clicks/buttons, not Play
2. Domain-faithful labels and outcomes
3. Visible consequence (stale read, dropped request, poison loop)
4. Metrics/structure view (chart, LRU list, queue depth)
5. Configurable slider or toggle

### Forbidden

- Play/Pause/Step as primary UX on migrated topics
- Generic Client→Order→Gateway path
- `fix` toggle that only recolors edges
- Auto-looping sequences with no user input

### Behavior specs (end-to-end QA)

Interactive labs must have **toggle/action outcomes** verified headlessly — not just mount.

**Files:**

| File | Purpose |
|------|---------|
| [`scripts/lib/sim-behavior-driver.mjs`](scripts/lib/sim-behavior-driver.mjs) | Headless mount, `clickAction`, `toggle`, `tick`, status helpers |
| [`scripts/sim-behavior-specs.json`](scripts/sim-behavior-specs.json) | Per-topic cases: setup toggles, actions, expected `lastTarget` / `statusCls` |
| [`scripts/verify-sim-behavior.mjs`](scripts/verify-sim-behavior.mjs) | Runs all specs; `--id=topic-id` for one topic |
| [`scripts/gen-behavior-specs.mjs`](scripts/gen-behavior-specs.mjs) | Regenerate default specs after adding topics |
| [`scripts/run-sim-qa-wave.mjs`](scripts/run-sim-qa-wave.mjs) | Print subagent mandate for a lab-type wave |

**Authoring a spec case:**

```json
{
  "setup": { "toggles": { "failover": true, "cached": true } },
  "action": "resolve",
  "tickSeconds": 3,
  "expect": { "lastTarget": "regionA", "statusCls": "err", "statusIncludes": "Stale" }
}
```

- Every toggle must change routing, state, or counters — not just status text.
- Gold handlers and per-topic configs live in [`registry.js`](js/sim/lab/registry.js), [`topicConfigs.mjs`](js/sim/lab/topicConfigs.mjs), [`topicLabFactories.mjs`](js/sim/lab/topicLabFactories.mjs).
- `architectureLab` supports `getHops(ctx)` — re-resolve hops on each action click.
- Regenerate and verify:

```bash
node scripts/gen-behavior-specs.mjs
node scripts/verify-sim-behavior.mjs --id=dns
node scripts/verify.mjs
```


## Marker

Add `// @article-v2` at top of rewritten files. Do not re-run `apply-enrichment.mjs`.
