import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { LandingHero } from '@/components/landing/LandingHero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CommandsShowcase } from '@/components/landing/CommandsShowcase';
import { SecurityProofs } from '@/components/landing/SecurityProofs';
import { ExecutionShowcase } from '@/components/landing/ExecutionShowcase';
import { DeployStatus } from '@/components/landing/DeployStatus';
import { ExecutionStack } from '@/components/landing/ExecutionStack';
import { FAQ } from '@/components/landing/FAQ';
import { LandingCTA } from '@/components/landing/LandingCTA';

export const metadata: Metadata = {
  title: 'Sixa — AI On-Chain Execution Assistant',
  description: 'Talk to the blockchain. Sixa is an AI agent that parses natural language, simulates transactions, and executes securely through KeeperHub.',
  keywords: ['AI', 'web3', 'blockchain', 'KeeperHub', 'DeFi', 'crypto assistant', 'smart wallet'],
  openGraph: {
    title: 'Sixa — AI On-Chain Execution Assistant',
    description: 'Talk to the blockchain. Simulate, execute, audit.',
  },
};

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <main className="relative z-10">
        <LandingHero />
        <CommandsShowcase />
        <HowItWorks />
        <SecurityProofs />
        <ExecutionShowcase />
        <DeployStatus />
        <ExecutionStack />
        <FAQ />
        <LandingCTA />
      </main>

      <Footer />
    </div>
  );
}
