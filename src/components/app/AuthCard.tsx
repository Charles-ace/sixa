'use client';

import { useState } from 'react';
import { Mail, LogOut, Loader2, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function AuthCard() {
  const { loading, authenticated, account, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email.trim());
      setJustSignedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-foreground" />
            {authenticated && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Sixa account</p>
            <p className="text-xs text-secondary">Sign in with email or Google</p>
          </div>
        </div>

        {authenticated && (
          <Button variant="ghost" size="icon" className="w-8 h-8" aria-label="Sign out" onClick={signOut}>
            <LogOut className="w-4 h-4 text-secondary hover:text-error" />
          </Button>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-secondary py-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading session…
          </div>
        ) : authenticated && account ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              {account.picture && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.picture} alt="" className="w-8 h-8 rounded-full object-cover border border-black/10" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {account.name || account.email}
                </p>
                <p className="text-xs text-secondary truncate">{account.email}</p>
              </div>
            </div>
            {account.accountAddress && (
              <div className="rounded-xl bg-black/[0.04] border border-border p-3 mb-3">
                <p className="text-xs text-secondary mb-1">KeeperHub account address</p>
                <p className="text-sm font-mono font-medium text-foreground">{formatAddress(account.accountAddress, 6)}</p>
              </div>
            )}
            <p className="text-xs text-secondary leading-relaxed">
              Executions are settled through KeeperHub on your behalf — no browser keys, no signing prompts.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-85 active:scale-[0.98] transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" opacity=".7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" opacity=".6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" opacity=".5" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-black/10 flex-1" />
              <span className="text-[11px] uppercase tracking-wider text-secondary">or</span>
              <div className="h-px bg-black/10 flex-1" />
            </div>

            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder="you@example.com"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/[0.04] border border-border text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25"
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={handleSubmit}
                  disabled={!email.trim() || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Sign in</span>}
                </Button>
              </div>
              <p className="text-[11px] text-secondary/70">
                No wallet needed for setup — your account address is derived for KeeperHub execution.
              </p>
            </div>

            {error && <p className="text-xs text-error">{error}</p>}
            {justSignedIn && (
              <p className="text-xs text-success flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Signed in. Portfolio and balances now run under your account.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}