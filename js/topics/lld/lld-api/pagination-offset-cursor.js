// @article-v2
// @sim-lab
import { makeTopic } from "../../shared/topicFactory.js";
import { createTopicSim } from "../../../sim/lab/registry.js";

const PAGE_SVG = `<svg viewBox="0 0 720 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Offset vs cursor pagination">
  <defs><marker id="fig-pagination-offset-cursor-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <text x="180" y="20" text-anchor="middle" fill="#5b9dff" font-size="11" font-family="system-ui">Offset: LIMIT 20 OFFSET 40</text>
  <rect x="30" y="35" width="300" height="26" rx="4" fill="#1a2236" stroke="#2a3350" stroke-width="1"/>
  <rect x="30" y="35" width="120" height="26" rx="4" fill="#22304d" stroke="#93a1bd" stroke-width="1"/>
  <text x="90" y="52" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">scan + skip 40 rows</text>
  <rect x="150" y="35" width="60" height="26" rx="4" fill="#1a2236" stroke="#5b9dff" stroke-width="1.5"/>
  <text x="180" y="52" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">page</text>
  <text x="180" y="80" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="system-ui">deeper = slower; inserts shift rows</text>
  <text x="180" y="120" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">Cursor: WHERE id &gt; :last LIMIT 20</text>
  <rect x="30" y="135" width="300" height="26" rx="4" fill="#1a2236" stroke="#2a3350" stroke-width="1"/>
  <rect x="30" y="135" width="150" height="26" rx="4" fill="#22304d" stroke="#93a1bd" stroke-width="1"/>
  <text x="105" y="152" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">seek to cursor (indexed)</text>
  <rect x="180" y="135" width="60" height="26" rx="4" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="210" y="152" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">page</text>
  <text x="210" y="180" text-anchor="middle" fill="#3ddc97" font-size="9" font-family="system-ui">constant time; stable under inserts</text>
  <text x="560" y="60" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Offset: random access,</text>
  <text x="560" y="76" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">jump to page N.</text>
  <text x="560" y="150" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">Cursor: forward-only,</text>
  <text x="560" y="166" text-anchor="middle" fill="#93a1bd" font-size="10" font-family="system-ui">no page numbers.</text>
</svg>`;

