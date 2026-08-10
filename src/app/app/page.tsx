'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BrokerIntake } from '@/components/broker/BrokerIntake';
import { BrokerJobView } from '@/components/broker/BrokerJobView';

export default function AppPage() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleJobCreated = useCallback((jobId: string) => {
    setActiveJobId(jobId);
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
        </motion.div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <BrokerIntake onJobCreated={handleJobCreated} />
          </motion.div>

          {activeJobId && (
            <>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <BrokerJobView jobId={activeJobId} active />
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