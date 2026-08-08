'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthCard } from '@/components/app/AuthCard';

export function SignInCard() {
  const { authenticated, account } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

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

  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black/5 border border-black/10 mb-5">
        <Sparkles className="w-7 h-7 text-foreground" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Sign in to Sixa</h1>
      <p className="text-secondary mt-2 text-sm leading-relaxed">
        Your KeeperHub account is derived from your email — portfolios, balances, and execution run under your account. No wallet needed to get started.
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
        </div>
      )}
    </div>
  );
}