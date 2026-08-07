import { NextResponse } from 'next/server';
import { clearStoredTelegramConfig } from '@/lib/workflows/telegram-store';

export async function DELETE() {
  await clearStoredTelegramConfig();
  return NextResponse.json({ ok: true, connected: false });
}