'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ShieldCheck, PlayCircle, ScrollText, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const TRUST_ROW = [
  { icon: ShieldCheck, label: 'Non-custodial' },
  { icon: PlayCircle, label: 'Simulated first' },
  { icon: ScrollText, label: 'Audit trail' },
  { icon: Zap, label: 'KeeperHub relay' },
];

export function LandingHero() {
  const router = useRouter();
  return (
    <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-16">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-7"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-mono text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                sixa · AI on-chain execution · keeperhub
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.98] text-balance mb-7">
              <span className="block">Ask anything.</span>
              <span className="block">It executes.</span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-lg text-secondary max-w-xl leading-relaxed mb-9"
            >
              Sixa is an AI agent that parses plain-language requests, simulates the
              transaction, and executes through KeeperHub. No dashboards. No protocol
              hopscotch. One sentence in, one signed transaction out.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10"
            >
              <Button
                size="lg"
                className="gap-2"
                onClick={() => router.push('/app')}
              >
                Launch the app
                <ArrowUpRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-secondary"
                onClick={() => document.getElementById('mechanism')?.scrollIntoView({ behavior: 'smooth' })}
              >
                How it works ↓
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap items-center gap-x-6 gap-y-3"
            >
              {TRUST_ROW.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5 text-[13px] text-secondary">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full lg:w-[420px] flex-shrink-0"
          >
            <div className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)]">
              <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono text-secondary">
                  <span className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center">
                    <span className="text-[9px] font-bold leading-none">S</span>
                  </span>
                  sixa · chat
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 text-foreground border border-black/10">
                  keeperhub · live
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground text-background px-4 py-2.5 text-sm">
                    swap 100 USDC to ETH
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-background/60 p-3.5 font-mono text-[12px] leading-relaxed text-foreground space-y-2">
                  <p className="flex items-center gap-1.5 text-secondary">
                    <Sparkles className="w-3 h-3" />
                    intent parsed
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    swap · 100 USDC → ETH · best route
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    simulated · 0 reverts · gas $0.42
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    executed via keeperhub
                  </p>
                  <p className="text-secondary">0x3f9a…c21e · audit logged</p>
                </div>
              </div>

              <div className="px-4 pb-4 flex items-center gap-2">
                <div className="flex-1 rounded-full border border-black/10 bg-background/60 px-4 py-2.5 text-sm text-muted">
                  ask anything, privately…
                </div>
                <span className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
            </div>

            <div className="mt-4 px-1 flex items-center justify-between">
              <p className="text-[11px] font-mono text-muted">
                autopilot · round-up +$0.73 · DCA $50/w
              </p>
              <p className="text-[11px] font-mono text-muted">dip −3% → buy</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
