import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/session';
import { issueApiKey, listApiKeys } from '@/lib/agent-api/keys';

export async function GET(request: NextRequest) {
  const session = await readSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  return NextResponse.json({ keys: listApiKeys(session.sub) });
}

export async function POST(request: NextRequest) {
  const session = await readSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 40) : 'Agent API key';
  const label = name || 'Agent API key';

  const { raw, record } = await issueApiKey({
    sub: session.sub,
    name: label,
    accountAddress: session.accountAddress,
    accountEmail: session.email,
  });

  return NextResponse.json({ key: raw, record }, { status: 201 });
}