// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const topic = makeTopic({
  id: "test-doubles",
  title: "Test Doubles",
  category: "lld-testing",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Dummy, stub, spy, mock, and fake — five distinct stand-ins for real collaborators, each answering a different testing question.`,
  sections: [
    { title: `A vocabulary, not synonyms`, body: `<p>"Mock" is used colloquially for any stand-in, but Gerard Meszaros's taxonomy names <b>five distinct kinds</b> of test double, and the distinctions matter because they change what your test actually asserts. A double replaces a real collaborator (a database, a gateway client, a clock) so the unit under test runs in isolation.</p>
<table>
<tr><td><b>Dummy</b></td><td>Passed only to satisfy a signature; never used. E.g. a no-op logger you must supply but never call.</td></tr>
<tr><td><b>Stub</b></td><td>Returns canned answers to calls made during the test. Provides <em>indirect input</em>.</td></tr>
<tr><td><b>Spy</b></td><td>A stub that also records how it was called, so the test can inspect calls afterward.</td></tr>
<tr><td><b>Mock</b></td><td>Pre-programmed with expectations; it fails the test itself if the expected calls do not happen.</td></tr>
<tr><td><b>Fake</b></td><td>A real working implementation, just lighter — e.g. an in-memory repository instead of Postgres.</td></tr>
</table>` },
    { title: `How Mockito implements stubs, mocks, and spies`, body: `<p><b>Mockito</b> is the standard Java library for behaviour verification. Here is how each double type works in a payment charge flow:</p>
<pre>import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChargeServiceTest {

    @Mock PaymentGateway gateway;          // mock: behaviour verification
    @Mock ExchangeRateService rates;       // stub: canned return value
    @Spy OutboxPublisher outbox = new OutboxPublisher();  // spy: real object, call tracking
    @InjectMocks ChargeService chargeService;

    @Test
    void charge_convertsCurrencyAndRecordsLedger() {
        // STUB — provide indirect input
        when(rates.usdToEur(anyLong())).thenReturn(0.92);

        ChargeRequest request = new ChargeRequest(
            "pay-001", "wallet-42", new Money(10000, "USD"), PaymentMethod.CARD);

        when(gateway.charge(request)).thenReturn(
            new ChargeResult("pay-001", ChargeStatus.CAPTURED, "stripe_pi_abc"));

        ChargeResult result = chargeService.charge(request);

        // STATE verification — assert on outcome
        assertEquals(ChargeStatus.CAPTURED, result.status());

        // MOCK behaviour verification — gateway called exactly once
        verify(gateway, times(1)).charge(request);
        verify(gateway, never()).refund(any());

        // SPY — outbox actually ran, and we inspect the call
        verify(outbox).publish(argThat(evt -&gt;
            evt.type().equals("PaymentCaptured") &amp;&amp;
            evt.paymentId().equals("pay-001")));
    }
}</pre>
<p>The deepest split is <b>what you assert on</b>. Stubs and fakes support <b>state verification</b>: you drive the system, then assert on the resulting value or stored state. Mocks and spies support <b>behavior verification</b>: you assert that a particular <em>interaction</em> occurred — that <code>gateway.charge()</code> was called exactly once with this amount.</p>` },
    { title: `Fakes and dummies in practice`, body: `<p>When a collaborator has rich behaviour you depend on — a repository, a cache — a <b>fake</b> (in-memory implementation) usually gives more robust, less brittle tests than a mock bristling with expectations:</p>
<pre>// FAKE — real working in-memory wallet repository
public class InMemoryWalletRepository implements WalletRepository {
    private final Map&lt;String, Wallet&gt; store = new ConcurrentHashMap&lt;&gt;();

    @Override
    public Optional&lt;Wallet&gt; findById(String walletId) {
        return Optional.ofNullable(store.get(walletId));
    }

    @Override
    public void debit(String walletId, long amountCents) {
        Wallet wallet = store.computeIfAbsent(walletId, Wallet::new);
        if (wallet.balanceCents() &lt; amountCents) {
            throw new InsufficientFundsException(walletId);
        }
        store.put(walletId, wallet.withBalance(wallet.balanceCents() - amountCents));
    }
}

@Test
void charge_debitsWalletOnCapture() {
    WalletRepository repo = new InMemoryWalletRepository();
    repo.save(new Wallet("wallet-42", 50000L));
    ChargeService service = new ChargeService(
        new FakePaymentGateway(), repo, new NoOpOutbox());

    service.charge(new ChargeRequest("pay-002", "wallet-42",
        new Money(10000, "USD"), PaymentMethod.CARD));

    assertEquals(40000L, repo.findById("wallet-42").orElseThrow().balanceCents());
}</pre>
<pre>// DUMMY — satisfies constructor, never invoked
public final class NoOpAuditLogger implements AuditLogger {
    @Override public void log(String event) { /* intentionally empty */ }
}

ChargeService service = new ChargeService(gateway, repo, outbox, new NoOpAuditLogger());</pre>` },
    { title: `Choosing the right double`, body: `<p>Prefer the <b>least powerful double that still expresses your intent</b>. If you only need a value back, use a stub. If the whole point of the test is that a side effect happened (an event was published, a row was written), a mock or spy on that boundary is appropriate. When a collaborator has rich behavior you depend on — a repository, a cache — a <b>fake</b> usually gives more robust, less brittle tests than a mock bristling with expectations.</p>
<p><b>Over-mocking</b> is the common failure: tests that mock every collaborator end up asserting the implementation's call sequence rather than its behavior, so they break on every harmless refactor while missing real bugs. A useful rule: mock the boundaries you own the contract for (gateway, broker), and fake or use real objects for pure domain logic. In the payment flow, stub the exchange-rate lookup, fake the wallet repository, and mock the outbox publisher whose call is the actual thing under test.</p>` },
  ],
  related: ["unit-integration-contract", "tdd-for-lld", "dependency-injection"],
});

export const meta = topic.meta;
export const content = topic.content;
