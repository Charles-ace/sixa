'use client';

import { motion } from 'framer-motion';
import { Search, Shield, Zap, ArrowRight } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Analyze Portfolio',
    description: 'AI scans your wallet positions, identifies idle assets, and maps your current yield exposure across all supported protocols and chains.',
    details: ['Real-time balance detection', 'Cross-chain portfolio view', 'Idle asset identification', 'Current APY analysis'],
  },
  {
    number: '02',
    icon: Shield,
    title: 'Evaluate Risk',
    description: 'Our AI compares TVL, audit scores, historical reliability, liquidity depth, and smart contract risk across 50+ protocols to score every opportunity.',
    details: ['TVL & liquidity analysis', 'Audit & security scoring', 'Historical depeg events', 'Protocol maturity index'],
  },
  {
    number: '03',
    icon: Zap,
    title: 'Optimize & Execute',
    description: 'Execute transactions securely with simulation, gas optimization, and atomic execution. Set it and forget it with auto-rebalancing.',
    details: ['Transaction simulation', 'Gas-optimized routing', 'Atomic execution', 'Auto-rebalancing'],
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      aria-labelledby="how-it-works-title"
    >
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <SectionTitle
          id="how-it-works-title"
          title="How It Works"
          subtitle="Three steps to optimal yield. No complexity, no compromise."
          className="mb-16 lg:mb-20"
        />

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <motion.article
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassPanel variant="default" padding="lg" hover className="h-full relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <span className="text-xs font-mono text-indigo-400 font-medium">{step.number}</span>
                      <h3 className="mt-1 text-xl font-bold text-foreground">{step.title}</h3>
                    </div>
                  </div>

                  <p className="text-secondary leading-relaxed">{step.description}</p>

                  <ul className="space-y-3" role="list">
                    {step.details.map((detail, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        className="flex items-center gap-3 text-sm text-secondary hover:text-foreground/80 transition-colors group"
                      >
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, delay: 0.3 + i * 0.08 }}
                          className="w-5 h-5 rounded-full border border-indigo-500/50 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/10 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </motion.span>
                        <span>{detail}</span>
                      </motion.li>
                    ))}
                  </ul>

                  <div className="pt-4 border-t border-white/10">
                    <motion.button
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors group"
                    >
                      Learn more
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </motion.button>
                  </div>
                </div>
              </GlassPanel>
            </motion.article>
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className="absolute bottom-0 right-0 w-72 h-72 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl"
            aria-hidden="true"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2 }}
          className="mt-20 text-center"
        >
          <Button size="lg" variant="secondary" className="gap-2" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
            See It In Action
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}