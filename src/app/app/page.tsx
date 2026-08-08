'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';
import { ChatPanel } from '@/components/app/ChatPanel';
import { WalletCard } from '@/components/app/WalletCard';
import { PortfolioCard } from '@/components/app/PortfolioCard';
import { AuditPanel } from '@/components/app/AuditPanel';
import { AuthCard } from '@/components/app/AuthCard';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import type { AuditEntry } from '@/lib/types';

export default function AppPage() {
  const wallet = useWallet();
  const auth = useAuth();
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const handleAuditEntry = useCallback((entry: AuditEntry) => {
    setAuditEntries((prev) => [entry, ...prev]);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your on-chain assistant</h1>
          <p className="text-secondary mt-2 max-w-2xl">
            Describe any action in plain language. Sixa parses your intent, simulates the transaction,
            and executes securely through KeeperHub — with a full audit trail.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app/broker"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground border border-black/15 rounded-xl px-4 py-2 hover:bg-black/5 transition-colors"
            >
              Intent Broker — marketplace jobs
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/app/agent-api"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground border border-black/15 rounded-xl px-4 py-2 hover:bg-black/5 transition-colors"
            >
              Agent API — build with Sixa
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
          <motion.aside
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6 lg:sticky lg:top-24"
          >
            <AuthCard />
            <WalletCard
              wallet={wallet}
              onConnect={wallet.connect}
              onDisconnect={wallet.disconnect}
              onRefresh={() => wallet.address && wallet.refreshPortfolio(wallet.address, wallet.chainId)}
            />
            <PortfolioCard
              portfolio={wallet.portfolio}
              chainId={wallet.chainId}
              onSwitchNetwork={wallet.switchNetwork}
            />
          </motion.aside>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="h-[65vh] min-h-[560px]">
              <ChatPanel
                walletAddress={wallet.address}
                chainId={wallet.chainId}
                walletConnected={wallet.isConnected}
                accountAddress={auth.account?.accountAddress}
                accountEmail={auth.account?.email}
                onAuditEntry={handleAuditEntry}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <AuditPanel entries={auditEntries} />
            </motion.div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
