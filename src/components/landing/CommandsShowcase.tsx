'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const commands = [
  { text: 'swap 100 USDC → ETH', desc: 'Best-route token swaps' },
  { text: 'bridge 500 USDC → Base', desc: 'Cross-chain moves' },
  { text: 'stake my ETH', desc: 'Staking, protocol selected for you' },
  { text: 'show my portfolio', desc: 'Live balances across networks' },
  { text: 'how much ETH do I have?', desc: 'Instant balance answers' },
  { text: 'what did I execute recently?', desc: 'Audit trail, one prompt' },
];

export function CommandsShowcase() {
  return (
    <section id="commands" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-mono uppercase tracking-wider text-secondary mb-3">
          sixa · commands
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight mb-5"
        >
          How you use Sixa.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-secondary max-w-2xl leading-relaxed mb-12"
        >
          Everything a DeFi dashboard can do — expressed as language. The parser maps
          each sentence to an intent, and the preview shows you exactly what it understood
          before anything moves.
        </motion.p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-black/10 border border-black/10 rounded-2xl overflow-hidden">
          {commands.map((cmd, index) => (
            <motion.div
              key={cmd.text}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-background p-6 hover:bg-white transition-colors group cursor-default"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <code className="text-sm font-mono">{cmd.text}</code>
                <span className={cn(
                  'text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0',
                  'text-success border-success/30 bg-success/5 group-hover:bg-success/10'
                )}>
                  supported
                </span>
              </div>
              <p className="text-sm text-secondary">{cmd.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
