'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BrokerIntake } from '@/components/broker/BrokerIntake';
import { BrokerJobView } from '@/components/broker/BrokerJobView';
import { BrokerAuditLog } from '@/components/broker/BrokerAuditLog';

export default function BrokerPage() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleJobCreated = useCallback((jobId: string) => {
    setActiveJobId(jobId);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Intent Broker</h1>
          <p className="text-secondary mt-2 max-w-2xl">
            Describe a goal in plain language. Sixa discovers live KeeperHub marketplace listings, selects the best fit
            within your budget cap, settles the x402 payment, executes, and independently verifies the outcome against
            KeeperHub&apos;s own execution status — every step recorded in the audit trail.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground border border-black/15 rounded-xl px-4 py-2 hover:bg-black/5 transition-colors"
              >
                Chat
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

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <BrokerIntake onJobCreated={handleJobCreated} />
          </motion.div>

          {activeJobId && (
            <>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <BrokerJobView jobId={activeJobId} active onRefresh={handleRefresh} />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                <BrokerAuditLog jobId={activeJobId} refreshKey={refreshKey} />
              </motion.div>
            </>
          )}

          {!activeJobId && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl p-8 text-center"
            >
              <p className="text-sm text-secondary">
                No job running yet — ask for a workflow from the marketplace and watch the lifecycle update live.
              </p>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}