'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrokerIntakeProps {
  onJobCreated: (jobId: string) => void;
}

const DEMO_PROMPTS = [
  { slug: 'checked-transfer-g63s', label: 'Demo listing (real third-party)', prompt: 'Run checked-transfer-g63s on Base', message: 'Run the checked-transfer workflow for address 0x3c52D0AAB5BfE5A1A3FBB365A2b7B04C5B8d1A8c, budget $0.10' },
  { slug: '', label: 'Aave liquidation snapshot', prompt: 'Get an Aave liquidation snapshot for 0x3c52D0AAB5BfE5A1A3FBB365A2b7B04C5B8d1A8c on Base, budget $0.05' },
  { slug: '', label: 'Stablecoin yield comparison', prompt: 'Compare USDC yields across Aave and Compound, budget $0.10' },
];

export function BrokerIntake({ onJobCreated }: BrokerIntakeProps) {
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState('0.10');
  const [payReal, setPayReal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [jobStarted, setJobStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configMode, setConfigMode] = useState('simulated');
  const [configNote, setConfigNote] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/broker/config')
      .then((r) => r.json())
      .then((data) => {
        setConfigMode(data.payments?.mode ?? 'simulated');
        setConfigNote(data.payments?.note ?? '');
      })
      .catch(() => setConfigMode('simulated'));
  }, []);

  const handleSubmit = useCallback(async (text?: string, forcedSlug?: string | null) => {
    const trimmed = (text ?? message).trim();
    if (!trimmed || isRunning) return;

    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/broker/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          budgetUsdc: Number(budget) || undefined,
          payMode: payReal ? 'real' : 'simulated',
          ...(forcedSlug ? { forcedSlug } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Job creation failed');
      setMessage('');
      setJobStarted(true);
      onJobCreated(data.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Job creation failed');
    } finally {
      setIsRunning(false);
    }
  }, [message, budget, payReal, isRunning, onJobCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-background" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Intent Broker</p>
            <p className="text-xs text-secondary">Search → select → pay → verify on KeeperHub</p>
          </div>
        </div>
        <span
          className={cn(
            'px-2.5 py-1 rounded-full border text-xs font-medium shrink-0',
            configMode === 'real'
              ? 'bg-success/10 text-success border-success/25'
              : 'bg-black/5 text-foreground border-black/15'
          )}
          title={configNote}
        >
          {configMode === 'real' ? 'Real x402 payments' : 'Payments simulated'}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-[11px] text-secondary">Budget cap (USDC):</label>
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            inputMode="decimal"
            className="w-28 bg-black/[0.04] border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/25"
          />
          <label
            className={cn('flex items-center gap-1.5 text-xs ml-auto', configMode === 'real' ? 'text-secondary cursor-pointer' : 'text-secondary/60 cursor-not-allowed')}
            title={configMode === 'real' ? 'Payments will be broadcast from the configured broker wallet' : 'Real payments are unavailable: BROKER_PAYER_PRIVATE_KEY is not configured on this deployment'}
          >
            <input type="checkbox" checked={payReal && configMode === 'real'} disabled={configMode !== 'real'} onChange={(e) => setPayReal(e.target.checked)} className="accent-foreground disabled:cursor-not-allowed" />
            request real x402 payment
          </label>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Try "Get an Aave liquidation snapshot for 0x… on Base, budget $0.05"'
            rows={2}
            className="w-full bg-black/[0.04] border border-border rounded-xl pl-4 pr-14 py-3.5 text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25 focus:border-transparent resize-none transition-all"
            disabled={isRunning}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={!message.trim() || isRunning}
            className="absolute right-2 bottom-2 p-2.5 rounded-lg bg-foreground text-background hover:shadow-lg hover:shadow-black/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_PROMPTS.map((demo) => (
            <button
              key={demo.label}
              disabled={isRunning}
              onClick={() => void handleSubmit(demo.prompt, demo.slug || null)}
              className="px-3 py-1.5 rounded-full text-xs text-secondary hover:text-foreground bg-black/[0.04] border border-border hover:border-black/30 hover:bg-black/5 transition-all disabled:opacity-40"
            >
              {demo.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-xs text-error"
            >
              {error}
            </motion.p>
          )}
          {isRunning && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-secondary flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Dispatching broker job…
            </motion.p>
          )}
          {jobStarted && !isRunning && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-secondary flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Job running — live lifecycle updates below.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}