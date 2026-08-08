'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function LandingCTA() {
  return (
    <section id="available" className="relative py-24 md:py-36 border-t border-black/10">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-7 flex justify-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-mono text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            live today · free to try
          </span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.02] text-balance mb-6"
        >
          Describe a goal.
          <br />
          It brokers. It executes. It verifies.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="text-secondary max-w-xl mx-auto leading-relaxed mb-10"
        >
          Your goal, brokered. Your budget, respected. A keeper, executing — then
          independently verified against KeeperHub&apos;s own status. No sign-up wall.
          No dashboard tax.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <a
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-7 py-3.5 text-sm font-medium hover:opacity-85 transition-opacity"
          >
            Open the broker <ArrowUpRight className="w-4 h-4" />
          </a>
          <Link
            href="/#mechanism"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-7 py-3.5 text-sm font-medium hover:border-black/40 transition-colors"
          >
            Read the mechanism
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
