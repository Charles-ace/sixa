import { getStoredTelegramConfig } from './telegram-store';

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

export function readTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  };
}

export function isTelegramConfigured(config: TelegramConfig = readTelegramConfig()): boolean {
  return Boolean(config.botToken && config.chatId);
}

export async function loadEffectiveTelegramConfig(): Promise<TelegramConfig> {
  const envCfg = readTelegramConfig();
  if (envCfg.botToken && envCfg.chatId) return envCfg;
  const stored = await getStoredTelegramConfig();
  if (stored.botToken && stored.chatId) return stored;
  return {};
}

export function maskChatId(chatId: string): string {
  if (chatId.length <= 4) return '*'.repeat(chatId.length);
  return `${chatId.slice(0, 2)}…${chatId.slice(-2)}`;
}

export interface TelegramSendResult {
  ok: boolean;
  messageId?: number;
  chat?: { id: number; type: string };
  error?: string;
  reason?: string;
}

export async function sendTelegramMessage(
  text: string,
  options?: { chatId?: string; parseMode?: 'MarkdownV2' | 'HTML' }
): Promise<TelegramSendResult> {
  const config = readTelegramConfig();
  const chatId = options?.chatId ?? config.chatId;

  if (!config.botToken) {
    return { ok: false, reason: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  if (!chatId) {
    return { ok: false, reason: 'TELEGRAM_CHAT_ID not configured' };
  }

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options?.parseMode && text.includes('`')) {
      payload.parse_mode = options.parseMode;
    }
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.description ?? `Telegram HTTP ${response.status}` };
    }
    return {
      ok: true,
      messageId: data.result?.message_id,
      chat: data.result?.chat ? { id: data.result.chat.id, type: data.result.chat.type } : undefined,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown telegram error' };
  }
}

export async function verifyTelegramConnection(config: TelegramConfig = readTelegramConfig()): Promise<{
  ok: boolean;
  botName?: string;
  username?: string;
  chatId?: string;
  error?: string;
}> {
  if (!config.botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  try {
    const me = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`).then((r) => r.json());
    if (!me.ok) {
      return { ok: false, error: me.description ?? 'Telegram getMe failed' };
    }
    return {
      ok: true,
      botName: me.result?.first_name,
      username: me.result?.username,
      ...(config.chatId ? { chatId: config.chatId } : {}),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Telegram getMe failed' };
  }
}

export function buildAgentNotices() {
  return {
    workflowCreated(workflowName: string, workflowId: string) {
      return `Sixa agent deployed workflow\n\nWorkflow: ${workflowName}\nID: ${workflowId}\n\nExecution is handled by KeeperHub. Reply to pause it any time.`;
    },
    workflowPaused(name: string) {
      return `Workflow paused: ${name}`;
    },
    workflowResumed(name: string) {
      return `Workflow resumed: ${name}`;
    },
    executionStarted(name: string, executionId: string) {
      return `Execution started\nStrategy: ${name}\nExecutor: KeeperHub\nStatus: processing (${executionId})`;
    },
    executionComplete(name: string, txHash?: string) {
      const tx = txHash ? `\nTransaction: ${txHash.slice(0, 12)}…${txHash.slice(-8)}` : '';
      return `Execution complete — ${name}${tx}`;
    },
    executionFailed(name: string, reason?: string) {
      return `Execution failed\nWorkflow: ${name}${reason ? `\nReason: ${reason}` : ''}`;
    },
  };
}