// @article-v2
import { makeTopic } from "../../shared/topicFactory.js";

const PACT_SVG = `<svg viewBox="0 0 620 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Consumer-driven contract flow">
  <defs><marker id="fig-consumer-driven-contracts-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b9dff"/></marker></defs>
  <rect x="20" y="55" width="130" height="46" rx="8" fill="#1a2236" stroke="#5b9dff" stroke-width="1.6"/>
  <text x="85" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Consumer</text>
  <text x="85" y="91" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Order Service</text>
  <rect x="245" y="55" width="130" height="46" rx="8" fill="#1a2236" stroke="#7c5cff" stroke-width="1.6"/>
  <text x="310" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Pact broker</text>
  <text x="310" y="91" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">stores contract</text>
  <rect x="470" y="55" width="130" height="46" rx="8" fill="#1a2236" stroke="#3ddc97" stroke-width="1.6"/>
  <text x="535" y="75" text-anchor="middle" fill="#cdd6e8" font-size="11" font-family="system-ui">Provider</text>
  <text x="535" y="91" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">Wallet Service</text>
  <line x1="150" y1="70" x2="243" y2="70" stroke="#5b9dff" stroke-width="1.4" marker-end="url(#fig-consumer-driven-contracts-arr)"/>
  <text x="196" y="60" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">publish pact</text>
  <line x1="470" y1="86" x2="377" y2="86" stroke="#3ddc97" stroke-width="1.4" marker-end="url(#fig-consumer-driven-contracts-arr)"/>
  <text x="423" y="118" text-anchor="middle" fill="#93a1bd" font-size="9" font-family="system-ui">verify against real handler</text>
</svg>`;

const topic = makeTopic({
  id: "consumer-driven-contracts",
  title: "Consumer-Driven Contracts",
  category: "lld-testing",
  track: "lld",
  tier: "essential",
  archetype: "pattern",
  oneliner: `Consumers record exactly the requests and responses they depend on; providers verify those expectations in their own build — catching breaking changes without a shared environment.`,
  figures: [
    { id: "pact-flow", svg: PACT_SVG, caption: "The consumer generates a pact and publishes it; the provider replays it against its real handler during its own build." },
  ],
  sections: [
    { title: `The integration-test problem it solves`, body: `<p>When Order Service calls Wallet Service over HTTP, how do you know a Wallet deploy will not break Order? Spinning up both services in one end-to-end environment is slow, flaky, and scales badly as services multiply. <b>Consumer-Driven Contracts (CDC)</b>, popularized by <b>Pact</b>, replace that with two independent tests that share a recorded <em>contract</em> — so neither side needs the other running to be verified.</p>
<p>The name captures the key inversion: the <b>consumer</b> defines the contract. It declares only the fields and responses it actually uses, so providers are free to add anything else without breaking anyone.</p>` },
    { title: `Structure and flow`, figureAfter: "pact-flow", body: `<p>The workflow has two halves connected by a stored artifact (the <em>pact</em>):</p>
<ol>
<li><b>Consumer side.</b> In the consumer's unit test, a mock provider stands in for Wallet. The test says "given a wallet with balance 500, when I <code>GET /wallets/42</code>, expect 200 with <code>{balance: 500}</code>." Running it both tests the consumer against that stub <em>and</em> records the interaction as a pact file.</li>
<li><b>Publish.</b> The pact is uploaded to a <b>Pact broker</b>, versioned by consumer and git commit.</li>
<li><b>Provider side.</b> Wallet's build fetches the pact and <b>replays each recorded request against its real handler</b>, asserting the real response matches what the consumer expects. If Wallet renamed <code>balance</code> to <code>amount</code>, its own build goes red.</li>
</ol>
<p>Because verification runs inside each service's pipeline, a provider learns it broke a consumer <em>before</em> deploying — with <code>can-i-deploy</code> gating the release on all consumer pacts passing.</p>` },
    { title: `Pact consumer test in Java`, body: `<p>Order Service needs the wallet balance before placing a charge. The consumer test exercises <code>OrderService</code> against a Pact mock server and records the interaction:</p>
<pre>import au.com.dius.pact.consumer.MockServer;
import au.com.dius.pact.consumer.dsl.PactDslWithProvider;
import au.com.dius.pact.consumer.junit5.PactConsumerTestExt;
import au.com.dius.pact.consumer.junit5.PactTestFor;
import au.com.dius.pact.core.model.RequestResponsePact;
import au.com.dius.pact.core.model.annotations.Pact;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(PactConsumerTestExt.class)
class WalletClientPactTest {

    @Pact(consumer = "order-service", provider = "wallet-service")
    RequestResponsePact getWalletBalance(PactDslWithProvider builder) {
        return builder
            .given("wallet 42 exists with balance 50000")
            .uponReceiving("a request for wallet balance before charge")
                .path("/wallets/42")
                .method("GET")
            .willRespondWith()
                .status(200)
                .body("{\"walletId\":\"42\",\"balanceCents\":50000,\"currency\":\"USD\"}")
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "getWalletBalance")
    void orderService_readsBalanceFromWallet(MockServer mockServer) {
        WalletClient client = new WalletClient(mockServer.getUrl());
        WalletBalance balance = client.getBalance("42");

        assertEquals(50000L, balance.balanceCents());
        assertEquals("USD", balance.currency());
    }
}</pre>
<p>The test proves Order Service parses the response correctly <em>and</em> writes a pact JSON file describing exactly what it needs from Wallet.</p>` },
    { title: `Provider verification and what CDC is not`, body: `<p>On the Wallet Service side, the provider test replays the pact against the real Spring controller — no mock, no stub:</p>
<pre>import au.com.dius.pact.provider.junit5.HttpTestTarget;
import au.com.dius.pact.provider.junit5.PactVerificationContext;
import au.com.dius.pact.provider.junit5.PactVerificationInvocationContextProvider;
import au.com.dius.pact.provider.junitsupport.Provider;
import au.com.dius.pact.provider.junitsupport.State;
import au.com.dius.pact.provider.junitsupport.loader.PactBroker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@Provider("wallet-service")
@PactBroker(url = "https://pact-broker.internal")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ExtendWith(PactVerificationInvocationContextProvider.class)
class WalletProviderPactTest {

    @LocalServerPort int port;

    @BeforeEach
    void setTarget(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    @State("wallet 42 exists with balance 50000")
    void seedWallet() {
        walletRepository.save(new Wallet("42", 50000L, "USD"));
    }

    @TestTemplate
    void verifyPactAgainstRealHandler(PactVerificationContext context) {
        context.verifyInteraction();
    }
}</pre>
<p>CDC verifies the <b>shape and semantics of the interaction</b> — endpoints, fields, status codes, and provider states ("given a wallet exists"). It does <em>not</em> test business correctness end to end; a pact can pass while both sides agree on a wrong behaviour. Treat it as protection against accidental breaking changes, not as a substitute for the provider's own domain tests.</p>
<p>Use CDC for internal service-to-service calls where you control both sides. For third-party APIs you cannot influence, or public APIs with many unknown consumers, CDC fits poorly — there you rely on versioning and schema tests instead. Keep contracts lean: only assert on fields the consumer truly reads, or you re-create the brittleness CDC was meant to remove.</p>` },
  ],
  related: ["unit-integration-contract", "api-versioning-strategies", "contract-first-vs-code-first"],
});

export const meta = topic.meta;
export const content = topic.content;
