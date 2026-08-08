'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ArrowRight, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrokerJob, JobStatus } from '@/lib/broker/types';

const STEPS: JobStatus[] = ['intake', 'discovering', 'selecting', 'quoting', 'paying', 'executing', 'verifying'];

const STEP_LABELS: Record<string, string> = {
  intake: 'Intake',
  discovering: 'Discover',
  selecting: 'Select',
  quoting: 'Quote',
  paying: 'Pay',
  executing: 'Execute',
  verifying: 'Verify',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  intake: 'Parsing intent',
  discovering: 'Searching the marketplace',
  selecting: 'Selecting listing',
  quoting: 'Requesting x402 quote',
  paying: 'Settling payment',
  executing: 'Running workflow',
  verifying: 'Verifying execution',
  completed: 'Completed',
  failed: 'Failed',
};

const TERMINAL: JobStatus[] = ['completed', 'failed'];

export function BrokerJobView({ jobId, onRefresh, active }: { jobId: string; onRefresh: () => void; active?: boolean }) {
  const [job, setJob] = useState<BrokerJob | null>(null);
  const [notFound, setNotFound] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/broker/jobs/${jobId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setJob(data.job);
      if (data.job && TERMINAL.includes(data.job.status)) {
        onRefresh();
      }
    } catch {
      // transient network error — keep polling
    }
  }, [jobId, onRefresh]);

  useEffect(() => {
    const id = setInterval(() => void poll(), 1500);
    return () => clearInterval(id);
  }, [poll]);

  if (notFound) {
    return (
      <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl p-8 text-center">
        <p className="text-sm text-secondary">This job is no longer available (in-memory store).</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-secondary mx-auto mb-3" />
        <p className="text-sm text-secondary">Loading job…</p>
      </div>
    );
  }

  const activeIndex = STEP_LABELS[job.status] ? STEPS.indexOf(job.status) : -1;
  const statusLabel = STATUS_LABELS[job.status];
  const stepDone = (i: number) => i < activeIndex || job.status === 'completed';

  return (
    <div className={cn('rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden', active && 'ring-2 ring-foreground/20')}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-medium text-foreground">Broker Job</h3>
          <span className="text-xs font-mono text-secondary">{job.id.slice(0, 8)}</span>
        </div>
        <span
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border font-medium',
            job.status === 'completed' && 'bg-success/10 text-success border-success/25',
            job.status === 'failed' && 'bg-error/10 text-error border-error/25',
            statusLabel.startsWith('Parsing') && 'bg-black/5 text-foreground border-black/15'
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="p-5 space-y-5">
        <div>
          <p className="text-sm text-foreground mb-1">{job.spec.goal}</p>
          <p className="text-xs text-muted-foreground">
            Budget cap ${job.spec.budgetUsdc.toFixed(2)} · max per call ${(job.spec.maxPriceUsdc ?? 0).toFixed(2)} ·{' '}
            {job.spec.chainId ? `chain ${job.spec.chainId}` : 'any chain'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STEPS.map((step, i) => {
            const isActive = step === job.status;
            return (
              <div
                key={step}
                className="flex items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-medium',
                    stepDone(i) && 'bg-success/10 border-success/25 text-success',
                    isActive && 'bg-foreground text-background border-foreground',
                    !isActive && !stepDone(i) && 'bg-black/[0.04] border-border text-secondary'
                  )}
                >
                  {isActive ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : stepDone(i) ? (
                    <span className="w-3 h-3 rounded-full bg-success/70" />
                  ) : null}
                  {STEP_LABELS[step]}
                </span>
                {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-secondary/40" />}
              </div>
            );
          })}
        </div>

        {job.candidates.length > 0 && (
          <div className="rounded-xl bg-black/[0.04] border border-border p-3.5">
            <p className="text-xs text-secondary mb-2 font-medium">Candidates found ({job.candidates.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {job.candidates.slice(0, 8).map((c) => (
                <span
                  key={c.slug}
                  className={cn(
                    'text-[11px] px-2 py-1 rounded-lg border font-mono',
                    job.selected?.slug === c.slug
                      ? 'bg-success/10 border-success/25 text-success'
                      : 'bg-background/70 border-border text-secondary'
                  )}
                >
                  {c.slug} · ${c.priceUsdcPerCall.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.selected && (
          <div className="rounded-xl bg-black/[0.04] border border-border p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{job.selected.name}</p>
                <p className="text-xs text-secondary mt-0.5">{job.selected.description.slice(0, 160)}</p>
              </div>
              <span className="text-xs font-mono text-foreground shrink-0">${job.selected.priceUsdcPerCall.toFixed(2)}</span>
            </div>
            <p className="text-[11px] font-mono text-secondary mt-2">{job.selected.slug}</p>
          </div>
        )}

        {job.payment && (
          <div className={cn('rounded-xl border p-3.5 text-xs', job.payment.mode === 'simulated' ? 'border-warning/25 bg-warning/5' : 'border-success/25 bg-success/5')}>
            <p className={cn('font-medium mb-1', job.payment.mode === 'simulated' ? 'text-warning' : 'text-success')}>
              {job.payment.mode === 'simulated' ? '🧪 Simulated x402 payment' : 'Real x402 payment executed'}
            </p>
            <p className="text-secondary font-mono">
              ${job.payment.amountUsdc.toFixed(2)} USDC → {job.payment.payTo.slice(0, 10)}…{job.payment.payTo.slice(-6)}
            </p>
            {job.payment.txHash && (
              <p className="mt-1 font-mono text-success break-all">tx {job.payment.txHash}</p>
            )}
          </div>
        )}

        {job.execution && (
          <div className={cn('rounded-xl border p-3.5 text-xs', job.execution.verified ? 'border-success/25 bg-success/5' : job.execution.failed ? 'border-error/25 bg-error/5' : 'border-border bg-black/[0.04]')}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-secondary font-medium">Execution &amp; verification</p>
              <span className={cn('font-medium', job.execution.simulated ? 'text-warning' : job.execution.verified ? 'text-success' : 'text-error')}>
                {job.execution.simulated ? 'SIMULATED' : job.execution.verified ? 'INDEPENDENTLY VERIFIED' : job.execution.failed ? 'UNVERIFIED' : 'PENDING'}
              </span>
            </div>
            {job.execution.executionId && (
              <p className="text-secondary font-mono">exec {job.execution.executionId}</p>
            )}
            {job.execution.error && <p className="mt-1 text-error">{job.execution.error}</p>}
          </div>
        )}

        {job.report && (
          <div className="rounded-xl bg-black/[0.04] border border-border p-3.5 text-xs whitespace-pre-line">
            <p className="text-secondary font-medium mb-1">Final report</p>
            <p className="text-foreground font-mono">{job.report}</p>
          </div>
        )}

        {job.error && (
          <div className="rounded-xl bg-error/5 border border-error/25 p-3.5 text-xs text-error">
            {job.error}
          </div>
        )}
      </div>
    </div>
  );
}