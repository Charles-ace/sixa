'use client';

import { useEffect, useState } from 'react';
import { Mail, LogOut, Loader2, Sparkles, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function AuthCard() {
  const { loading, authenticated, account, signInWithGoogle, startEmailSignIn, verifyEmailCode, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [config, setConfig] = useState<{ googleConfigured: boolean; emailConfigured: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/auth/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setConfig({ googleConfigured: Boolean(data.googleConfigured), emailConfigured: Boolean(data.emailConfigured) }))
      .catch(() => setConfig({ googleConfigured: false, emailConfigured: false }));
  }, []);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setDevCode(undefined);
    try {
      const result = await startEmailSignIn(email.trim());
      setDevCode(result.devCode);
      if (result.devCode) {
        setCode(result.devCode);
      }
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyEmailCode(email.trim(), code);
      setStep('email');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const googleDisabled = config === null || !config.googleConfigured;

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
            <p className="text-xs text-secondary">Optional — sign in, or connect a wallet as a guest</p>
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
              disabled={googleDisabled}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium transition-all',
                googleDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:opacity-85 active:scale-[0.98]'
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" opacity=".7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" opacity=".6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" opacity=".5" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            {googleDisabled && (
              <p className="text-[11px] text-secondary/70 flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3" /> Google sign-in is being configured on this deployment.
              </p>
            )}

            <div className="flex items-center gap-3">
              <div className="h-px bg-black/10 flex-1" />
              <span className="text-[11px] uppercase tracking-wider text-secondary">or</span>
              <div className="h-px bg-black/10 flex-1" />
            </div>

            {step === 'email' ? (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode(); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/[0.04] border border-border text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25"
                  />
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={handleSendCode}
                    disabled={!email.trim() || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Get code</span>}
                  </Button>
                </div>
                <p className="text-[11px] text-secondary/70">
                  We email you a one-time code — no password, and only you can use your account.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9 shrink-0"
                    aria-label="Back"
                    onClick={() => { setStep('email'); setError(null); setDevCode(undefined); }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
                    placeholder="123456"
                    aria-label="6-digit code"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/[0.04] border border-border text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25 tracking-widest"
                  />
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={handleVerify}
                    disabled={!/^\d{6}$/.test(code) || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
                <p className="text-[11px] text-secondary/70">
                  Sent to <span className="text-secondary">{email}</span>. Expires in 10 minutes.
                </p>
              </div>
            )}

            {devCode && (
              <div className="rounded-xl bg-black/[0.04] border border-dashed border-border p-3">
                <p className="text-[11px] font-mono uppercase tracking-wider text-secondary mb-1">Dev mode — sign-in code</p>
                <p className="text-lg font-mono font-bold tracking-[0.3em] text-foreground">{devCode}</p>
              </div>
            )}

            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
