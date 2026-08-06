'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AIChatDemo } from '@/components/ai-chat/AIChatDemo';
import { cn } from '@/lib/utils';

export function AIChatSection() {
  return (
    <section
      id="demo"
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      aria-labelledby="demo-title"
    >
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-pink-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="space-y-8">
            <SectionTitle
              id="demo-title"
              title="Talk to Sixa"
              subtitle="Natural language interface for complex DeFi operations. No dashboards, no complexity — just tell it what you want."
              align="left"
              className="mb-4"
            />

            <div className="space-y-4">
              {[
                { icon: Sparkles, text: 'Understands complex intent: "Move idle USDC to safest yield above 6%"' },
                { icon: ArrowRight, text: 'Explains reasoning: APY, TVL, audits, risk score, gas estimates' },
                { icon: Sparkles, text: 'One-click execution: Simulates, optimizes gas, executes atomically' },
                { icon: ArrowRight, text: 'Learns preferences: Risk tolerance, favorite chains, rebalance thresholds' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <p className="text-secondary text-sm leading-relaxed pt-1">{item.text}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="pt-4"
            >
              <GlassPanel variant="subtle" padding="md" className="border border-indigo-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Ready to optimize?</p>
                    <p className="text-sm text-secondary">Connect your wallet and let Sixa analyze your portfolio</p>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <AIChatDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}