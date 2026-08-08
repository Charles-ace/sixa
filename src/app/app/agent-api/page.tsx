'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AgentApiKeys } from '@/components/agent/AgentApiKeys';
import { AgentApiPlayground } from '@/components/agent/AgentApiPlayground';

export default function AgentApiPage() {
  const [playingKey, setPlayingKey] = useState('');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Agent API</h1>
          <p className="text-secondary mt-2 max-w-2xl">
            Talk to the Sixa agent programmatically. Issue a scoped API key, then <span className="font-mono text-xs">POST /api/agent</span>{' '}
            with your message and an <span className="font-mono text-xs">Authorization: Bearer</span> header — the agent parses intents,
            explains the plan, and runs on your KeeperHub account.
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
              href="/app/broker"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground border border-black/15 rounded-xl px-4 py-2 hover:bg-black/5 transition-colors"
            >
              Intent Broker
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6 lg:sticky lg:top-24"
          >
            <AgentApiKeys
              onKeyCreated={(key) => setPlayingKey(key)}
              onKeyInvalidated={() => setPlayingKey('')}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <AgentApiPlayground apiKey={playingKey} />
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}