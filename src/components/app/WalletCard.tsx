'use client';

import { Wallet, Copy, Loader2, LogOut } from 'lucide-react';
import type { WalletState } from '@/hooks/useWallet';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface WalletCardProps {
  wallet: WalletState;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  compact?: boolean;
}

export function WalletCard({ wallet, onConnect, onDisconnect, onRefresh, compact = false }: WalletCardProps) {
  const shortAddress = wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : '';
  const connected = wallet.isConnected && wallet.address;

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-foreground" />
              {connected && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {connected ? wallet.walletName || 'Wallet' : 'Wallet'}
              </p>
              {connected ? (
                <p className="text-xs text-secondary font-mono">{shortAddress}</p>
              ) : (
                <p className="text-xs text-secondary">Not connected</p>
              )}
            </div>
          </div>

          {connected && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={onRefresh}
                aria-label="Refresh wallet data"
              >
                <Loader2 className={cn('w-4 h-4', wallet.isRefreshing ? 'animate-spin text-foreground' : 'text-secondary')} />
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8" aria-label="Disconnect wallet" onClick={onDisconnect}>
                <LogOut className="w-4 h-4 text-secondary hover:text-error" />
              </Button>
            </div>
          )}
        </div>

        {!connected ? (
          <button
            onClick={onConnect}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-85 active:scale-[0.98] transition-all disabled:opacity-50"
            disabled={wallet.isConnecting}
          >
            {wallet.isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {wallet.isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/[0.04] border border-border p-3">
              <p className="text-xs text-secondary mb-1">Network</p>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {wallet.chainId === 1 ? 'Ethereum' : `Chain ${wallet.chainId}`}
              </p>
            </div>
            <div className="rounded-xl bg-black/[0.04] border border-border p-3">
              <p className="text-xs text-secondary mb-1">Address</p>
              <button
                onClick={() => { navigator.clipboard.writeText(wallet.address ?? ''); }}
                className="text-sm font-mono font-medium text-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                title="Copy address"
              >
                {shortAddress}
                <Copy className="w-3 h-3 text-secondary" />
              </button>
            </div>
          </div>
        )}

        {wallet.error && (
          <p className="mt-3 text-xs text-error">{wallet.error}</p>
        )}
      </div>

      {connected && !compact && wallet.portfolio && (
        <div className="border-t border-border px-5 py-4 bg-black/[0.02]">
          <p className="text-xs text-secondary mb-1">Portfolio Value</p>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
              ${wallet.portfolio.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-secondary">{wallet.portfolio.chainName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
