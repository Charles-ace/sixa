import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/workflows/telegram';

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SIXA_NOTIFY_SECRET;
    if (secret) {
      const provided = request.headers.get('x-sixa-secret') ?? '';
      if (provided !== secret) {
        return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 });
      }
    }
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;

    if (!text) {
      return NextResponse.json({ error: 'text is required', code: 'invalid_input' }, { status: 400 });
    }

    const sent = await sendTelegramMessage(text, { chatId });
    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error ?? sent.reason ?? 'Telegram not configured', code: 'telegram_unavailable', ...(sent.reason ? { reason: sent.reason } : {}) },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, messageId: sent.messageId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'notification failed', code: 'internal_error' },
      { status: 500 }
    );
  }
}