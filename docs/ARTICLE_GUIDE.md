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

## Forbidden phrases (hard fail in verify)

- `How to read this page`
- `Category context (`
- `We use the payment cast throughout`
- `When reviewing a design doc or PR, ask: where does`
- `Implementation checklist: (1) define ownership`
- Generic nginx/Postgres/broker paragraphs on non-relevant topics

## Payment examples

One concrete paragraph inside a relevant section is fine. Do not repeat the payment cast mantra on every page.

## Sims

Labels and topology must match the article. DNS sim shows resolvers and TTL — not Ledger→Queue.

## Marker

Add `// @article-v2` at top of rewritten files. Do not re-run `apply-enrichment.mjs`.
