'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Wrench, PlayCircle, Fuel, ShieldCheck, Rocket, CheckCircle2,
  Loader2, X, XCircle,
} from 'lucide-react';
import type { ExecutionStage, ExecutionResult } from '@/lib/types';
import { cn } from '@/lib/utils';

const STAGE_ICONS = {
  brain: Brain,
  build: Wrench,
  simulate: PlayCircle,
  gas: Fuel,
  privacy: ShieldCheck,
  execute: Rocket,
  confirm: CheckCircle2,
} as const;

interface ExecutionTimelineProps {
  stages: ExecutionStage[];
  isRunning: boolean;
  result?: ExecutionResult;
  onClose?: () => void;
}

export function ExecutionTimeline({ stages, isRunning, result, onClose }: ExecutionTimelineProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev >= stages.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 1100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, stages.length]);

  const isDone = !isRunning && Boolean(result);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Execution timeline"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <Rocket className="w-4 h-4 text-background" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">KeeperHub Execution</h3>
              <p className="text-xs text-secondary">Live execution timeline</p>
            </div>
          </div>
          {onClose && isDone && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 text-secondary hover:text-foreground transition-colors"
              aria-label="Close timeline"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-1">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.icon] ?? Brain;
            const isActive = isRunning && index === activeIndex;
            const isCompleted = (isRunning && index < activeIndex) || (isDone && index <= stages.length - 1);
            const isFailed = result?.status === 'failed' && index === stages.length - 1;

            return (
              <div key={stage.id} className="flex items-start gap-3 py-2">
                <div className="relative flex-shrink-0">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-500',
                      isFailed
                        ? 'bg-error/15 border-error/40 text-error'
                        : isCompleted
                          ? 'bg-success/15 border-success/40 text-success'
                            : isActive
                              ? 'bg-black/10 border-black/20 text-foreground shadow-lg shadow-black/10'
                              : 'bg-black/[0.04] border-border text-secondary'
                    )}
                  >
                    {isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFailed ? (
                      <XCircle className="w-4 h-4" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  {index < stages.length - 1 && (
                    <div className={cn(
                      'absolute left-1/2 -translate-x-1/2 top-10 bottom-[-8px] w-px transition-colors duration-500',
                      index < activeIndex || isDone ? 'bg-success/40' : 'bg-black/15'
                    )} />
                  )}
                </div>
                <div className="pt-1.5">
                  <p className={cn(
                    'text-sm transition-colors duration-300',
                    isFailed ? 'text-error' : isCompleted || isActive ? 'text-foreground' : 'text-secondary'
                  )}>
                    {stage.label}
                  </p>
                  {stage.detail && (
                    <p className="text-xs text-secondary mt-0.5 font-mono">{stage.detail}</p>
                  )}
                </div>
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="ml-auto mt-2 text-[10px] px-2 py-0.5 rounded-full bg-black/10 text-foreground border border-black/15"
                    >
                      in progress
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border">
          {result ? (
            <div className={cn(
              'rounded-xl px-4 py-3 text-sm font-medium flex flex-col gap-1.5',
              result.status === 'success' ? 'bg-success/10 text-success border border-success/25' : 'bg-error/10 text-error border border-error/25'
            )}>
              <div className="flex items-center gap-2">
                {result.status === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span className="font-mono text-xs truncate" title={result.txHash}>
                  {result.status === 'success'
                    ? `${result.simulated ? 'Dev simulation' : 'Confirmed'} · ${result.txHash ? `${result.txHash.slice(0, 12)}…${result.txHash.slice(-6)}` : 'no hash'}`
                    : 'Execution failed — nothing was broadcast'}
                </span>
              </div>
              {result.error && (
                <p className="text-xs font-normal text-error/90">
                  {result.error.message}
                  {result.error.hint ? ` — ${result.error.hint}` : ''}
                </p>
              )}
              {result.status === 'success' && !result.simulated && (
                <p className="text-xs font-normal text-success/80">
                  {result.verified === false
                    ? '⚠ Receipt verification failed on-chain — check the explorer link.'
                    : 'Receipt verified on-chain.'}
                </p>
              )}
              {result.status === 'success' && result.simulated && (
                <p className="text-xs font-normal text-secondary">
                  DEV MODE — no real transaction. Configure KEEPERHUB_API_KEY for live execution.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-secondary text-center flex items-center justify-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
              Each step reflects the live provider response
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
