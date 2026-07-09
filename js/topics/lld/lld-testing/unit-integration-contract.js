// @article-v2
import { makeTopic } from "../../_shared/topicFactory.js";

const PYRAMID_SVG = `<svg viewBox="0 0 460 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Test pyramid">
  <defs><marker id="fig-unit-integration-contract-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#93a1bd"/></marker></defs>
  <polygon points="210,20 320,80 100,80" fill="#1a2236" stroke="#ff6b6b" stroke-width="1.5"/>
  <text x="210" y="58" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">E2E / UI</text>
  <polygon points="100,82 320,82 370,150 50,150" fill="#1a2236" stroke="#7c5cff" stroke-width="1.5"/>
  <text x="210" y="122" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Integration + Contract</text>
  <polygon points="50,152 370,152 420,215 0,215" fill="#1a2236" stroke="#3ddc97" stroke-width="1.5"/>
  <text x="210" y="190" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Unit (the wide base)</text>
  <line x1="435" y1="30" x2="435" y2="210" stroke="#93a1bd" stroke-width="1.2" marker-end="url(#fig-unit-integration-contract-arr)"/>
  <text x="448" y="120" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui" transform="rotate(90 448 120)">slower · costlier · fewer</text>
</svg>`;

const topic = makeTopic({
  id: "unit-integration-contract",
  title: "Unit vs Integration vs Contract",
  category: "lld-testing",
  track: "lld",
  tier: "essential",
  archetype: "concept",
  oneliner: `Three test scopes — isolated logic, wired-together modules, and cross-service agreements — each catching a different class of bug.`,
  figures: [
    { id: "test-pyramid", svg: PYRAMID_SVG, caption: "The test pyramid: many fast unit tests at the base, fewer integration/contract tests, a thin cap of slow end-to-end tests." },
  ],
  sections: [
    { title: `Three scopes, three purposes`, figureAfter: "test-pyramid", body: `<p>These are not competing choices — they are <b>layers of a pyramid</b>, and a healthy suite uses all three. What differs is the <em>scope</em> each test exercises and therefore the class of bug it catches.</p>
<ul>
<li><b>Unit test</b> — exercises one class or function in isolation, with collaborators replaced by test doubles. It answers "is this piece of logic correct?" Milliseconds to run, hundreds per second.</li>
<li><b>Integration test</b> — exercises several real components wired together (your <code>ChargeService</code> against a real Postgres via Testcontainers). It answers "do these parts actually talk to each other correctly?" — SQL, transactions, serialization, connection pools.</li>
<li><b>Contract test</b> — verifies that the messages crossing a service boundary match what the other side expects, <em>without</em> booting both services together.</li>
</ul>` },
    { title: `Unit test — JUnit 5 with Mockito`, body: `<p>A <b>unit test</b> works by constructing the object under test, injecting fakes for its dependencies, calling a method, and asserting on the return value or on interactions. Because nothing touches I/O, failures point at a specific line of logic. This is the wide base of the pyramid.</p>
<pre>import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChargeServiceUnitTest {

    @Mock PaymentGateway gateway;
    @Mock LedgerRepository ledger;
    @InjectMocks ChargeService chargeService;

    @Test
    void capturedPayment_recordsLedgerDebit() {
        ChargeRequest req = new ChargeRequest(
            "pay-100", "wallet-7", new Money(2500, "USD"), PaymentMethod.CARD);
        when(gateway.charge(req)).thenReturn(
            new ChargeResult("pay-100", ChargeStatus.CAPTURED, "pi_xyz"));

        ChargeResult result = chargeService.charge(req);

        assertEquals(ChargeStatus.CAPTURED, result.status());
        verify(ledger).recordDebit("wallet-7", new Money(2500, "USD"), "pi_xyz");
        verify(ledger, never()).recordRefund(any());
    }

    @Test
    void declinedPayment_doesNotTouchLedger() {
        ChargeRequest req = new ChargeRequest(
            "pay-101", "wallet-7", new Money(2500, "USD"), PaymentMethod.CARD);
        when(gateway.charge(req)).thenReturn(
            new ChargeResult("pay-101", ChargeStatus.DECLINED, null));

        chargeService.charge(req);

        verifyNoInteractions(ledger);
    }
}</pre>` },
    { title: `Integration test — @SpringBootTest with real database`, body: `<p>An <b>integration test</b> spins up real infrastructure and checks the seams — a wrong column type, a missing index, a transaction that does not actually commit. These catch bugs unit tests structurally cannot, but they are slower and flakier, so you write far fewer of them.</p>
<pre>import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Testcontainers
class ChargeServiceIntegrationTest {

    @Container
    static PostgreSQLContainer&lt;?&gt; postgres = new PostgreSQLContainer&lt;&gt;("postgres:16")
        .withDatabaseName("payments_test");

    @DynamicPropertySource
    static void configureDb(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired ChargeService chargeService;
    @Autowired LedgerRepository ledger;
    @Autowired WalletRepository walletRepo;

    @Test
    void charge_persistsLedgerRowInSameTransaction() {
        walletRepo.save(new Wallet("wallet-7", 10000L));
        ChargeRequest req = new ChargeRequest(
            "pay-200", "wallet-7", new Money(2500, "USD"), PaymentMethod.CARD);

        chargeService.charge(req);

        LedgerEntry entry = ledger.findByPaymentId("pay-200").orElseThrow();
        assertEquals(2500L, entry.amountCents());
        assertEquals("DEBIT", entry.type());
        assertEquals(7500L, walletRepo.findById("wallet-7").orElseThrow().balanceCents());
    }
}</pre>
<p>This test proves the charge, wallet debit, and ledger write commit atomically — something Mockito cannot verify.</p>` },
    { title: `Why the pyramid shape matters`, body: `<p>The classic anti-pattern is the <b>ice-cream cone</b>: a fat layer of slow end-to-end UI tests on top and almost no unit tests. Such suites take an hour, fail intermittently on timing, and give vague diagnostics ("checkout is broken" instead of "rounding is wrong in <code>Money.split</code>"). Push assertions <em>down</em> the pyramid: prove business rules with unit tests, prove wiring with a handful of integration tests, and prove cross-service compatibility with contract tests rather than by booting the whole platform.</p>
<p>For a payment flow, that means: unit-test the fee and rounding math; integration-test that a charge actually writes a Ledger row and an outbox row in one transaction; contract-test that the messages Order Service sends match what the Wallet service parses. End-to-end smoke tests still exist, but only as a thin final check, not the foundation.</p>` },
  ],
  related: ["test-doubles", "consumer-driven-contracts", "tdd-for-lld"],
});

export const meta = topic.meta;
export const content = topic.content;
