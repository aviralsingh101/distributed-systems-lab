// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { dataModelTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "time-series-db",
  title: "Time-Series DB",
  category: "hld-data",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Append-heavy metrics and events.`,
  sections: [
    { title: `What is Time-Series DB?`, body: `<p><b>Time-Series DB</b> — Append-heavy metrics and events.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Time-Series DB</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Append-heavy metrics and events.</p><p>Document sync vs async usage: blocking calls belong on the critical user path only when necessary; everything else should be queued or event-driven with clear compensation.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Clarify schema flexibility, query patterns, compaction, and how analytics workloads are isolated from OLTP. Name the partition or sort key that drives locality.</p>`, figureAfter: "architecture" },
    { title: `HLD placement`, body: `<p><b>Time-Series DB</b> belongs in the persistence/analytics layer. Show read vs write paths, replication, and which queries hit which store.</p><p>Separate OLTP hot path from batch/analytics; mark ETL or CDC if data is copied.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Time-Series DB</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Time-Series DB</b>:</p><ul><li>Treating <b>Time-Series DB</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>One database for everything.</li><li>No plan for backfill or schema migration.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
