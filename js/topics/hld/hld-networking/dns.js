// @article-v2
// @sim-lab
// @sim-gold
// @figure-handcrafted
// @hld-gold
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const LOOKUP_SVG = `<svg viewBox="0 0 720 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DNS lookup chain">
  <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="10" y="50" width="90" height="40" rx="6" fill="#1a2236" stroke="#9aa7c7" stroke-width="1.5"/>
  <text x="55" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Browser</text>
  <rect x="120" y="50" width="90" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="165" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">OS cache</text>
  <rect x="230" y="50" width="100" height="40" rx="6" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="280" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Resolver</text>
  <rect x="350" y="50" width="70" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="385" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Root</text>
  <rect x="440" y="50" width="70" height="40" rx="6" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="475" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">.com</text>
  <rect x="530" y="50" width="110" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="585" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Authoritative</text>
  <rect x="660" y="50" width="50" height="40" rx="6" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="685" y="75" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">A</text>
  <line x1="100" y1="70" x2="118" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="210" y1="70" x2="228" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="330" y1="70" x2="348" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="420" y1="70" x2="438" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="510" y1="70" x2="528" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="640" y1="70" x2="658" y2="70" stroke="#5b9dff" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="360" y="30" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Recursive resolution — each hop may be cached for TTL seconds</text>
</svg>`;

