import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Sixa',
  description: 'The terms that govern your use of the Sixa on-chain assistant.',
};

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-28 pb-24">
        <p className="section-label">sixa · terms</p>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Terms of Service</h1>
        <p className="text-secondary text-sm mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-secondary">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. What Sixa does</h2>
            <p>
              Sixa is an AI assistant that helps you understand, simulate, and execute on-chain actions. It parses natural
              language, shows you the parsed intent, simulates the transaction, and — when you approve — relays execution
              through KeeperHub. Sixa is a coordination layer; it is not your custodian.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. No custody; you stay in control</h2>
            <p>
              We never hold, store, or control your private keys. Any on-chain action is only possible when you
              explicitly connect your wallet and approve it. Your assets remain in your wallet and under your control at
              all times.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Beta and experimental features</h2>
            <p>
              Some capabilities — including cross-chain bridge routing — are in beta. They may fail, produce unexpected
              results, or change without notice. Always review the simulated transaction and intended result before
              approving anything on-chain.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Risks you accept</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Transactions on decentralized networks are irreversible once confirmed.</li>
              <li>Prices, gas estimates, and route selections are informational and can change.</li>
              <li>LLM-generated explanations may contain errors — treats them as guidance, not financial advice.</li>
              <li>You are responsible for verifying the network, amounts, and recipients before approving.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable use</h2>
            <p>
              You agree not to use Sixa for illegal activity, to attack or disrupt the service, or to attempt to execute
              transactions you do not have the authority to make. Accounts abusing the service (for example, spamming the
              API or launching attacks) may be rate-limited or blocked.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. No warranties / liability</h2>
            <p>
              Sixa is provided “as is” without warranties of any kind, express or implied. To the maximum extent
              permitted by law, we are not liable for any losses — including smart-contract losses, bridge failures,
              market movements, or transit errors — that result from your use of the service. Nothing here is financial
              advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Contact</h2>
            <p>
              Questions? Email <a href="mailto:hello@sixa.xyz" className="underline underline-offset-2 hover:text-foreground">hello@sixa.xyz</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}