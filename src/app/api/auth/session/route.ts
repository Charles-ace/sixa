import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await readSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, account: null });
  }
  return NextResponse.json({
    authenticated: true,
    account: {
      email: session.email,
      name: session.name ?? null,
      picture: session.picture ?? null,
      provider: session.provider,
      accountAddress: session.accountAddress,
      sub: session.sub,
    },
  });
}