'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export function SignInBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('signin')) {
      setTimeout(() => setVisible(true), 0);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-md">
      <div className="relative rounded-2xl bg-foreground text-background shadow-xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Sign in to use the app</p>
          <p className="text-xs opacity-70 mt-0.5">Email or Google — your KeeperHub account opens instantly.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/signin"
            className="rounded-lg bg-background text-foreground px-3.5 py-2 text-sm font-medium hover:opacity-85 transition-opacity"
          >
            Sign in
          </Link>
          <button
            onClick={() => setVisible(false)}
            aria-label="Dismiss"
            className="rounded-lg p-2 hover:bg-background/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}