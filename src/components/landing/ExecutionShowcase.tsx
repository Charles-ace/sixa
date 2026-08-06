'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Brain, Wrench, PlayCircle, Fuel, ShieldCheck, Rocket, CheckCircle2, Lock,
  ScrollText, ArrowUpRight, Loader2,
} from 'lucide-react';
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

const STAGE_MS = 1100;
const HOLD_MS = 1900;

const pillars = [
  { icon: Fuel, title: 'Smart Gas Estimation', description: 'Real-time gas pricing with MEV protection built in.' },
  { icon: Lock, title: 'Private Routing', description: 'Transactions stay out of the public mempool.' },
  { icon: PlayCircle, title: 'Simulation First', description: 'Every tx is reverted-checked before broadcast.' },
  { icon: ScrollText, title: 'Audit Trail', description: 'Immutable log of every execution, searchable.' },
];

export function ExecutionShowcase() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const inView = useInView(timelineRef, { once: true, margin: '-120px' });
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const run = (start: number) => {
      if (cancelled) return;
      setActiveIndex(start);
      timeout = setTimeout(() => {
        if (cancelled) return;
        if (start < timeline.length - 1) {
          run(start + 1);
        } else {
          timeout = setTimeout(() => run(0), HOLD_MS);
        }
      }, STAGE_MS);
    };

    run(0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [inView]);

  const isRunning = inView && activeIndex >= 0 && activeIndex < timeline.length;
  const progress = Math.min(((activeIndex + 1) / timeline.length) * 100, 100);

  return (
    <section id="execution" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">sixa · execution</p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-balance max-w-3xl mb-5"
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
          and a permanent audit trail.{' '}
          <a
            href="https://docs.keeperhub.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-mono text-[13px] text-foreground underline decoration-black/20 underline-offset-4 hover:decoration-foreground transition-colors"
          >
            KeeperHub docs <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </motion.p>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-black/10 bg-white p-7"
            ref={timelineRef}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-sm">Live execution timeline</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/25 flex items-center gap-1.5">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-success"
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                {isRunning ? `Running · step ${activeIndex + 1}/${timeline.length}` : 'Running'}
              </span>
            </div>

            <div className="h-1 rounded-full bg-black/5 mb-6 overflow-hidden">
              <motion.div
                className="h-full bg-success rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            <div className="space-y-1">
              {timeline.map((step, index) => {
                const isActive = isRunning && index === activeIndex;
                const isCompleted = isRunning && index < activeIndex;

                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: step.delay, duration: 0.35 }}
                    className="flex items-start gap-3 py-2"
                  >
                    <div className="relative flex-shrink-0">
                      <motion.div
                        animate={
                          isActive
                            ? { scale: [1, 1.08, 1] }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.8, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
                        className={cn(
                          'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors duration-300',
                          isCompleted
                            ? 'bg-success/10 border-success/40 text-success'
                            : isActive
                              ? 'bg-foreground border-foreground text-background shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)]'
                              : 'bg-black/5 border-black/15 text-secondary'
                        )}
                      >
                        {isActive ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <step.icon className="w-3.5 h-3.5" />
                        )}
                      </motion.div>
                      {index < timeline.length - 1 && (
                        <motion.div
                          className={cn(
                            'absolute left-1/2 -translate-x-1/2 top-9 bottom-[-8px] w-px transition-colors duration-500',
                            isCompleted || (isActive && isRunning) ? 'bg-success/40' : 'bg-black/10'
                          )}
                        />
                      )}
                    </div>
                    <div className="pt-1 flex-1 min-w-0">
                      <p className={cn(
                        'text-sm transition-colors duration-300',
                        isActive ? 'font-medium text-foreground' : isCompleted ? 'text-foreground' : 'text-secondary'
                      )}>
                        {step.label}
                      </p>
                      <p className={cn(
                        'text-xs font-mono mt-0.5 transition-colors duration-300',
                        isActive ? 'text-success' : 'text-secondary'
                      )}>
                        {step.detail}
                      </p>
                    </div>
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="mt-2 text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-foreground border border-black/10 flex-shrink-0"
                        >
                          in progress
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.2 }}
              className="mt-5 pt-4 border-t border-black/10"
            >
              <p className="text-[11px] font-mono text-muted text-center">
                auto-playing demo · a real run steps through the same stages
              </p>
            </motion.div>
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
                className="rounded-2xl border border-black/10 bg-white p-5 card-hover flex items-start gap-4"
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
