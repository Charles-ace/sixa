'use client';

import { motion } from 'framer-motion';
import { MessageSquare, BrainCircuit, PlayCircle, Rocket, ScrollText, Earth } from 'lucide-react';

const pipeline = [
  { icon: MessageSquare, label: 'Sentence', detail: '"swap 100 USDC to ETH"' },
  { icon: BrainCircuit, label: 'Intent', detail: 'parsed · swap · 100 USDC → ETH' },
  { icon: PlayCircle, label: 'Simulate', detail: 'revert-checked · gas $0.42' },
  { icon: Rocket, label: 'Execute', detail: 'KeeperHub relay · private route' },
  { icon: ScrollText, label: 'Audit', detail: 'hash logged · searchable' },
];

const TRAVEL = ['10%', '30%', '50%', '70%', '90%'];

const globeTransition = {
  left: { duration: 4.5, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' },
  top: { duration: 4.5, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' },
  opacity: { duration: 4.5, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' },
  default: { duration: 4.5, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">sixa · pipeline</p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-5"
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

        <div className="relative flex flex-col lg:flex-row items-stretch gap-4">
          <div
            className="hidden lg:block absolute inset-x-0 top-10 h-px bg-black/10"
            aria-hidden="true"
          />
          <div
            className="lg:hidden absolute left-[22px] top-6 bottom-6 w-px bg-black/10"
            aria-hidden="true"
          />

          <motion.span
            initial={{ left: '10%', opacity: 0 }}
            whileInView={{
              left: TRAVEL,
              opacity: [0, 1, 1, 1, 1, 0],
            }}
            viewport={{ once: false, amount: 0.6 }}
            transition={globeTransition}
            className="hidden lg:flex absolute top-10 -translate-x-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-white border border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.14),0_0_0_4px_rgba(14,159,110,0.12)] items-center justify-center"
            aria-hidden="true"
          >
            <Earth className="w-3 h-3 text-success" />
          </motion.span>

          <motion.span
            initial={{ top: '10%', opacity: 0 }}
            whileInView={{
              top: TRAVEL,
              opacity: [0, 1, 1, 1, 1, 0],
            }}
            viewport={{ once: false, amount: 0.6 }}
            transition={globeTransition}
            className="lg:hidden absolute left-[22px] -translate-x-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-white border border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.14),0_0_0_4px_rgba(14,159,110,0.12)] items-center justify-center flex"
            aria-hidden="true"
          >
            <Earth className="w-3 h-3 text-success" />
          </motion.span>

          {pipeline.map((stage, index) => (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="flex-1 relative"
            >
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="h-full rounded-2xl border border-black/10 bg-white px-6 py-6 card-hover"
              >
                <div className="flex items-center justify-between mb-4">
                  <motion.span
                    initial={{ opacity: 0, scale: 1.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 18,
                      delay: 0.12 + index * 0.08,
                    }}
                    className="text-2xl font-mono font-bold text-black/15"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 16,
                      delay: 0.2 + index * 0.08,
                    }}
                  >
                    <stage.icon className="w-4 h-4 text-secondary" />
                  </motion.span>
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.28 + index * 0.08 }}
                  className="text-[11px] font-mono uppercase tracking-wider text-secondary mb-2"
                >
                  {stage.label}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.36 + index * 0.08 }}
                  className="text-sm text-secondary font-mono"
                >
                  {stage.detail}
                </motion.p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
