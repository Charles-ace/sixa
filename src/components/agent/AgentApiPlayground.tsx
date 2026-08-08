'use client';

import { useMemo, useState } from 'react';
import { MessageSquare, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SUGGESTIONS = [
  'How much ETH do I have?',
  'Show my portfolio',
  'Watch my portfolio and alert me on Telegram if it drops 20%',
  'swap 1 ETH to USDC',
];

export function AgentApiPlayground({ apiKey }: { apiKey: string }) {
  const [message, setMessage] = useState('Show my portfolio');
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const curl = useMemo(() => {
    const path = typeof window !== 'undefined' ? window.location.origin : '';
    const key = apiKey || 'sk_live_…';
    return `curl -X POST ${path}/api/agent \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "${message.replace(/'/g, "\\'")}"}'`;
  }, [apiKey, message]);

  const run = async () => {
    if (!message.trim()) return;
    if (!apiKey) {
      setError('Create an API key above first, then send from here.');
      return;
    }
    setIsRunning(true);
    setError(null);
    setResponse(null);
    setStatus(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });
      setStatus(res.status);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? `Request failed with status ${res.status}`);
      }
      setResponse(data);
    } catch {
      setStatus(null);
      setError('Network error — is the server running?');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black/5 border border-black/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Playground</p>
            <p className="text-xs text-secondary">Live request against POST /api/agent</p>
          </div>
        </div>
        {status && (
          <span className={`text-xs font-mono px-2 py-1 rounded-lg border ${status < 400 ? 'text-success border-success/30 bg-success/[0.06]' : 'text-error border-error/30 bg-error/[0.06]'}`}>
            {status}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label htmlFor="agent-msg" className="block text-xs text-secondary mb-1.5">
            Message
          </label>
          <textarea
            id="agent-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run(); }}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl bg-black/[0.04] border border-border text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25 resize-none"
            placeholder="Ask the agent anything…"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setMessage(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border text-secondary hover:text-foreground hover:border-black/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-secondary">
            {apiKey ? 'Key attached from the panel above.' : 'No key attached yet.'}
          </p>
          <Button size="sm" className="gap-1.5" onClick={run} disabled={isRunning} loading={isRunning}>
            Send
          </Button>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        {response && (
          <div>
            {typeof response.content === 'string' && (
              <div className="rounded-xl bg-black/[0.04] border border-border p-4 mb-3">
                <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{response.content as string}</p>
              </div>
            )}
            <p className="text-[11px] uppercase tracking-wider text-secondary mb-1.5">Raw response</p>
            <pre className="max-h-80 overflow-auto rounded-xl bg-black/[0.05] border border-border p-4 text-xs font-mono text-foreground">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}

        <div>
          <p className="text-[11px] uppercase tracking-wider text-secondary mb-1.5">cURL equivalent</p>
          <div className="relative rounded-xl bg-black/[0.05] border border-border p-4 pr-10">
            <pre className="overflow-auto text-xs font-mono text-foreground whitespace-pre">{curl}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(curl)}
              aria-label="Copy cURL"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-black/5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}