'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Loader2, AlertCircle, ArrowUpRight, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { AuthCard } from '@/components/app/AuthCard';
import { WalletCard } from '@/components/app/WalletCard';
import { Button } from '@/components/ui/Button';

export function SignInCard() {
  const { authenticated, account } = useAuth();
  const router = useRouter();
  const wallet = useWallet();
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestState, setGuestState] = useState<{ status: 'idle' | 'signing' | 'error'; error: string | null }>({
    status: 'idle',
    error: null,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason') ?? params.get('auth');
    let message: string | null = null;
    if (reason === 'state_mismatch') message = 'Google sign-in failed — session state did not match. Try again.';
    else if (reason === 'not_configured') message = 'Google sign-in is not configured on this deployment.';
    else if (reason === 'access_denied') message = 'Google sign-in was cancelled.';
    else if (reason === 'success') message = null;
    else if (reason) message = 'Google sign-in failed. Try again.';
    if (message !== authError) {
      setTimeout(() => setAuthError(message), 0);
    }
  }, [authError]);

  useEffect(() => {
    if (authenticated && account) {
      const t = setTimeout(() => router.replace('/app'), 800);
      return () => clearTimeout(t);
    }
  }, [authenticated, account, router]);

  const continueAsGuest = useCallback(async () => {
    if (!wallet.address || !window.ethereum) return;
    setGuestState({ status: 'signing', error: null });
    try {
      const address = wallet.address;
      const issuedAt = new Date().toISOString();
      const message = `Sixa guest sign-in\nWallet: ${address.toLowerCase()}\nIssued at: ${issuedAt}`;
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;

      const res = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Guest sign-in failed');
      }
      router.replace('/app');
    } catch (err) {
      setGuestState({ status: 'error', error: err instanceof Error ? err.message : 'Guest sign-in failed' });
    }
  }, [router, wallet.address]);

  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black/5 border border-black/10 mb-5">
        <Sparkles className="w-7 h-7 text-foreground" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Sign in to Sixa</h1>
      <p className="text-secondary mt-2 text-sm leading-relaxed">
        Signing in is optional — it derives your KeeperHub account from your email so
        portfolios, balances, and execution run under your account. Prefer to stay anonymous?
        Close this and use the broker with a wallet as a guest.
      </p>

      {authError && (
        <div className="mt-4 rounded-xl bg-error/5 border border-error/20 px-4 py-3 text-xs text-error flex items-start gap-2 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {authError}
        </div>
      )}

      {authenticated ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" /> Signed in{account?.email ? ` as ${account.email}` : ''} — entering the app…
        </div>
      ) : (
        <div className="mt-6 text-left">
          <AuthCard />

          <div className="my-5 flex items-center gap-3">
            <div className="h-px bg-black/10 flex-1" />
            <span className="text-[11px] uppercase tracking-wider text-secondary">or use your own wallet</span>
            <div className="h-px bg-black/10 flex-1" />
          </div>

          <WalletCard
            wallet={wallet}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
            onRefresh={() => wallet.address && wallet.refreshPortfolio(wallet.address, wallet.chainId)}
            compact
          />

          {wallet.isConnected && wallet.address && (
            <div className="mt-3 space-y-2">
              <Button className="w-full gap-2" onClick={continueAsGuest} disabled={guestState.status === 'signing'}>
                {guestState.status === 'signing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing…
                  </>
                ) : (
                  <>
                    Continue to the broker as guest
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              {guestState.status === 'error' && (
                <p className="text-xs text-error text-center">{guestState.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      <Link
        href="/app"
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors"
      >
        Skip sign-in — go to the broker as a guest
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}