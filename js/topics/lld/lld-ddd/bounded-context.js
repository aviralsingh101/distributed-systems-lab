// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const BC_SVG = `<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two bounded contexts with translation">
  <defs><marker id="fig-bounded-context-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="30" y="40" width="260" height="120" rx="10" fill="none" stroke="#5b9dff" stroke-width="1.6" stroke-dasharray="5 4"/>
  <text x="160" y="60" text-anchor="middle" fill="#5b9dff" font-size="11" font-family="system-ui">Payments context</text>
  <text x="160" y="92" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">"Customer" = payer</text>
  <text x="160" y="112" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">card, balance, risk score</text>
  <rect x="430" y="40" width="260" height="120" rx="10" fill="none" stroke="#3ddc97" stroke-width="1.6" stroke-dasharray="5 4"/>
  <text x="560" y="60" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">Support context</text>
  <text x="560" y="92" text-anchor="middle" fill="#cdd6e8" font-size="10" font-family="system-ui">"Customer" = ticket owner</text>
  <text x="560" y="112" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">contact, history, plan tier</text>
  <line x1="290" y1="100" x2="428" y2="100" stroke="#7c5cff" stroke-width="1.5" marker-end="url(#fig-bounded-context-arr)"/>
  <text x="360" y="90" text-anchor="middle" fill="#7c5cff" font-size="9" font-family="system-ui">context map</text>
  <text x="360" y="118" text-anchor="middle" fill="#7c5cff" font-size="9" font-family="system-ui">+ translation</text>
  <text x="360" y="185" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">same word, different model — each boundary owns its meaning</text>
</svg>`;

const topic = makeTopic({
  id: "bounded-context",
  title: "Bounded Context",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `An explicit boundary within which a domain model and its ubiquitous language are consistent — the same word can mean different things in different contexts.`,
  sections: [
    { title: `What it is`, body: `<p>A <b>bounded context</b> is the central strategic-design pattern of DDD: an explicit boundary — a service, a module, a team's ownership — inside which a particular domain model applies and every term has one precise meaning. The <b>ubiquitous language</b> (the shared vocabulary between developers and domain experts) is only guaranteed consistent <em>within</em> a context. Cross a boundary and the same word may model something entirely different.</p>` },
    { title: `Why one model cannot cover everything`, figureAfter: "bc", body: `<p>Teams instinctively try to build a single canonical model of core nouns like "Customer" or "Product" for the whole company. It always collapses under contradictory requirements. Consider "Customer":</p>
<ul>
<li>In the <b>Payments</b> context, a Customer is a payer: card details, balance, KYC status, risk score.</li>
<li>In the <b>Support</b> context, a Customer is a ticket owner: contact info, interaction history, plan tier.</li>
<li>In <b>Marketing</b>, a Customer is a lead with segments and consent flags.</li>
</ul>
<p>Forcing these into one class produces a bloated model where every field is optional and no invariant holds. Bounded contexts instead let each own its own "Customer" model, sized to its needs — how it works is by deliberately <em>not</em> sharing a model across the boundary.</p>
<pre>// Package structure: each context owns its model — no shared domain classes
com.acme.payments                          // Payments bounded context
├── domain/
│   ├── Payment.java                       // payer, card, risk score
│   ├── Payer.java                         // "Customer" in payments language
│   └── PaymentRepository.java
├── application/
│   └── CapturePaymentHandler.java
└── infrastructure/
    └── JpaPaymentRepository.java

com.acme.support                           // Support bounded context
├── domain/
│   ├── SupportTicket.java
│   ├── TicketOwner.java                   // "Customer" in support language
│   └── TicketRepository.java
└── api/
    └── TicketController.java

// Integration: reference by ID, translate at the boundary
public record PaymentCompletedEvent(
    String paymentId, String payerId, long amountMinor, String currency
) {}  // published language — not either context's internal model</pre>` },
    { title: `Context maps and relationships`, body: `<p>Contexts still integrate, and the <b>context map</b> documents those relationships and the power dynamics between them:</p>
<ul>
<li><b>Shared kernel</b> — two contexts share a small common model; both teams must agree on changes.</li>
<li><b>Customer / Supplier</b> — a downstream context's needs influence an upstream one that agrees to serve them.</li>
<li><b>Conformist</b> — downstream simply accepts the upstream model as-is.</li>
<li><b>Anti-corruption layer</b> — downstream translates the upstream model into its own so foreign concepts do not leak in.</li>
<li><b>Open host / published language</b> — an upstream context exposes a stable, documented contract for many consumers.</li>
</ul>` },
    { title: `Boundaries in code and org`, body: `<p>A bounded context typically maps to a deployable unit (a microservice) and, per Conway's law, to a team — the boundary is as much organizational as technical. Practically: give each context its own schema/database and its own model classes; never share the domain model or the tables across contexts. Integration happens through explicit contracts — APIs or integration events — with translation at the edge. Getting the boundaries right (aligned to <b>subdomains</b> and business capabilities, not to technical layers) is the highest-leverage decision in a large system; wrong boundaries create chatty, tightly-coupled services that must deploy together.</p>
<pre>// Context map in code: ACL translates Payments → Support vocabulary
@Component
class PaymentToSupportTranslator {
    public OpenTicketCommand translate(PaymentCompletedEvent event) {
        return new OpenTicketCommand(
            event.payerId(),                    // ID only — no Payment aggregate
            "Payment " + event.paymentId() + " captured",
            TicketPriority.LOW
        );
    }
}

// Each context has its own database schema
// payments_db.payments  vs  support_db.tickets  — no shared tables</pre>` },
  ],
  figures: [
    { id: "bc", svg: BC_SVG, caption: "The word 'Customer' has a different, self-consistent model in each bounded context; a context map defines how they translate." },
  ],
  related: ["anti-corruption-code-boundary", "domain-vs-integration-events", "aggregate-root", "event-storming-to-code"],
});

export const meta = topic.meta;
export const content = topic.content;
