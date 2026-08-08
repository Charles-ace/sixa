'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Copy, Check, X, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

export interface ApiKeyView {
  kid: string;
  name: string;
  created: string;
  expiresAt: string;
  revoked: boolean;
}

function maskedFor(kid: string): string {
  return `sx_…${kid.slice(-8)}`;
}

export function AgentApiKeys({ onKeyCreated, onKeyInvalidated }: { onKeyCreated: (key: string) => void; onKeyInvalidated: () => void }) {
  const { authenticated, loading } = useAuth();
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingKid, setRevokingKid] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/keys', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setKeys(Array.isArray(data.keys) ? (data.keys as ApiKeyView[]) : []);
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    fetch('/api/agent/keys', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setKeys(Array.isArray(data.keys) ? (data.keys as ApiKeyView[]) : []);
      })
      .catch(() => {
        if (!cancelled) setKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/agent/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create key');
        return;
      }
      setJustCreated(data.key as string);
      setName('');
      await fetchKeys();
      onKeyCreated(data.key as string);
    } catch {
      setError('Failed to create key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select and copy manually');
    }
  };

  const handleRevoke = async (kid: string) => {
    setRevokingKid(kid);
    setError(null);
    try {
      const res = await fetch(`/api/agent/keys/${kid}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to revoke key');
        return;
      }
      onKeyInvalidated();
      await fetchKeys();
    } catch {
      setError('Failed to revoke key');
    } finally {
      setRevokingKid(null);
    }
  };

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">API keys</p>
            <p className="text-xs text-secondary">Bearer tokens for POST /api/agent</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!authenticated && !loading && (
          <div className="rounded-xl bg-black/[0.04] border border-border p-4">
            <p className="text-xs text-secondary flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Keys are tied to your Sixa account. Sign in to manage keys — the broker works without one.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="Key name (e.g. trading-bot)"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/[0.04] border border-border text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25"
          />
          <Button size="sm" className="shrink-0" onClick={handleCreate} disabled={isCreating} loading={isCreating}>
            Create key
          </Button>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        {justCreated && (
          <div className="rounded-xl border border-success/30 bg-success/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">New key — copy it now, it is shown once</p>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs font-mono break-all bg-black/[0.04] border border-border rounded-lg p-3 text-foreground">{justCreated}</p>
            <p className="text-[11px] text-secondary">Skips pasting — the playground below uses this key automatically.</p>
            {!copied && (
              <Button variant="ghost" size="sm" onClick={() => setJustCreated(null)}>
                I saved it
              </Button>
            )}
          </div>
        )}

        {keys.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-secondary">Issued keys</p>
            {keys.map((k) => (
              <div
                key={k.kid}
                className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {k.name}
                    {k.revoked && <span className="ml-2 text-xs text-secondary line-through">revoked</span>}
                  </p>
                  <p className="text-xs font-mono text-secondary">{maskedFor(k.kid)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-secondary/70 hidden sm:block">
                    {new Date(k.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {!k.revoked && (
                    <button
                      onClick={() => handleRevoke(k.kid)}
                      disabled={revokingKid === k.kid}
                      aria-label={`Revoke ${k.name}`}
                      className="p-1.5 rounded-lg text-secondary hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                    >
                      {revokingKid === k.kid ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {keys.length === 0 && (
          <p className="text-xs text-secondary leading-relaxed">
            Keys are valid for one year, scoped to your account, and cost nothing. Revocation takes effect immediately for new requests.
          </p>
        )}
      </div>
    </div>
  );
}