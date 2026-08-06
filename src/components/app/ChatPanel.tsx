'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, Bot, Loader2, RefreshCw } from 'lucide-react';
import type { AuditEntry, ChatMessage, ExecutionResult, ExecutionStage, ParsedIntent, SimulationResult } from '@/lib/types';
import { ACTION_LABELS } from '@/lib/intent-parser';
import { TransactionPreview } from '@/components/app/TransactionPreview';
import { ExecutionTimeline } from '@/components/app/ExecutionTimeline';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  walletAddress?: string;
  chainId?: number;
  walletConnected: boolean;
  onAuditEntry: (entry: AuditEntry) => void;
}

const EXAMPLE_PROMPTS = [
  'Swap 100 USDC to ETH',
  'Bridge 500 USDC to Base',
  'Stake my ETH',
  'Show my portfolio',
  'How much ETH do I have?',
];

interface PreviewState {
  messageId: string;
  intent: ParsedIntent;
  simulation: SimulationResult;
}

export function ChatPanel({ walletAddress, chainId = 1, walletConnected, onAuditEntry }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [stages, setStages] = useState<ExecutionStage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | undefined>();
  const [keeperHubMode, setKeeperHubMode] = useState<string>('');
  const [runId, setRunId] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking]);

  useEffect(() => {
    fetch('/api/keeperhub')
      .then((r) => r.json())
      .then((data) => setKeeperHubMode(data.mode))
      .catch(() => setKeeperHubMode('simulated'));
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking || isExecuting) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setInput('');
    setPreview(null);
    appendMessage(userMessage);
    setIsThinking(true);

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, walletAddress, chainId }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        intent: data.intent,
        timestamp: new Date().toISOString(),
      };

      appendMessage(assistantMessage);

      if (data.executable && data.intent && data.simulation) {
        setPreview({ messageId: assistantMessage.id, intent: data.intent, simulation: data.simulation });
      }
    } catch {
      appendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I hit an error processing that. Please try again in a moment.',
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, isExecuting, messages, appendMessage, walletAddress, chainId]);

  const handleExecute = useCallback(async () => {
    if (!preview || !walletAddress || isExecuting) return;

    setIsExecuting(true);
    setExecutionResult(undefined);
    setRunId((r) => r + 1);

    try {
      const response = await fetch('/api/keeperhub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: preview.intent, walletAddress }),
      });

      if (!response.ok) throw new Error('Execution failed');

      const data = await response.json();
      setStages(data.stages);

      await new Promise((resolve) => setTimeout(resolve, 750));

      const result: ExecutionResult = data.result;
      setExecutionResult(result);

      const auditEntry: AuditEntry = {
        id: result.auditId,
        timestamp: result.executedAt,
        wallet: walletAddress,
        action: ACTION_LABELS[preview.intent.type],
        intent: preview.intent,
        simulation: data.simulation,
        execution: result,
      };
      onAuditEntry(auditEntry);

      appendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: [
          `✅ ${ACTION_LABELS[preview.intent.type]} executed successfully.`,
          '',
          `• Transaction: \`${result.txHash}\``,
          `• Gas cost: $${result.gasCostUsd.toFixed(2)}`,
          '• Verified by KeeperHub audit trail.',
        ].join('\n'),
        timestamp: new Date().toISOString(),
      });

      setPreview(null);
    } catch {
      appendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Execution could not be completed. The transaction was not broadcast — nothing was sent.',
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [preview, walletAddress, isExecuting, onAuditEntry, appendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderAssistantContent = (message: ChatMessage) => {
    const lines = message.content.split('\n');
    const isSuccess = message.content.startsWith('✅');
    return (
      <div className={cn('text-sm leading-relaxed space-y-1.5', isSuccess && 'font-medium')}>
        {lines.map((line, i) => {
          const isHash = line.trim().startsWith('`') && line.trim().endsWith('`');
          if (isHash) {
            return (
              <p key={i} className="font-mono text-xs text-foreground bg-black/5 border border-black/10 rounded-lg px-2.5 py-1.5 inline-block break-all">
                {line.trim().replace(/`/g, '')}
              </p>
            );
          }
          if (line.trim().startsWith('•')) {
            return <p key={i} className="pl-4 text-secondary">{line}</p>;
          }
          return line.trim() ? <p key={i} className={line.includes('⚠') ? 'text-warning' : 'text-secondary'}>{line}</p> : <div key={i} className="h-2" />;
        })}
        {message.intent && preview?.messageId !== message.id && (
          <div className="pt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-foreground border border-black/15 uppercase tracking-wider">
              {ACTION_LABELS[message.intent.type]} · intent parsed
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
            <Bot className="w-5 h-5 text-background" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Sixa AI</p>
            <p className="text-xs text-secondary">On-chain execution assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(
            'px-2.5 py-1 rounded-full border font-medium',
            keeperHubMode === 'live'
              ? 'bg-success/10 text-success border-success/25'
              : 'bg-black/5 text-foreground border-black/15'
          )}>
            {keeperHubMode === 'live' ? 'KeeperHub live' : 'KeeperHub · demo mode'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5" ref={endRef}>
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center pt-8"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-foreground flex items-center justify-center shadow-lg shadow-black/10">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Talk to the blockchain</h2>
            <p className="text-sm text-secondary max-w-sm mx-auto mb-6">
              Describe what you want. Sixa parses the intent, simulates the transaction, and executes securely through KeeperHub.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 rounded-full text-xs text-secondary hover:text-foreground bg-black/[0.04] border border-border hover:border-black/30 hover:bg-black/5 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
            >
              <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                message.role === 'user'
                  ? 'bg-foreground'
                  : 'bg-black/[0.05] border border-border'
              )}>
                {message.role === 'user' ? <User className="w-4 h-4 text-background" /> : <Bot className="w-4 h-4 text-foreground" />}
              </div>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-black/5 border border-black/10'
                  : 'bg-black/[0.04] border border-border'
              )}>
                {renderAssistantContent(message)}
                <p className="text-[10px] text-secondary/50 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-black/[0.05] border border-border flex items-center justify-center">
              <Bot className="w-4 h-4 text-foreground" />
            </div>
            <div className="bg-black/[0.04] border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-foreground animate-spin" />
              <span className="text-xs text-secondary">Parsing intent, simulating transaction…</span>
            </div>
          </motion.div>
        )}

        {preview && (
          <motion.div
            layout
            key={preview.messageId}
            className="pl-11"
          >
            <TransactionPreview
              intent={preview.intent}
              simulation={preview.simulation}
              onConfirm={handleExecute}
              onCancel={() => setPreview(null)}
              isExecuting={isExecuting}
            />
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-border">
        {!walletConnected && (
          <p className="text-[11px] text-warning/80 mb-2 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
            Connect a wallet to execute transactions. You can still explore the assistant without one.
          </p>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Try "Swap 100 USDC to ETH"…'
            rows={1}
            className="w-full bg-black/[0.04] border border-border rounded-xl pl-4 pr-14 py-3.5 text-sm text-foreground placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-foreground/25 focus:border-transparent resize-none transition-all max-h-40 min-h-[50px]"
            disabled={isThinking || isExecuting}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking || isExecuting}
            className="absolute right-2 bottom-2 p-2.5 rounded-lg bg-foreground text-background hover:shadow-lg hover:shadow-black/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-secondary/40 mt-2 text-center">
          Sixa parses intent → simulates → executes via KeeperHub. AI can make mistakes — review every preview.
        </p>
      </div>
      </div>

      <AnimatePresence>
        {(isExecuting || executionResult) && (
          <ExecutionTimeline
            key={runId}
            stages={stages}
            isRunning={isExecuting}
            result={executionResult}
            onClose={() => setExecutionResult(undefined)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
