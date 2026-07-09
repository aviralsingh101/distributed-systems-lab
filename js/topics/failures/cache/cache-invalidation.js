// @article-v2
// @sim-lab
import { createTopicSim } from "../../../sim/lab/registry.js";

export const meta = { id: "cache-invalidation", title: "Cache Invalidation", category: "cache" };

export const content = {
  oneliner: `Stale cache entries after writes — invalidate on write, or pay the cost in wrong balances and angry users.`,
  archetype: "failure",
  sections: [
    {
      title: "Symptom",
      body: `<p>Users see outdated payment status, old shipping addresses, or wallet balances that don't match receipts. Purging CDN or Redis "fixes" it temporarily. Incidents cluster after deploys that change response shape but not cache keys.</p>
<p>Phil Greenspun's joke applies: cache invalidation is one of the two hard problems in computer science (naming things and off-by-one errors being the others).</p>`,
    },
    {
      title: "Root cause",
      body: `<p>Cached data outlived the truth in the database because nothing told the cache the row changed. Common triggers:</p>
<ul>
<li><b>Missing invalidation on write</b> — developer added <code>UPDATE</code> but forgot <code>DEL</code></li>
<li><b>Wrong key scope</b> — invalidated <code>user:42</code> but list cache <code>users:page:1</code> still stale</li>
<li><b>TTL-only strategy</b> — no explicit purge; users see wrong data until expiry</li>
<li><b>Partial fan-out</b> — multi-node cache; invalidation message lost on one node</li>
</ul>`,
    },
    {
      title: "Invalidation-on-write (primary strategy)",
      body: `<p>For cache-aside, the standard write path is:</p>
<pre>COMMIT business transaction
DEL affected keys (or tag-based purge)
OPTIONAL: publish invalidation event for edge/CDN</pre>
<p><b>Key design:</b> one helper per aggregate — <code>invalidateWallet(id)</code> deletes <code>wallet:{id}</code>, <code>wallet:{id}:transactions:summary</code>, and publishes to a pub/sub channel if other services cache the same entity.</p>
<p><b>Tag / version invalidation:</b> store <code>cache-gen:wallet:42 = 7</code>; cached entries include <code>gen:7</code>. On write, increment gen — old entries miss without enumerating every key.</p>
<p>If invalidation fails, treat it as a production incident path — metric, retry, do not assume TTL will save you on financial keys.</p>`,
    },
    {
      title: "Other invalidation tactics",
      body: `<ul>
<li><b>TTL</b> — simple; bounded staleness only. Use as safety net, not sole strategy for balances.</li>
<li><b>Write-through / write-around</b> — shift when cache updates (see Write Through, Write Around).</li>
<li><b>Event-driven purge</b> — CDC or domain events trigger cache workers (scales to many consumers).</li>
<li><b>CDN purge API</b> — path or tag purge after deploy; respect propagation delay.</li>
</ul>`,
    },
    {
      title: "Fixes and prevention",
      body: `<ul>
<li>Audit all write paths in code review — "what cache keys does this touch?"</li>
<li>Integration tests: write → assert key absent or version bumped</li>
<li>Reconciliation cron: random sample compare cache vs DB</li>
<li>Alert on invalidation queue depth and failure rate</li>
</ul>
<p>When invalidation lags under load (burst of writes), readers see stale data until purge catches up — the sim models this fan-out pressure.</p>`,
    },
    {
      title: "Production checklist",
      body: `<ul>
<li>Document key catalog and invalidation map per service</li>
<li>Never ship a new cached endpoint without a matching write-path invalidation</li>
<li>Runbook: emergency purge by key prefix; link to Cache Consistency for dual-write failures</li>
</ul>`,
    },
  ],
  related: ["cache-aside", "cache-consistency", "write-through", "db-cache-dual-write", "cache-stampede"],
};

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("cache-invalidation", stage, panel, stageEl);
}
