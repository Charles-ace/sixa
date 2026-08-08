'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck, Zap, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { AuthCard } from '@/components/app/AuthCard';
import { WalletCard } from '@/components/app/WalletCard';
import { Button } from '@/components/ui/Button';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/app';

  const auth = useAuth();
  const wallet = useWallet();

  useEffect(() => {
    if (!auth.loading && auth.authenticated) {
      router.replace(next.startsWith('/app') ? next : '/app');
    }
  }, [auth.loading, auth.authenticated, next, router]);

  const continueAsGuest = useCallback(() => {
    router.replace('/app');
  }, [router]);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pt-28 pb-16">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-xs uppercase tracking-[0.2em] text-secondary mb-4">Sign in to the broker</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            One account.
            <br />
            A wallet you never have to manage.
          </h1>
          <p className="text-secondary mt-4 max-w-md leading-relaxed">
            Sign in with Google or email and Sixa provisions a KeeperHub-managed wallet for you — no seed
            phrases, no extensions, no gas. Bring your own wallet instead if you prefer to sign for yourself.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Zero-setup account</p>
                <p className="text-xs text-secondary">Same no-code experience for crypto beginners and pros.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Broker executes for you</p>
                <p className="text-xs text-secondary">KeeperHub settles discovery, payment, and execution on your behalf.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Guest mode works too</p>
                <p className="text-xs text-secondary">Connect MetaMask to try the broker with full control — no account required.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          <AuthCard />

          <div className="flex items-center gap-3">
            <div className="h-px bg-black/10 flex-1" />
            <span className="text-[11px] uppercase tracking-wider text-secondary">or have your own wallet</span>
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
            <Button className="w-full gap-2" onClick={continueAsGuest}>
              Continue to the broker as guest
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          <p className="text-center text-[11px] text-secondary/70">
            By continuing you agree to KeeperHub&apos;s broker terms of execution.
          </p>
        </motion.div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <Suspense>
          <LoginContent />
        </Suspense>
      </main>
    </div>
  );
}