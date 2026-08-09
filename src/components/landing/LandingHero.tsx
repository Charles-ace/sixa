'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowUpRight, ShieldCheck, PlayCircle, ScrollText, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LetterReveal } from '@/components/landing/LetterReveal';

const TRUST_ROW = [
  { icon: ShieldCheck, label: 'Non-custodial' },
  { icon: PlayCircle, label: 'Simulated first' },
  { icon: ScrollText, label: 'Audit trail' },
  { icon: Zap, label: 'KeeperHub relay' },
];

export function LandingHero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  const tiltX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });

  const handleTiltMove = (e: React.MouseEvent) => {
    const rect = tiltRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(px * 12);
    tiltY.set(py * 12);
  };

  const handleTiltLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-16">
          <motion.div style={{ y: textY }} className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-7"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-mono text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                sixa · intent broker · keeperhub marketplace
              </span>
            </motion.div>

            <LetterReveal
              className="mb-7"
              phraseTop="Describe a goal."
              words={['discover listings', 'select the best', 'settle x402', 'execute', 'verify']}
              phraseBottom="It executes."
            />

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-lg text-secondary max-w-xl leading-relaxed mb-9"
            >
              Describe a goal. Sixa searches the live KeeperHub marketplace, picks the listing
              that fits your budget, settles the x402 payment, executes the job, and verifies the
              outcome — independently, end to end. One sentence in, a verified result out.
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
                onClick={() => router.push('/signin')}
              >
                Open the broker
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full lg:w-[420px] flex-shrink-0"
          >
            <motion.div style={{ y: mockupY, opacity: mockupOpacity }}>
              <motion.div
                ref={tiltRef}
                onMouseMove={handleTiltMove}
                onMouseLeave={handleTiltLeave}
                whileHover={{ scale: 1.015 }}
                transition={{ scale: { type: 'spring', stiffness: 260, damping: 20 } }}
                style={{ x: tiltX, y: tiltY }}
                className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05),0_24px_56px_-20px_rgba(0,0,0,0.28)]"
              >
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                className="px-4 py-3 border-b border-black/10 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-xs font-mono text-secondary">
                  <Image
                    src="/sixa-logo.svg"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                  sixa · broker
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 text-foreground border border-black/10 flex items-center gap-1.5">
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-success"
                    animate={{ opacity: [1, 0.35, 1], scale: [1, 1.35, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  keeperhub marketplace · live
                </span>
              </motion.div>

              <div className="p-4 space-y-3">
                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground text-background px-4 py-2.5 text-sm">
                    Aave liquidation snapshot for 0x48f… on Base, budget $0.05
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="rounded-xl border border-black/10 bg-background/60 p-3.5 font-mono text-[12px] leading-relaxed text-foreground space-y-2"
                >
                  {[
                    <p key="h" className="flex items-center gap-1.5 text-secondary">
                      <Sparkles className="w-3 h-3" />
                      broker job dispatched
                    </p>,
                    <p key="a" className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      discovered 3 live listings
                    </p>,
                    <p key="b" className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      selected checked-transfer-g63s · $0.04
                    </p>,
                    <p key="c" className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      x402 paid · 0.05 USDC
                    </p>,
                    <p key="d" className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      executed · independently verified
                    </p>,
                    <p key="e" className="text-secondary">audit logged · searchable</p>,
                  ].map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 1.05 + i * 0.14, ease: 'easeOut' }}
                    >
                      {line}
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 2.0 }}
                className="px-4 pb-4 flex items-center gap-2"
              >
                <div className="flex-1 rounded-full border border-black/10 bg-background/60 px-4 py-2.5 text-sm text-muted flex items-center gap-1">
                  describe a goal, set a budget…
                  <motion.span
                    className="inline-block w-[5px] h-[13px] rounded-full bg-foreground/60"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 2.15 }}
                  className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center flex-shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </motion.span>
              </motion.div>
            </motion.div>

            <div className="mt-4 px-1 flex items-center justify-between">
              <p className="text-[11px] font-mono text-muted">
                live listings · x402 settled · verified
              </p>
              <p className="text-[11px] font-mono text-muted">budget cap · audit trail</p>
            </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}