const topic = makeTopic({
  id: "pagination-offset-cursor",
  title: "Pagination (Offset vs Cursor)",
  category: "lld-api",
  track: "lld",
  tier: "essential",
  archetype: "tradeoff",
  oneliner: `Two ways to page a large result set: offset/limit (jump to any page, but slow and unstable) versus cursor/keyset (fast and stable, but forward-only).`,
  figures: [
    { id: "offset-vs-cursor", svg: PAGE_SVG, caption: "Offset pagination scans and discards OFFSET rows so deep pages get slower; cursor (keyset) pagination seeks directly via an indexed key, staying fast and consistent under concurrent inserts." },
  ],
  sections: [
    { title: `The problem`, body: `<p>You cannot return a million <b>payments</b> in one response, so you page. The design question is how the client asks for "the next chunk". The two dominant answers — <b>offset-based</b> and <b>cursor-based (keyset)</b> pagination — look similar to the client but behave very differently as data grows and changes underneath.</p>
<pre>// API surface — offset vs cursor parameters
// Offset:  GET /v1/payments?limit=20&amp;offset=40
// Cursor:  GET /v1/payments?limit=20&amp;after=eyJjcmVhdGVkQXQiOi4uLn0

public record PaymentPageResponse(
    List&lt;PaymentDto&gt; payments,
    String nextCursor,   // opaque, base64-encoded
    boolean hasNextPage
) {}</pre>` },
    { title: `Offset pagination`, figureAfter: "offset-vs-cursor", body: `<p><code>GET /payments?limit=20&offset=40</code> → SQL <code>LIMIT 20 OFFSET 40</code>. The database must <b>scan and discard</b> the first 40 rows before returning the next 20.</p>
<p><b>Pros:</b> trivial to implement; lets the client jump to any page and show "page 5 of 200"; supports random access and total counts. <b>Cons:</b> two serious ones. (1) <b>Performance degrades with depth</b> — <code>OFFSET 1000000</code> forces the DB to walk a million rows every time; deep pages are slow. (2) <b>Instability under writes</b> — if a row is inserted or deleted between page requests, the offset shifts, so the client can <b>skip</b> a record or <b>see a duplicate</b> across page boundaries.</p>
<pre>@GetMapping
public PaymentOffsetPage listPaymentsOffset(
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(defaultValue = "0") int offset) {
    if (limit &gt; 100) throw new BadRequestException("limit must be &lt;= 100");

    List&lt;Payment&gt; payments = paymentRepository
        .findAll(PageRequest.of(offset / limit, limit,
            Sort.by(Sort.Direction.DESC, "createdAt")));

    long total = paymentRepository.count();
    return new PaymentOffsetPage(payments, offset, limit, total);
}

// Under the hood: SELECT * FROM payments ORDER BY created_at DESC
//                 LIMIT 20 OFFSET 40  — scans and discards 40 rows</pre>` },
    { title: `Cursor (keyset) pagination`, body: `<p>Instead of "skip N", the client passes a <b>cursor</b> pointing at the last item seen: <code>GET /payments?limit=20&after=eyJpZCI6NDB9</code> → SQL <code>WHERE (created_at, id) &lt; (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT 20</code>. The cursor encodes the sort key of the last row; the query <b>seeks</b> straight to that position using the index.</p>
<p><b>Pros:</b> <b>constant-time</b> regardless of depth (an index seek, no row skipping), and <b>stable</b> under concurrent inserts/deletes — you continue from a real value, not a positional count, so nothing is skipped or duplicated. <b>Cons:</b> forward-only (no arbitrary "jump to page 50"), no easy total page count, and it requires a stable, unique, indexed sort key (use a tiebreaker like <code>id</code> when the sort column isn't unique). The cursor should be opaque (base64) so clients don't build on its internals.</p>
<pre>@GetMapping("/cursor")
public PaymentPageResponse listPaymentsCursor(
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(required = false) String after) {
    if (limit &gt; 100) throw new BadRequestException("limit must be &lt;= 100");

    PaymentCursor cursor = after != null
        ? PaymentCursor.decode(after)
        : null;

    List&lt;Payment&gt; payments = paymentRepository.findKeysetPage(limit + 1, cursor);
    boolean hasNext = payments.size() &gt; limit;
    if (hasNext) payments = payments.subList(0, limit);

    String nextCursor = hasNext
        ? PaymentCursor.from(payments.get(payments.size() - 1)).encode()
        : null;

    return new PaymentPageResponse(
        payments.stream().map(this::toDto).toList(),
        nextCursor,
        hasNext
    );
}</pre>` },
    { title: `Decision guide`, body: `<ul>
<li><b>Use cursor/keyset</b> for large datasets, infinite scroll / "load more" feeds, and any API where deep pages or concurrent writes are common — this is the right default for a high-volume payments or activity feed.</li>
<li><b>Use offset</b> for small, relatively static datasets and admin UIs that genuinely need numbered pages and "jump to page N" — a settings list, a short report.</li>
<li>Always <b>cap the page size</b> (e.g. max 100) so a client can't request a million rows, and return a <code>next</code> cursor/link rather than making clients construct it.</li>
</ul>
<p>Rule of thumb: if the table is big or actively written, keyset; if it's small and you need page numbers, offset.</p>
<pre>// Keyset query — indexed seek, stable under concurrent inserts
@Repository
public interface PaymentRepository extends JpaRepository&lt;Payment, String&gt; {

    @Query("""
        SELECT p FROM Payment p
        WHERE (:cursorTs IS NULL
               OR (p.createdAt &lt; :cursorTs
                   OR (p.createdAt = :cursorTs AND p.id &lt; :cursorId)))
        ORDER BY p.createdAt DESC, p.id DESC
        LIMIT :limit
        """)
    List&lt;Payment&gt; findKeysetPage(
        @Param("limit") int limit,
        @Param("cursorTs") Instant cursorTs,
        @Param("cursorId") String cursorId);
}

// Cursor value object — opaque to clients
public record PaymentCursor(Instant createdAt, String id) {
    public String encode() {
        String json = "{\"createdAt\":\"" + createdAt + "\",\"id\":\"" + id + "\"}";
        return Base64.getUrlEncoder().encodeToString(json.getBytes());
    }
    public static PaymentCursor decode(String encoded) { /* ... */ }
}</pre>` },
  ],
  related: ["rest-resource-modeling", "indexing-strategies", "error-contract-design", "api-versioning-strategies", "read-replica-routing"],
});

export const meta = topic.meta;
export const content = topic.content;

export function createSimulation(stage, panel, stageEl) {
  return createTopicSim("pagination-offset-cursor", stage, panel, stageEl);
}
