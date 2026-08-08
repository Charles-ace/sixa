'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const statuses = [
  {
    label: 'Live',
    accent: 'text-success border-success/30 bg-success/5',
    dot: 'bg-success',
    items: [
      'Intent Broker — discover → select → pay → execute → verify',
      'KeeperHub marketplace — live third-party listings',
      'x402 payments — real, settled in USDC',
      'Independent verification — KeeperHub execution status checked',
      'Billable by the job — budget caps, quoted per call',
      'Agent API — sk_live_ bearer keys for POST /api/agent',
      'Autonomous decision engine — approve once, run unattended',
      'Wallet connect — MetaMask & EVM',
      'Telegram + Discord alerts — wired by the agent',
      'Simulation engine — revert-checked',
      'Audit trail — searchable',
    ],
  },
  {
    label: 'In progress',
    accent: 'text-foreground border-black/20 bg-black/5',
    dot: 'bg-foreground/70',
    items: [
      'Portfolio dashboard — multi-network balances',
      'Cross-chain bridge routing',
      'Email OTP delivery — requires RESEND_API_KEY',
    ],
  },
  {
    label: 'Not live',
    accent: 'text-muted border-black/10 bg-black/[0.02]',
    dot: 'bg-black/20',
    items: [
      'Multi-signature custody',
      'Governance token',
      'Voice input',
      'Mobile app',
    ],
  },
];

export function DeployStatus() {
  return (
    <section id="status" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">sixa · status</p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-5"
        >
          What is live.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-secondary max-w-2xl leading-relaxed mb-12"
        >
          The broker runs today — marketplace listings, x402 payments, and verified execution
          flow through KeeperHub in the background. Sign-in is optional; bring a wallet or stay a guest.
        </motion.p>

        <div className="grid md:grid-cols-3 gap-px bg-black/10 border border-black/10 rounded-2xl overflow-hidden">
          {statuses.map((col, colIndex) => (
            <motion.div
              key={col.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: colIndex * 0.08 }}
              className="bg-background p-6"
            >
              <div className="mb-5">
                <span className={cn('text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border', col.accent)}>
                  {col.label}
                </span>
              </div>
              <ul className="space-y-3.5">
                {col.items.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className="flex items-start gap-2.5 text-sm text-secondary"
                  >
                    <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', col.dot)} />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
