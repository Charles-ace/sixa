import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramConnection, sendTelegramMessage } from '@/lib/workflows/telegram';
import { setStoredTelegramConfig } from '@/lib/workflows/telegram-store';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const botToken = typeof body?.botToken === 'string' ? body.botToken.trim() : '';
  const chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : '';

  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'Bot token is required.' }, { status: 400 });
  }
  if (!chatId) {
    return NextResponse.json({ ok: false, error: 'Chat id is required.' }, { status: 400 });
  }

  const check = await verifyTelegramConnection({ botToken, chatId });
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error ?? 'Telegram verification failed.' }, { status: 400 });
  }

  const test = await sendTelegramMessage(
    '✔ Connected to Sixa. You will receive portfolio alerts, execution updates, and completion reports here.',
    { chatId, parseMode: 'MarkdownV2' }
  );
  if (!test.ok) {
    return NextResponse.json(
      { ok: false, error: test.error ?? 'Could not reach this chat. Check the chat id and make sure you messaged the bot first.' },
      { status: 400 }
    );
  }

  await setStoredTelegramConfig({ botToken, chatId });

  return NextResponse.json({
    ok: true,
    botName: check.botName,
    username: check.username,
    messageId: test.messageId,
    connected: true,
  });
}