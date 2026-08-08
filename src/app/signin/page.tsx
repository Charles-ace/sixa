import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SignInCard } from '@/components/SignInCard';

export const metadata: Metadata = {
  title: 'Sign in — Sixa',
  description: 'Sign in to Sixa with email or Google. Your KeeperHub account is derived from your email — no wallet needed to start.',
};

export default function SignInPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-md px-6 pt-28 pb-24">
        <SignInCard />
      </main>
      <Footer />
    </div>
  );
}