const topic = makeTopic({
  id: "dns",
  title: "DNS",
  category: "hld-networking",
  track: "hld",
  tier: "essential",
  archetype: "concept",
  oneliner: "The distributed naming database that turns hostnames into IPs — and controls where traffic lands during deploys and region failures.",
  sections: [
    {
      title: "What is DNS?",
      body: `<p><b>DNS</b> (Domain Name System) is a distributed, hierarchical database that maps human-readable names like <code>pay.api.example.com</code> to records: IPv4/IPv6 addresses, aliases, mail servers, and more. It is not a single server — it is a federation of <b>authoritative</b> name servers (who own the truth for a zone) and <b>recursive resolvers</b> (who look answers up on behalf of clients and cache them).</p>
<p>For a payment API, DNS is the first routing decision: before any TLS handshake or HTTP request, the client must resolve which IP (or load balancer) to connect to. That makes DNS part of your availability story — a wrong or stale record sends paying customers to a dead region.</p>`,
    },
    {
      title: "Record types that matter in production",
      body: `<ul>
<li><b>A / AAAA</b> — hostname → IPv4 / IPv6. What most API clients ultimately need.</li>
<li><b>CNAME</b> — alias to another hostname. Cannot be used at zone apex (<code>example.com</code>); resolvers chase the chain until they hit A/AAAA.</li>
<li><b>ALIAS / ANAME</b> — vendor extensions (Route53 alias, Cloudflare CNAME flattening) that behave like CNAME at apex by synthesizing A records at query time.</li>
<li><b>NS / SOA</b> — delegation and zone metadata. Mis-delegation breaks entire subtrees.</li>
</ul>
<p>Route53 <b>alias records</b> to AWS resources (ALB, CloudFront) are special: they are answered from the authoritative edge with a managed TTL (often 60s) and do not incur extra lookup hops like CNAME chains.</p>`,
    },
    {
      title: "How a lookup works",
      figureAfter: "lookup-chain",
      body: `<p>When the mobile app calls <code>https://pay.api.example.com/v1/charge</code>, resolution typically follows this chain:</p>
<ol>
<li><b>Browser / app cache</b> — in-process cache (JVM <code>InetAddress</code> defaults to caching "forever" unless tuned).</li>
<li><b>OS stub resolver</b> — <code>systemd-resolved</code>, Windows DNS Client, macOS <code>mDNSResponder</code>.</li>
<li><b>Recursive resolver</b> — ISP resolver, <code>8.8.8.8</code>, corporate DNS, or VPC Route53 Resolver at <code>169.254.169.253</code>.</li>
<li><b>Root → TLD → authoritative</b> — recursive server iterates: root hints for <code>.com</code>, TLD NS for <code>example.com</code>, authoritative NS returns the final A record.</li>
</ol>
<p>The recursive resolver caches the final answer (and intermediate NS records) for the duration specified by the record's <b>TTL</b> (time to live, in seconds). Clients almost never talk to authoritative servers directly — they talk to a recursive resolver that does the walking.</p>`,
    },
    {
      title: "TTL and caching — why deploys feel sticky",
      body: `<p>Every DNS answer carries a TTL. Resolvers may serve cached answers without re-querying authoritative DNS until TTL expires. RFC 2181 says resolvers should respect TTL; in practice many layers extend it:</p>
<ul>
<li>ISP and corporate recursive resolvers sometimes enforce minimum cache floors (30–60s).</li>
<li>OS-level caches may outlive the TTL you configured.</li>
<li>Long-lived JVM processes cache resolved IPs until restart unless you set <code>networkaddress.cache.ttl</code>.</li>
</ul>
<p><b>Operational rule:</b> your authoritative TTL is a lower bound on how fast clients move, not a guarantee. After you change a record, expect <em>most</em> traffic to shift within 2× TTL, but plan for stragglers up to 10× TTL on some networks.</p>
<p>Before a blue/green cutover or region migration, <b>lower TTLs</b> on the records you will change (60s or 120s is common for failover records). After the migration stabilizes, you can raise TTL again to reduce query cost and improve cache hit rates.</p>`,
    },
    {
      title: "Geo routing and latency-based routing",
      body: `<p>Managed DNS (Route53, Cloudflare, NS1) lets one hostname return <b>different answers per client location or latency</b>:</p>
<ul>
<li><b>Geolocation routing</b> — map continent/country/state to a record. Stable: a user in EU consistently hits EU. Requires a <b>default</b> record for unmatched clients.</li>
<li><b>Latency-based routing</b> — Route53 measures RTT from AWS regions and returns the lowest-latency healthy endpoint. Answers can change as network conditions shift — combined with caching, clients may stay pinned to a suboptimal region until TTL expires.</li>
<li><b>Geoproximity</b> — bias traffic toward a geographic target with configurable bias values (useful for "mostly US-East but spill to US-West").</li>
</ul>
<p>For a global payment API, geolocation gives predictable data-residency routing; latency routing optimizes RTT but interacts badly with long TTLs — clients cache the first answer and do not re-resolve on every request.</p>`,
    },
    {
      title: "Failover when a region dies",
      body: `<p><b>Active-passive failover</b> pairs a PRIMARY record (with health check) and a SECONDARY record. When health checkers (Route53 polls from multiple global locations) agree the primary is down, authoritative DNS stops returning the primary answer — only secondary IPs remain.</p>
<p>Critical detail: <b>DNS failover is not instantaneous.</b> Timeline:</p>
<ol>
<li>Health check detects failure (~10–90s depending on interval and failure threshold).</li>
<li>Route53 stops publishing primary record in authoritative responses.</li>
<li>Recursive resolvers and client caches still serve the old primary IP until TTL expires.</li>
</ol>
<p>With TTL=60s, real-world failover is often 60–120s; some clients longer. Runbooks should not assume sub-second DNS cutover — pair DNS failover with application-level health routing or anycast where RTO demands seconds.</p>
<p>Combine policies: geolocation record → failover record set per region, so EU primary failure falls back to EU secondary before spilling to default.</p>`,
    },
    {
      title: "Incident patterns you will see",
      body: `<ul>
<li><b>TTL too high during deploy</b> — changed ALB, old IP cached for hours. Lower TTL 24h before migration.</li>
<li><b>Split-horizon DNS</b> — internal VPC resolver returns private IP; external returns public. Debugging "works in office, fails on mobile" often means two different answers for the same name.</li>
<li><b>CNAME at apex</b> — invalid for plain DNS; use ALIAS or ALB alias record.</li>
<li><b>Health check mismatch</b> — Route53 marks primary healthy but app returns 503 on real traffic path (checks <code>/health</code> only, not Gateway dependency).</li>
<li><b>Java DNS cache</b> — fleet still connects to drained region after DNS fix until JVM restart.</li>
</ul>
<p>During a payment-platform region failover, monitor charge success rate by region <em>and</em> resolver cache lag — DNS may be "fixed" in Route53 while 5% of clients still hit the dead AZ.</p>`,
    },
  ],
  figures: [
    { id: "lookup-chain", svg: LOOKUP_SVG, caption: "Recursive resolution: stub resolver asks upstream; authoritative server owns the A record. Each hop caches per TTL." },
  ],
  related: ["cdn", "global-load-balancing", "tls-termination"],
});

export const meta = topic.meta;
export const content = topic.content;
export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("dns", stage, panel, stageEl);
}
