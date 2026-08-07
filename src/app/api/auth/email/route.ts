import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/auth/session';
import { resolveAccount } from '@/lib/auth/account';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.', code: 'invalid_email' }, { status: 400 });
    }

    const account = await resolveAccount({ provider: 'email', email });
    return createSessionCookie(account);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sign-in failed.', code: 'signin_failed' }, { status: 500 });
  }
}