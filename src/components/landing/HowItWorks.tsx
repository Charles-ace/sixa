'use client';

import { motion } from 'framer-motion';
import { MessageSquare, BrainCircuit, PlayCircle, Rocket, ScrollText } from 'lucide-react';

const pipeline = [
  { icon: MessageSquare, label: 'Sentence', detail: '"swap 100 USDC to ETH"' },
  { icon: BrainCircuit, label: 'Intent', detail: 'parsed · swap · 100 USDC → ETH' },
  { icon: PlayCircle, label: 'Simulate', detail: 'revert-checked · gas $0.42' },
  { icon: Rocket, label: 'Execute', detail: 'KeeperHub relay · private route' },
  { icon: ScrollText, label: 'Audit', detail: 'hash logged · searchable' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-mono uppercase tracking-wider text-secondary mb-3">
          sixa · pipeline
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight mb-5"
        >
          One pipeline. Five stages.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-secondary max-w-2xl leading-relaxed mb-12"
        >
          Every command moves through the same verified path. Each stage is visible
          in the app — nothing executes silently.
        </motion.p>

        <div className="flex flex-col lg:flex-row items-stretch gap-4">
          {pipeline.map((stage, index) => (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="flex-1 relative"
            >
              {index < pipeline.length - 1 && (
                <div
                  className="hidden lg:block absolute top-1/2 right-[-14px] w-7 h-px bg-black/20 z-10"
                  aria-hidden="true"
                />
              )}
              <div className="h-full rounded-2xl border border-black/10 bg-white px-6 py-6 hover:border-black/30 transition-colors">
                <p className="font-mono text-[11px] uppercase tracking-wider text-secondary mb-4">
                  {String(index + 1).padStart(2, '0')} · {stage.label}
                </p>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <stage.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{stage.label}</span>
                </div>
                <p className="text-sm text-secondary font-mono">{stage.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
