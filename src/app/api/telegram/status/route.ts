import { NextResponse } from 'next/server';
import { loadEffectiveTelegramConfig, verifyTelegramConnection, maskChatId } from '@/lib/workflows/telegram';

export async function GET() {
  const config = await loadEffectiveTelegramConfig();
  if (!config.botToken || !config.chatId) {
    return NextResponse.json({
      connected: false,
      error: 'Not connected. Tell Sixa "connect my Telegram" to link a bot, or set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.',
    });
  }

  const check = await verifyTelegramConnection(config);
  if (!check.ok) {
    return NextResponse.json({ connected: false, slot: true, error: check.error ?? 'Telegram check failed.' });
  }

  return NextResponse.json({
    connected: true,
    botName: check.botName,
    username: check.username,
    chatId: maskChatId(config.chatId!),
  });
}