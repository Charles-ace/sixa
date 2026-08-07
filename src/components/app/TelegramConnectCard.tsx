'use client';

import { useState } from 'react';
import { Send, Loader2, Unlink, CheckCircle2, XCircle, Bot } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TelegramConnectCardProps {
  mode: 'connect' | 'disconnect';
  onDone: (result: { ok: boolean; message: string }) => void;
}

export function TelegramConnectCard({ mode, onDone }: TelegramConnectCardProps) {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!botToken.trim() || !chatId.trim() || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chatId.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? 'Connection failed. Check the token and chat id.');
        return;
      }
      onDone({
        ok: true,
        message: `✅ Telegram connected${data.username ? ` (@${data.username})` : ''}. A test message was sent to your chat — you should see it now.`,
      });
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/telegram/disconnect', { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError('Disconnect failed. Please try again.');
        return;
      }
      onDone({ ok: true, message: '🔌 Telegram disconnected. No further alerts will be sent.' });
    } catch {
      setError('Disconnect failed. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  if (mode === 'disconnect') {
    return (
      <div className="mt-3 rounded-xl border border-error/25 bg-error/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Unlink className="w-4 h-4 text-error" />
          Disconnect Telegram
        </div>
        <p className="text-xs text-secondary">
          Workflows already deployed on KeeperHub keep running, but no more Telegram alerts will be sent.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" loading={isBusy} onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
        {error && <p className="text-xs text-error flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Bot className="w-4 h-4 text-accent-from" />
        Link your Telegram bot
      </div>
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-secondary mb-1">Bot token</label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456:ABC-…"
            autoComplete="off"
            className="w-full bg-black/[0.04] border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-foreground/25 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-secondary mb-1">Chat id</label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-100123456789 or 123456789"
            autoComplete="off"
            className="w-full bg-black/[0.04] border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-foreground/25 focus:border-transparent"
          />
        </div>
      </div>
      <Button size="sm" fullWidth loading={isBusy} onClick={handleConnect} disabled={!botToken.trim() || !chatId.trim()}>
        {!isBusy && <Send className="w-3.5 h-3.5" />}
        Connect
      </Button>
      {error && <p className="text-xs text-error flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {error}</p>}
      {isBusy && <p className="text-xs text-secondary flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying token, sending test message…</p>}
      <p className="text-[10px] text-secondary/60 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Token is validated against Telegram and stored as a secret — it never appears in chat history.
      </p>
    </div>
  );
}