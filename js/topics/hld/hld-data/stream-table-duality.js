// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";
import { pipelineTemplate } from "../../../sim/templates/index.js";

const topic = makeTopic({
  id: "stream-table-duality",
  title: "Stream-Table Duality",
  category: "hld-data",
  track: "hld",
  tier: "hidden-gem",
  archetype: "concept",
  oneliner: `Tables are streams; streams are tables.`,
  sections: [
    { title: `What is Stream-Table Duality?`, body: `<p><b>Stream-Table Duality</b> — Tables are streams; streams are tables.</p>
<p>In system design interviews, start here: define the problem this component solves before naming vendors or drawing databases. One sentence on user-visible behavior, one on scale assumption.</p>
<p>Distinguish <b>Stream-Table Duality</b> from adjacent concepts in the sidebar — interviewers test whether you know boundaries, not buzzword definitions.</p>` },
    { title: `How it works`, body: `<p>Tables are streams; streams are tables.</p><p>Trace one end-to-end request through <b>Stream-Table Duality</b>: what triggers it, which components participate, where state is stored, and what the client observes on success vs timeout.</p><p>Walk through the happy path first, then one degraded path (slow dependency, partial outage, stale cache).</p><p>Clarify schema flexibility, query patterns, compaction, and how analytics workloads are isolated from OLTP. Name the partition or sort key that drives locality.</p>`, figureAfter: "architecture" },
    { title: `HLD placement`, body: `<p><b>Stream-Table Duality</b> belongs in the persistence/analytics layer. Show read vs write paths, replication, and which queries hit which store.</p><p>Separate OLTP hot path from batch/analytics; mark ETL or CDC if data is copied.</p>` },
    { title: `Design decisions`, body: `<p><b>Why this over alternatives?</b> Tie the choice to constraints: team size, QPS, consistency, cost ceiling, and operational maturity. Interviewers want a decision tree, not a feature list.</p>
<p><b>Failure isolation:</b> If <b>Stream-Table Duality</b> fails, what still works? Define blast radius and graceful degradation — read-only mode, cached responses, or queue for later.</p>
<p><b>Evolution path:</b> What you would add at 10× traffic without rewriting from scratch — shard, cache tier, async pipeline, or regional replica.</p>
<p><b>Observability:</b> Which metrics prove the design is working (hit rate, lag, error budget burn) vs masking problems.</p>
` },
    { title: `Pitfalls & what interviewers probe`, body: `<p>What interviewers probe for <b>Stream-Table Duality</b>:</p><ul><li>Treating <b>Stream-Table Duality</b> as a checkbox without explaining where it sits on the diagram.</li><li>Quoting buzzwords without tying them to latency, consistency, or cost constraints.</li><li>Ignoring failure modes — interviewers ask "what breaks first?"</li><li>Skipping capacity math before proposing shards or caches.</li><li>No clear data model or API contract for the component under discussion.</li><li>One database for everything.</li><li>No plan for backfill or schema migration.</li></ul>
<p><b>Strong answer pattern:</b> requirements → diagram → deep dive on hardest component → tradeoff → failure scenario → how you would load-test the design.</p>` }
  ],
  related: [],
  
  
});

export const meta = topic.meta;
export const content = topic.content;
