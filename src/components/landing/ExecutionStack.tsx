'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const stack = [
  { layer: 'Frontend', file: 'Next.js 15 · App Router', does: 'Chat interface, wallet, portfolio, audit panel', state: 'Live' },
  { layer: 'Wallet Provider', file: 'EIP-1193 · viem', does: 'MetaMask & EVM wallet session, balances, networks', state: 'Live' },
  { layer: 'LLM', file: 'OpenRouter · llama 3.1', does: 'Explains intents in natural language', state: 'Live' },
  { layer: 'Intent Parser', file: 'sixa/intent-parser.ts', does: 'Maps sentences → swap / bridge / stake / portfolio', state: 'Live' },
  { layer: 'Simulation', file: 'keeperhub/simulate.ts', does: 'Revert checks, gas estimate, slippage, warnings', state: 'Live' },
  { layer: 'Execution', file: 'keeperhub/relay.ts', does: 'Smart gas, private routing, broadcast, audit log', state: 'Demo relay' },
];

const STATE_COLORS: Record<string, string> = {
  Live: 'text-success border-success/30 bg-success/5',
  'Demo relay': 'text-foreground border-black/20 bg-black/5',
};

export function ExecutionStack() {
  return (
    <section id="stack" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-mono uppercase tracking-wider text-secondary mb-3">
          sixa · stack
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight mb-12"
        >
          The execution stack.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-black/10 bg-white overflow-hidden"
        >
          <div className="hidden md:grid grid-cols-[180px_220px_1fr_120px] gap-4 px-6 py-3.5 border-b border-black/10 text-[11px] font-mono uppercase tracking-wider text-secondary">
            <span>Layer</span>
            <span>File</span>
            <span>What it does</span>
            <span>State</span>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {stack.map((row, index) => (
              <motion.div
                key={row.layer}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, duration: 0.35 }}
                className="grid grid-cols-1 md:grid-cols-[180px_220px_1fr_120px] gap-2 md:gap-4 px-6 py-4 hover:bg-background transition-colors"
              >
                <span className="text-sm font-medium">{row.layer}</span>
                <span className="text-xs font-mono text-secondary">{row.file}</span>
                <span className="text-sm text-secondary">{row.does}</span>
                <span>
                  <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', STATE_COLORS[row.state])}>
                    {row.state}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
