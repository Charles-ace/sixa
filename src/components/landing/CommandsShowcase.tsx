'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const commands = [
  { text: 'Aave liquidation snapshot for 0x48f…, budget $0.05', desc: 'Brokered on KeeperHub listings' },
  { text: 'swap 100 USDC → ETH', desc: 'Best-route token swaps' },
  { text: 'bridge 500 USDC → Base', desc: 'Cross-chain moves (beta)' },
  { text: 'stake my ETH', desc: 'Staking, protocol selected for you' },
  { text: 'stablecoin yield comparison', desc: 'Marketplace jobs, quoted in USDC' },
  { text: 'watch my portfolio, alert me if it drops 20%', desc: 'Autonomous workflows, wired by the agent' },
];

export function CommandsShowcase() {
  return (
    <section id="commands" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">sixa · goals</p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-5"
        >
          What you can broker.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-secondary max-w-2xl leading-relaxed mb-12"
        >
          Everything a DeFi dashboard can do — expressed as a goal with a budget.
          Sixa brokers it against the live KeeperHub marketplace and shows you the
          full lifecycle before anything moves.
        </motion.p>

        <div className="rounded-2xl border border-black/10 bg-white divide-y divide-black/[0.06] overflow-hidden">
          {commands.map((cmd, index) => (
            <motion.div
              key={cmd.text}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="group flex items-center gap-4 px-6 py-4.5 hover:bg-background transition-colors cursor-default"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-full border border-black/10 bg-background/60 flex items-center justify-center">
                <span className="text-xs font-mono text-secondary">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <code className="block text-sm font-mono mb-0.5">{cmd.text}</code>
                <p className="text-sm text-secondary truncate">{cmd.desc}</p>
              </div>
              <span className={cn(
                'text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border flex-shrink-0',
                'text-success border-success/30 bg-success/5'
              )}>
                supported
              </span>
              <ArrowUpRight className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
