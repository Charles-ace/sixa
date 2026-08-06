'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Shield, ShieldOff, Zap } from 'lucide-react';
import type { ParsedIntent, SimulationResult } from '@/lib/types';
import { ACTION_LABELS } from '@/lib/intent-parser';
import { Button } from '@/components/ui/Button';

interface TransactionPreviewProps {
  intent: ParsedIntent;
  simulation: SimulationResult;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

export function TransactionPreview({ intent, simulation, onConfirm, onCancel, isExecuting = false }: TransactionPreviewProps) {
  const action = ACTION_LABELS[intent.type];
  const amount = intent.params?.amount;
  const from = intent.params?.fromToken ?? '—';
  const to = intent.params?.toToken ?? '—';
  const isLive = !simulation.simulated;
  const blocked = !simulation.success || Boolean(simulation.unsupported);

  const rows: { label: string; value: string }[] = [
    { label: 'Action', value: action },
    { label: 'Amount', value: amount ? `${amount} ${from}` : from },
    ...(simulation.from ? [{ label: 'From (org wallet)', value: `${simulation.from.slice(0, 8)}…${simulation.from.slice(-6)}` }] : []),
    ...(simulation.to ? [{ label: 'To', value: `${simulation.to.slice(0, 8)}…${simulation.to.slice(-6)}` }] : []),
    ...(intent.type === 'swap' && to ? [{ label: 'Receive', value: to }] : []),
    ...(intent.type === 'bridge' && intent.params?.targetChain ? [{ label: 'Destination', value: intent.params.targetChain }] : []),
    ...(intent.type === 'stake' && intent.params?.protocol ? [{ label: 'Protocol', value: intent.params.protocol }] : []),
    ...(simulation.gasEstimateUnits
      ? [{ label: 'Gas estimate', value: `${simulation.gasEstimateUnits} units${simulation.gasEstimateUsd != null ? ` (≈ $${simulation.gasEstimateUsd.toFixed(2)})` : ''}` }]
      : simulation.gasEstimateUsd != null
        ? [{ label: 'Estimated gas', value: `$${simulation.gasEstimateUsd.toFixed(2)}` }]
        : []),
    ...(simulation.congestion
      ? [{ label: 'Network congestion', value: simulation.congestion === 'unknown' ? 'Not exposed by provider' : simulation.congestion }]
      : []),
    ...(simulation.strategy ? [{ label: 'Gas strategy', value: simulation.strategy }] : []),
    { label: 'Outcome', value: simulation.expectedOutcome || '—' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-2xl border border-black/15 bg-background overflow-hidden my-3"
      role="region"
      aria-label="Transaction preview"
    >
      <div className="px-5 py-3 border-b border-black/10 bg-black/[0.03] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">Transaction Preview</span>
        </div>
        <div className="flex items-center gap-2">
          {simulation.protectedExecution ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20 flex items-center gap-1" title="Writes relay through KeeperHub infrastructure">
              <Check className="w-3 h-3" /> Protected execution: enabled
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/25 flex items-center gap-1" title="No KeeperHub API key configured">
              <ShieldOff className="w-3 h-3" /> Protected execution: disabled
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-secondary flex-shrink-0">{row.label}</span>
              <span className="text-foreground text-right font-medium">{row.value}</span>
            </div>
          ))}
        </div>

        {simulation.unsupported && (
          <div className="mt-4 flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/25 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{simulation.unsupported.message}</p>
              {simulation.unsupported.suggestion && <p className="mt-1">{simulation.unsupported.suggestion}</p>}
            </div>
          </div>
        )}

        {simulation.wouldRevert && simulation.revertReason && (
          <div className="mt-4 flex items-start gap-2 text-xs text-error bg-error/10 border border-error/25 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Simulation would revert: {simulation.revertReason}</p>
              {simulation.errorCode && <p className="mt-1 font-mono">code: {simulation.errorCode}</p>}
            </div>
          </div>
        )}

        {simulation.warnings.length > 0 && !simulation.unsupported && (
          <div className="mt-4 space-y-2">
            {simulation.warnings.map((warning) => (
              <div key={warning} className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {warning}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-secondary bg-black/[0.04] border border-border rounded-lg px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
          {isLive
            ? 'Simulation ran on chain via KeeperHub — dry-run only, nothing broadcast. Writes relay through KeeperHub infrastructure.'
            : 'DEV SIMULATION — no real transaction. Set KEEPERHUB_API_KEY for live execution.'}
        </div>
      </div>

      <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={onConfirm}
          disabled={isExecuting || blocked}
          loading={isExecuting}
        >
          {simulation.simulated ? 'Simulate Execute (dev)' : 'Confirm & Execute'}
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" onClick={onCancel} disabled={isExecuting}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
