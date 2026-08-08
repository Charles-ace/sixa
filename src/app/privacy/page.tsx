import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Sixa',
  description: 'How Sixa handles your data, keys, and execution history.',
};

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-28 pb-24">
        <p className="section-label">sixa · policy</p>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Privacy Policy</h1>
        <p className="text-secondary text-sm mb-10">Last updated: August 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-secondary">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What Sixa collects</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Your email address</strong> (when you sign in) and, if you use Google
                Sign-In, your Google profile name and picture. This is used only to create your Sixa account and derive
                your on-chain account address.
              </li>
              <li>
                <strong className="text-foreground">Wallet address and chain connections</strong> you explicitly provide in
                the app. We never hold your private keys — signing happens only via your wallet extension when you choose
                to connect it.
              </li>
              <li>
                <strong className="text-foreground">Execution history and audit trail</strong> created when you ask Sixa to
                simulate or execute actions. Transactions you approve are relayed through KeeperHub and recorded in the
                audit trail for transparency.
              </li>
              <li>
                <strong className="text-foreground">Basic technical data</strong> (IP address for abuse prevention and rate
                limiting, and standard Vercel logs) to keep the service secure and functioning.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What we never do</h2>
            <ul className="space-y-2">
              <li>We never store your wallet private keys. Assets stay in your own wallet.</li>
              <li>We never guess or infer a password for you — email sign-in uses a one-time code.</li>
              <li>We never share your data with third parties for advertising or profiling.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Where data lives</h2>
            <p>
              Chat and execution data pass through our hosting provider (Vercel) and the LLM provider used to power the
              assistant (OpenRouter). Sessions and audit rows are processed in these environments. Google authentication
              is handled by the Google OAuth infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your rights</h2>
            <p>
              You can sign out of your account at any time, which ends your session and local audit trail. To request
              deletion of your account data, contact{' '}
              <a href="mailto:hello@sixa.xyz" className="underline underline-offset-2 hover:text-foreground">hello@sixa.xyz</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <p>
              Questions about this policy? Email <a href="mailto:hello@sixa.xyz" className="underline underline-offset-2 hover:text-foreground">hello@sixa.xyz</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}