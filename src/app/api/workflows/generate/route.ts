import { NextRequest, NextResponse } from 'next/server';
import { generateWorkflow } from '@/lib/workflows/agent';
import { getConfigStatus } from '@/lib/keeperhub';
import { isTelegramConfigured, verifyTelegramConnection } from '@/lib/workflows/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Message is required', code: 'invalid_input' }, { status: 400 });
    }

    const draft = await generateWorkflow(message, {
      walletAddress: typeof body.walletAddress === 'string' ? body.walletAddress : undefined,
      chatId: typeof body.chatId === 'string' ? body.chatId : undefined,
    });

    const telegram = isTelegramConfigured()
      ? await verifyTelegramConnection().catch(() => ({ ok: false, error: 'Telegram check failed' }))
      : { ok: false, error: 'TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured' };

    return NextResponse.json({
      draft,
      keeperHub: getConfigStatus(),
      telegram,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed', code: 'generation_failed' },
      { status: 500 }
    );
  }
}