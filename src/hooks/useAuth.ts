'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Account {
  email: string;
  name?: string | null;
  picture?: string | null;
  provider: 'email' | 'google';
  accountAddress?: string;
  sub?: string;
}

export interface SessionState {
  loading: boolean;
  authenticated: boolean;
  account: Account | null;
}

export function useAuth() {
  const [state, setState] = useState<SessionState>({ loading: true, authenticated: false, account: null });
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = await res.json();
      setState({
        loading: false,
        authenticated: Boolean(data.authenticated && data.account),
        account: data.authenticated ? (data.account as Account) : null,
      });
    } catch {
      setState({ loading: false, authenticated: false, account: null });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setState({
          loading: false,
          authenticated: Boolean(data.authenticated && data.account),
          account: data.authenticated ? (data.account as Account) : null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, authenticated: false, account: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback(() => {
    router.push('/api/auth/google');
  }, [router]);

  const startEmailSignIn = useCallback(async (email: string): Promise<{ devCode?: string }> => {
    const res = await fetch('/api/auth/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? 'Failed to send sign-in code');
    }
    const data = await res.json().catch(() => ({}));
    return { devCode: data.devCode };
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      const res = await fetch('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Verification failed');
      }
      await refresh();
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ loading: false, authenticated: false, account: null });
    router.refresh();
  }, [router]);

  return { ...state, signInWithGoogle, startEmailSignIn, verifyEmailCode, signOut, refresh };
}