import { get, put, del } from '@vercel/blob';
import type { TelegramConfig } from './telegram';

const KEY = 'telegram-config.json';

export async function getStoredTelegramConfig(): Promise<TelegramConfig> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
  try {
    const result = await get(KEY, { access: 'private', useCache: false });
    if (!result) return {};
    const text = await new Response(result.stream).text();
    if (!text) return {};
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      botToken: typeof parsed.botToken === 'string' ? parsed.botToken : undefined,
      chatId: typeof parsed.chatId === 'string' ? parsed.chatId : undefined,
    };
  } catch {
    return {};
  }
}

export async function setStoredTelegramConfig(config: TelegramConfig): Promise<void> {
  await put(KEY, JSON.stringify({ botToken: config.botToken ?? '', chatId: config.chatId ?? '' }), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

export async function clearStoredTelegramConfig(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(KEY);
  } catch {
    // ignore missing blob
  }
}