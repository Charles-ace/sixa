'use client';

import { motion } from 'framer-motion';
import { Layers, ArrowUpRight } from 'lucide-react';
import type { WalletPortfolio, TokenBalance } from '@/lib/chain';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { SUPPORTED_NETWORKS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PortfolioCardProps {
  portfolio?: WalletPortfolio;
  onSwitchNetwork?: (chainId: number) => void;
  chainId: number;
  compact?: boolean;
}

function TokenRow({ token, index }: { token: TokenBalance; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center justify-between py-2.5 border-b border-black/[0.06] last:border-0"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center text-xs font-bold text-foreground">
          {token.symbol.slice(0, 4)}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{token.symbol}</p>
          <p className="text-xs text-secondary">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-foreground font-mono tabular-nums">
          ${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-secondary">≈ ${token.usdValue}</p>
      </div>
    </motion.div>
  );
}

export function PortfolioCard({ portfolio, chainId, onSwitchNetwork, compact = false }: PortfolioCardProps) {
  if (!portfolio) {
    return (
      <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl p-6 text-center">
        <Layers className="w-8 h-8 text-secondary mx-auto mb-3" />
        <p className="text-sm text-secondary">Connect your wallet to see your portfolio.</p>
      </div>
    );
  }

  const allTokens: TokenBalance[] = [
    { symbol: portfolio.nativeSymbol, balance: portfolio.nativeBalance, usdValue: portfolio.nativeUsdValue, change24h: 0 },
    ...portfolio.tokens,
  ].filter((t) => t.balance > 0);

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-medium text-foreground">Portfolio</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20">
              {portfolio.chainName}
            </span>
          </div>
        </div>

        {!compact && (
          <div className="mb-4">
            <p className="text-xs text-secondary mb-1">Total Value</p>
            <AnimatedCounter
              value={portfolio.totalUsd}
              prefix="$"
              duration={1600}
              className="text-3xl font-bold text-foreground font-mono tabular-nums"
            />
            <p className="text-xs text-success mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Live on-chain balances
            </p>
          </div>
        )}

        {!compact && onSwitchNetwork && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SUPPORTED_NETWORKS.map((net) => (
              <button
                key={net.chainId}
                onClick={() => onSwitchNetwork(net.chainId)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  net.chainId === chainId
                    ? 'bg-black/10 border-black/20 text-foreground'
                    : 'bg-black/[0.04] border-border text-secondary hover:text-foreground hover:border-black/30'
                )}
              >
                {net.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 pt-2">
        <div className="max-h-72 overflow-y-auto">
          {allTokens.map((token, i) => (
            <TokenRow key={token.symbol} token={token} index={i} />
          ))}
          {allTokens.length === 0 && (
            <p className="text-sm text-secondary py-6 text-center">No balances found on this network.</p>
          )}
        </div>
      </div>
    </div>
  );
}
