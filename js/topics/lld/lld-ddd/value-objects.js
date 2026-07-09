// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const VO_SVG = `<svg viewBox="0 0 720 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Entity identity vs value equality">
  <rect x="40" y="35" width="290" height="110" rx="10" fill="none" stroke="#5b9dff" stroke-width="1.6"/>
  <text x="185" y="56" text-anchor="middle" fill="#5b9dff" font-size="11" font-family="system-ui">Entity — equal by ID</text>
  <rect x="70" y="70" width="100" height="30" rx="5" fill="#1a2236" stroke="#93a1bd" stroke-width="1.3"/><text x="120" y="90" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Wallet #42</text>
  <rect x="200" y="70" width="100" height="30" rx="5" fill="#1a2236" stroke="#93a1bd" stroke-width="1.3"/><text x="250" y="90" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Wallet #42</text>
  <text x="185" y="125" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">same identity, balance may change</text>
  <rect x="390" y="35" width="290" height="110" rx="10" fill="none" stroke="#3ddc97" stroke-width="1.6"/>
  <text x="535" y="56" text-anchor="middle" fill="#3ddc97" font-size="11" font-family="system-ui">Value Object — equal by value</text>
  <rect x="420" y="70" width="110" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.3"/><text x="475" y="90" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Money(5, USD)</text>
  <rect x="560" y="70" width="110" height="30" rx="5" fill="#1a2236" stroke="#7c5cff" stroke-width="1.3"/><text x="615" y="90" text-anchor="middle" fill="#cdd6e8" font-size="9" font-family="system-ui">Money(5, USD)</text>
  <text x="535" y="125" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">interchangeable, immutable, no ID</text>
</svg>`;

const topic = makeTopic({
  id: "value-objects",
  title: "Value Objects",
  category: "lld-ddd",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Immutable objects with no identity, defined entirely by their attributes and compared by value — like Money, DateRange, or Address.`,
  sections: [
    { title: `Value objects vs entities`, body: `<p>DDD models two kinds of domain objects. An <b>entity</b> has a distinct <b>identity</b> that persists through change: Wallet #42 is the same wallet whether its balance is $10 or $0, and two wallets with identical balances are still different wallets. A <b>value object</b> has <b>no identity</b> — it is defined solely by its attributes. <code>Money(5, USD)</code> is completely interchangeable with any other <code>Money(5, USD)</code>; there is no "which five dollars." You care what it is, not which one it is.</p>` },
    { title: `The defining properties`, figureAfter: "vo", body: `<p>A value object has three characteristics, and this is how it works in practice:</p>
<ul>
<li><b>Equality by value:</b> two value objects are equal when all their attributes are equal — you override equals/hashCode (or use a record/data class) to compare fields, not references.</li>
<li><b>Immutable:</b> once constructed it never changes. To "change" a value you create a new one — <code>money.add(fee)</code> returns a new <code>Money</code> rather than mutating in place, exactly like adding to a number.</li>
<li><b>Self-validating:</b> it enforces its invariants in the constructor, so an invalid value object cannot exist — a <code>Money</code> rejects a null currency, an <code>Email</code> rejects a malformed string.</li>
</ul>
<pre>// Money value object: immutable, self-validating, equality by value
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (amount.scale() &gt; currency.defaultFractionDigits())
            throw new IllegalArgumentException("too many decimal places for " + currency);
        if (amount.compareTo(BigDecimal.ZERO) &lt; 0)
            throw new IllegalArgumentException("amount cannot be negative");
    }

    public static final Money ZERO = new Money(BigDecimal.ZERO, Currency.getInstance("USD"));

    public Money add(Money other) {
        requireSameCurrency(other);
        return new Money(amount.add(other.amount), currency); // new instance, never mutate
    }

    public Money subtract(Money other) {
        requireSameCurrency(other);
        return new Money(amount.subtract(other.amount), currency);
    }

    private void requireSameCurrency(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException("cannot mix " + currency + " and " + other.currency);
    }
}</pre>` },
    { title: `Why they are worth it`, body: `<p>Value objects replace "primitive obsession" — passing amounts as bare <code>BigDecimal</code> and currencies as <code>String</code> — with types that carry meaning and rules. Benefits compound: an <code>Money</code> value object makes it impossible to add USD to EUR by accident, centralizes rounding, and makes method signatures self-documenting (<code>debit(Money amount)</code> not <code>debit(BigDecimal, String)</code>). Immutability makes them <b>free to share and inherently thread-safe</b> — no defensive copying, no synchronization, no risk that some other holder mutates the value under you. And behavior naturally attaches: <code>DateRange.overlaps(other)</code> lives on the value object instead of being duplicated across services.</p>` },
    { title: `Modeling and persistence`, body: `<p>Look for value objects wherever a concept is really "a bundle of attributes with rules": Money, Address, DateRange, GeoCoordinate, Percentage, an identifier wrapper like <code>WalletId</code>. They typically live <em>inside</em> aggregates as fields of entities. Persistence-wise they are usually <b>embedded</b> in the owning entity's row/columns (or serialized), not given their own table with a surrogate key — giving a value object a database identity quietly turns it back into an entity. The main mistakes: making them mutable (then equality and sharing break), and skipping constructor validation so invalid values slip into the domain.</p>
<pre>// Identifier wrapper: type-safe, no primitive obsession
public record PaymentId(String value) {
    public PaymentId {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("paymentId required");
    }
}

// JPA embeddable — no separate table, no surrogate key
@Embeddable
public record EmbeddableMoney(
    @Column(name = "amount_minor") long amountMinor,
    @Column(name = "currency_code") String currencyCode
) {
    public Money toDomain() {
        Currency c = Currency.getInstance(currencyCode);
        return new Money(
            BigDecimal.valueOf(amountMinor, c.getDefaultFractionDigits()), c);
    }
}

// Payment entity embeds Money columns directly
@Entity
class PaymentEntity {
    @Embedded private EmbeddableMoney total;
}</pre>` },
  ],
  figures: [
    { id: "vo", svg: VO_SVG, caption: "Entities are compared by identity and may change; value objects are immutable, have no ID, and are compared by their attributes." },
  ],
  related: ["aggregate-root", "repository-pattern", "layered-architecture"],
});

export const meta = topic.meta;
export const content = topic.content;
