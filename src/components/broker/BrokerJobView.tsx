'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ArrowRight, ScrollText, ExternalLink, Wallet } from 'lucide-react';
import { encodeFunctionData, parseAbi } from 'viem';
import { cn } from '@/lib/utils';
import { isNativeAsset } from '@/lib/broker/types';
import { BrokerAuditLog } from '@/components/broker/BrokerAuditLog';
import type { BrokerJob, JobStatus } from '@/lib/broker/types';

const STEPS: JobStatus[] = ['intake', 'discovering', 'selecting', 'quoting', 'paying', 'awaiting_payment', 'executing', 'verifying'];

const STEP_LABELS: Record<string, string> = {
  intake: 'Intake',
  discovering: 'Discover',
  selecting: 'Select',
  quoting: 'Quote',
  paying: 'Pay',
  awaiting_payment: 'Approve',
  executing: 'Execute',
  verifying: 'Verify',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  intake: 'Parsing intent',
  discovering: 'Searching the marketplace',
  selecting: 'Selecting listing',
  quoting: 'Requesting x402 quote',
  paying: 'Settling payment',
  awaiting_payment: 'Awaiting your payment approval',
  executing: 'Running workflow',
  verifying: 'Verifying execution',
  completed: 'Completed',
  failed: 'Failed',
};

const TRANSFER_ABI = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

