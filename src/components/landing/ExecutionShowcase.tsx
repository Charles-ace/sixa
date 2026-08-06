'use client';

import { motion } from 'framer-motion';
import { Brain, Wrench, PlayCircle, Fuel, ShieldCheck, Rocket, CheckCircle2, Lock, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const timeline = [
  { icon: Brain, label: 'AI understood request', detail: 'swap: 100 USDC → ETH', delay: 0.15 },
  { icon: Wrench, label: 'Building transaction', detail: 'Uniswap V3 · exactInput', delay: 0.3 },
  { icon: PlayCircle, label: 'Running simulation', detail: 'simulation passed · 0 reverts', delay: 0.45 },
  { icon: Fuel, label: 'Smart gas selected', detail: '$0.42 · MEV-aware', delay: 0.6 },
  { icon: ShieldCheck, label: 'Private routing enabled', detail: 'no public mempool exposure', delay: 0.75 },
  { icon: Rocket, label: 'Executing through KeeperHub', detail: 'broadcast secure', delay: 0.9 },
  { icon: CheckCircle2, label: 'Transaction confirmed', detail: '0x3f9a…c21e', delay: 1.05 },
];

const pillars = [
  { icon: Fuel, title: 'Smart Gas Estimation', description: 'Real-time gas pricing with MEV protection built in.' },
  { icon: Lock, title: 'Private Routing', description: 'Transactions stay out of the public mempool.' },
  { icon: PlayCircle, title: 'Simulation First', description: 'Every tx is reverted-checked before broadcast.' },
  { icon: ScrollText, title: 'Audit Trail', description: 'Immutable log of every execution, searchable.' },
];

export function ExecutionShowcase() {
  return (
    <section id="execution" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-mono uppercase tracking-wider text-secondary mb-3">
          sixa · execution
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mb-5"
        >
          Execution you can watch, trust, and verify.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-secondary max-w-2xl leading-relaxed mb-12"
        >
          KeeperHub powers the execution layer — smart gas, private routing, simulation,
          and a permanent audit trail.
        </motion.p>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-black/10 bg-white p-7"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-sm">Live execution timeline</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/25">
                ● Running
              </span>
            </div>

            <div className="space-y-1">
              {timeline.map((step, index) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: step.delay, duration: 0.35 }}
                  className="flex items-start gap-3 py-2"
                >
                  <div className="relative flex-shrink-0">
                    <div className={cn(
                      'w-8 h-8 rounded-lg border flex items-center justify-center',
                      index === timeline.length - 1
                        ? 'bg-success/10 border-success/40 text-success'
                        : 'bg-black/5 border-black/15'
                    )}>
                      {index === timeline.length - 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
                    </div>
                    {index < timeline.length - 1 && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-9 bottom-[-8px] w-px bg-black/10" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className="text-sm">{step.label}</p>
                    <p className="text-xs text-secondary font-mono mt-0.5">{step.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            {pillars.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="rounded-2xl border border-black/10 bg-white p-5 hover:border-black/30 transition-colors flex items-start gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center">
                  <pillar.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-1">{pillar.title}</h3>
                  <p className="text-sm text-secondary">{pillar.description}</p>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl border border-black/10 bg-background p-5"
            >
              <p className="text-sm font-medium mb-1.5">Security model</p>
              <p className="text-sm text-secondary leading-relaxed">
                Non-custodial by design. Sixa never holds keys — it prepares, simulates, and routes
                transactions you authorize. KeeperHub handles execution with private relay infrastructure.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
