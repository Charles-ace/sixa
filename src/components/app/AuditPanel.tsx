'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Copy, Check, History } from 'lucide-react';
import type { AuditEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AuditPanelProps {
  entries: AuditEntry[];
}

export function AuditPanel({ entries }: AuditPanelProps) {
  const [search, setSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const filtered = entries.filter((entry) =>
    entry.action.toLowerCase().includes(search.toLowerCase()) ||
    entry.execution.txHash.toLowerCase().includes(search.toLowerCase()) ||
    entry.wallet.toLowerCase().includes(search.toLowerCase())
  );

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-medium text-foreground">Execution Audit Trail</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-foreground border border-black/15">
              {entries.length}
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, hash, or wallet…"
            className="w-full bg-black/[0.04] border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <History className="w-8 h-8 text-secondary mx-auto mb-3" />
            <p className="text-sm text-secondary">
              {entries.length === 0 ? 'No executions yet. Try a command like "Swap 100 USDC to ETH".' : 'No results found.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            <AnimatePresence initial={false}>
              {filtered.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-5 py-4 hover:bg-black/[0.02] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        entry.execution.status === 'success' ? 'bg-success' : 'bg-error'
                      )} />
                      <span className="text-sm font-medium text-foreground">{entry.action}</span>
                      <span className="text-xs text-secondary">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      entry.execution.status === 'success'
                        ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-error/10 text-error border border-error/20'
                    )}>
                      {entry.execution.status === 'success' ? 'Success' : 'Failed'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary font-mono">
                    <span>{entry.wallet.slice(0, 8)}…{entry.wallet.slice(-4)}</span>
                    <span>{entry.simulation.expectedOutcome}</span>
                    {entry.execution.gasCostUsd != null && (
                      <span>Gas: ${entry.execution.gasCostUsd.toFixed(2)}</span>
                    )}
                    {entry.execution.simulated && (
                      <span className="text-warning">DEV SIMULATION</span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => copyHash(entry.execution.txHash)}
                      className="flex items-center gap-1.5 text-xs text-foreground hover:text-foreground transition-colors font-mono group"
                      title="Copy transaction hash"
                    >
                      {copiedHash === entry.execution.txHash ? (
                        <><Check className="w-3.5 h-3.5 text-success" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> {entry.execution.txHash.slice(0, 12)}…{entry.execution.txHash.slice(-8)}</>
                      )}
                    </button>
                    <a
                      href={entry.execution.transactionLink ?? `https://etherscan.io/tx/${entry.execution.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-secondary hover:text-foreground transition-colors"
                    >
                      View on explorer ↗
                    </a>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