export function BrokerJobView({ jobId, active }: { jobId: string; active?: boolean }) {
  const [job, setJob] = useState<BrokerJob | null>(null);
  const [notFound, setNotFound] = useState(false);
  const notFoundRef = useRef(false);
  const lastSignature = useRef<string>('');
  const misses = useRef(0);
  const [payState, setPayState] = useState<{ status: 'idle' | 'signing' | 'submitting' | 'error'; error?: string }>({ status: 'idle' });
  const [serverDown, setServerDown] = useState(false);
  const netFails = useRef(0);
  const serverDownRef = useRef(false);
  const [animatedActiveIndex, setAnimatedActiveIndex] = useState(0)

  const payFromWallet = useCallback(async () => {
    const quote = job?.quote;
    if (!quote) return;
    const eth = window.ethereum;
    if (!eth) {
      setPayState({ status: 'error', error: 'No EVM wallet detected. Install MetaMask or another wallet.' });
      return;
    }
    try {
      setPayState({ status: 'signing' });
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const from = accounts[0];
      if (!from) throw new Error('No account selected in your wallet.');

      const isMainnet = quote.network === 'eip155:8453' || quote.network === '8453' || quote.network === 'base';
      const targetChainIdNum = isMainnet ? 8453 : 84532;
      const targetChainHex = `0x${targetChainIdNum.toString(16)}`;

      try {
        const currentChainHex = (await eth.request({ method: 'eth_chainId' })) as string;
        if (parseInt(currentChainHex, 16) !== targetChainIdNum) {
          try {
            await eth.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetChainHex }],
            });
          } catch (switchErr: any) {
            if (switchErr?.code === 4902 || switchErr?.message?.includes('Unrecognized chain')) {
              await eth.request({
                method: 'wallet_addEthereumChain',
                params: isMainnet ? [{
                  chainId: '0x2105',
                  chainName: 'Base Mainnet',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }] : [{
                  chainId: '0x14a34',
                  chainName: 'Base Sepolia',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://sepolia.base.org'],
                  blockExplorerUrls: ['https://sepolia.basescan.org'],
                }],
              });
            } else {
              throw switchErr;
            }
          }
        }
      } catch (netErr: any) {
        throw new Error(`Please switch your wallet network to Base ${isMainnet ? 'Mainnet' : 'Sepolia'} (Chain ID ${targetChainIdNum}) to proceed.`);
      }

      const native = isNativeAsset(quote.asset);
      let assetAddress = quote.asset;
      if (!native && !isMainnet && quote.asset.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') {
        assetAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
      }

      const txParams = native
        ? { from, to: quote.payTo, data: '', value: `0x${BigInt(quote.amountUnits).toString(16)}` }
        : {
            from,
            to: assetAddress,
            data: encodeFunctionData({
              abi: TRANSFER_ABI,
              functionName: 'transfer',
              args: [quote.payTo as `0x${string}`, BigInt(quote.amountUnits)],
            }),
            value: '0x0',
          };
      const txHash = (await eth.request({ method: 'eth_sendTransaction', params: [txParams] })) as string;
      setPayState({ status: 'submitting' });
      const res = await fetch(`/api/broker/jobs/${job?.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, from, job }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Payment confirmation failed');
      }
      setPayState({ status: 'idle' });
    } catch (err) {
      setPayState({ status: 'error', error: err instanceof Error ? err.message.split('\n')[0] : 'Payment failed' });
    }
  }, [job]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/broker/jobs/${jobId}`, { signal: AbortSignal.timeout(12000) });
      if (res.status === 404) {
        misses.current += 1;
        if (misses.current >= 30 && !notFoundRef.current) {
          notFoundRef.current = true;
          setNotFound(true);
        }
        return;
      }
      misses.current = 0;
      if (notFoundRef.current) {
        notFoundRef.current = false;
        setNotFound(false);
      }
      netFails.current = 0;
      if (serverDownRef.current) {
        serverDownRef.current = false;
        setServerDown(false);
      }
      const data = await res.json();
      const next = data.job as BrokerJob | undefined;
      if (!next) return;
      const signature = `${next.updatedAt}:${next.status}:${JSON.stringify(next.payment ?? next.execution ?? null)}`;
      if (signature !== lastSignature.current) {
        lastSignature.current = signature;
        setJob(next);
      }
    } catch {
      netFails.current += 1;
      if (netFails.current >= 8 && !serverDownRef.current) {
        serverDownRef.current = true;
        setServerDown(true);
      }
      if (serverDownRef.current) {
        setServerDown(true);
      }
    }
  }, [jobId]);

  useEffect(() => {
    if (job?.status === 'completed' || job?.status === 'failed') return;
    const id = setInterval(() => void poll(), 3000);
    return () => clearInterval(id);
  }, [poll, job?.status]);

  const targetActiveIndex = job && STEP_LABELS[job.status] ? STEPS.indexOf(job.status) : -1;

  useEffect(() => {
    if (targetActiveIndex < 0) return;
    if (animatedActiveIndex < targetActiveIndex) {
      const timer = setTimeout(() => {
        setAnimatedActiveIndex((prev) => Math.min(prev + 1, targetActiveIndex));
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [targetActiveIndex, animatedActiveIndex]);

  if (notFound) {
    return (
      <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl p-8 text-center space-y-4">
        <p className="text-sm text-secondary">
          This job is not reachable right now — the server lost it (scheduled restart or redeploy). If it persists, create a new job.
        </p>
        <button
          onClick={() => {
            misses.current = 0;
            notFoundRef.current = false;
            setNotFound(false);
            void poll();
          }}
          className="px-4 py-2 text-xs font-medium bg-foreground text-background rounded-xl hover:opacity-85 transition-all"
        >
          Try reconnecting
        </button>
      </div>
    );
  }

  if (serverDown) {
    return (
      <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl border-error/20 p-8 text-center space-y-4">
        <p className="text-sm text-secondary">
          The server is unreachable right now — the deployment may be restarting or scaled to zero.
        </p>
        <button
          onClick={() => {
            netFails.current = 0;
            serverDownRef.current = false;
            setServerDown(false);
            void poll();
          }}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-surface border border-border text-primary hover:bg-surface/80 transition-colors"
        >
          Retry Connection
        </button>
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

  const activeIndex = animatedActiveIndex;
  const statusLabel = job.status === 'awaiting_payment'
    ? (job as any).pendingFallback || !job.quote
      ? 'Awaiting fallback authorization'
      : STATUS_LABELS.awaiting_payment
    : STATUS_LABELS[job.status] ?? job.status;
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
        {job.status === 'awaiting_payment' && job.quote && !(job as any).pendingFallback && (
          <div className="rounded-xl bg-black/[0.04] border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-foreground" />
              <p className="text-sm font-medium text-foreground">Approve the x402 payment from your wallet</p>
            </div>
            <p className="text-xs text-secondary mb-1">
              Send{' '}
              <span className="font-mono text-foreground">
                {job.quote.amountUsdc} {isNativeAsset(job.quote.asset) ? 'ETH' : 'USDC'}
              </span>{' '}
              to{' '}
              <span className="font-mono text-foreground">
                {job.quote.payTo.slice(0, 8)}…{job.quote.payTo.slice(-6)}
              </span>{' '}
              from the wallet you approve in MetaMask. Gas is paid by your wallet (~$0.02).
            </p>
            <button
              onClick={() => void payFromWallet()}
              disabled={payState.status === 'signing' || payState.status === 'submitting'}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-85 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {payState.status === 'signing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Waiting for wallet approval…
                </>
              ) : payState.status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying on-chain receipt…
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" /> Approve & send {job.quote.amountUsdc} {isNativeAsset(job.quote.asset) ? 'ETH' : 'USDC'}
                </>
              )}
            </button>
            {payState.status === 'error' && (
              <p className="mt-2 text-xs text-error">{payState.error}</p>
            )}
          </div>
        )}

        {job.status === 'awaiting_payment' && ((job as any).pendingFallback || !job.quote) && (
          <div className="rounded-xl bg-black/[0.04] border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <ScrollText className="w-4 h-4 text-foreground" />
              <p className="text-sm font-medium text-foreground">Authorize Fallback Workflow Execution</p>
            </div>
            <p className="text-xs text-secondary mb-3">
              No existing marketplace listing matched your query. A fallback workflow has been constructed. Please review and give explicit authorization before execution starts.
            </p>
            <button
              onClick={async () => {
                setPayState({ status: 'submitting' });
                try {
                  const res = await fetch(`/api/broker/jobs/${job.id}/resume`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ job }),
                  });
                  if (!res.ok) {
                    let errMsg = `HTTP ${res.status}`;
                    try {
                      const body = await res.json();
                      errMsg = body.error ? `${body.error} (${body.code})` : errMsg;
                    } catch {}
                    throw new Error(errMsg);
                  }
                  setPayState({ status: 'idle' });
                } catch (err) {
                  setPayState({ status: 'error', error: err instanceof Error ? err.message : 'Failed to authorize fallback execution.' });
                }
              }}
              disabled={payState.status === 'submitting'}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-85 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {payState.status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authorizing workflow…
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" /> Authorize & Execute Fallback Workflow
                </>
              )}
            </button>
            {payState.status === 'error' && (
              <p className="mt-2 text-xs text-error">{payState.error}</p>
            )}
          </div>
        )}

        <div>
          <p className="text-sm text-foreground mb-1">{job.spec.goal}</p>
          <p className="text-xs text-muted-foreground">
            Budget cap ${job.spec.budgetUsdc.toFixed(2)} · max per call ${(job.spec.maxPriceUsdc ?? 0).toFixed(2)} ·{' '}
            {job.spec.chainId ? `chain ${job.spec.chainId}` : 'any chain'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STEPS.map((step, i) => {
            const isActive = i === activeIndex && job.status !== 'completed' && job.status !== 'failed';
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
            <div className="flex items-center justify-between mb-1">
              <p className={cn('font-medium', job.payment.mode === 'simulated' ? 'text-warning' : 'text-success')}>
                {job.payment.mode === 'simulated' ? '🧪 Simulated x402 payment' : 'Real x402 payment executed'}
              </p>
              {job.payment.mode === 'real' && job.payment.receipt && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
                  ✓ RECEIPT CONFIRMED
                </span>
              )}
            </div>
            <p className="text-secondary font-mono">
              ${job.payment.amountUsdc.toFixed(2)} USDC → {job.payment.payTo.slice(0, 10)}…{job.payment.payTo.slice(-6)}
            </p>
            {job.payment.mode === 'simulated' && (
              <p className="mt-1 text-warning/80">No on-chain transaction — this spend did not happen.</p>
            )}
            {job.payment.txHash && job.payment.mode === 'real' && (
              <>
                <p className="mt-1 font-mono text-success break-all">tx {job.payment.txHash}</p>
                {job.payment.receipt && (
                  <div className="mt-2 space-y-1 font-mono text-[11px] text-secondary">
                    <p>
                      block {job.payment.receipt.blockNumber} · {job.payment.receipt.confirmations} conf · status {job.payment.receipt.status}
                    </p>
                    <p>
                      recipient match: <span className={job.payment.receipt.matches.recipient ? 'text-success' : 'text-error'}>{job.payment.receipt.matches.recipient ? 'yes' : 'NO'}</span> · amount match:{' '}
                      <span className={job.payment.receipt.matches.amount ? 'text-success' : 'text-error'}>{job.payment.receipt.matches.amount ? 'yes' : 'NO'}</span>
                    </p>
                    <a
                      href={`https://basescan.org/tx/${job.payment.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-success underline decoration-success/40 underline-offset-2"
                    >
                      View on BaseScan <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {job.execution && (
          <div
            className={cn(
              'rounded-xl border p-3.5 text-xs',
              job.execution.verified || (job.status === 'completed' && !job.execution.failed)
                ? 'border-success/25 bg-success/5'
                : job.execution.simulated
                  ? 'border-warning/25 bg-warning/5'
                  : job.execution.failed
                    ? 'border-error/25 bg-error/5'
                    : 'border-border bg-black/[0.04]'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-secondary font-medium">Execution &amp; verification</p>
              <span
                className={cn(
                  'font-medium',
                  job.execution.simulated
                    ? 'text-warning'
                    : job.execution.verified || (job.status === 'completed' && !job.execution.failed)
                      ? 'text-success'
                      : job.execution.failed
                        ? 'text-error'
                        : 'text-primary'
                )}
              >
                {job.execution.simulated
                  ? 'SIMULATED'
                  : job.execution.verified
                    ? 'INDEPENDENTLY VERIFIED'
                    : job.status === 'completed' && !job.execution.failed
                      ? 'WORKFLOW LAUNCHED & RUNNING'
                      : job.execution.failed || job.status === 'failed'
                        ? 'UNVERIFIED'
                        : 'EXECUTING'}
              </span>
            </div>
            {job.execution.executionId && (
              <p className="text-secondary font-mono">exec {job.execution.executionId}</p>
            )}
            {job.decision?.workflow_id && (
              <div className="mt-1">
                <a
                  href={`https://app.keeperhub.com/workflows/${job.decision.workflow_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline hover:opacity-80 font-mono"
                >
                  View Workflow on KeeperHub ({job.decision.workflow_id}) <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {job.proof?.execution_tx_hash && (
              <div className="mt-1">
                <a
                  href={`${job.spec.demoMode || job.decision?.source === 'generated_fallback' ? 'https://sepolia.basescan.org' : 'https://basescan.org'}/tx/${job.proof.execution_tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-success underline hover:opacity-80 font-mono"
                >
                  View Execution Tx on BaseScan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
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

        <BrokerAuditLog jobId={job.id} />
      </div>
    </div>
  );
}