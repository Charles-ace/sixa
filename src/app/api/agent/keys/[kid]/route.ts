import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/session';
import { revokeApiKey } from '@/lib/agent-api/keys';

export async function DELETE(request: NextRequest, context: { params: Promise<{ kid: string }> }) {
  const session = await readSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { kid } = await context.params;
  if (!kid) {
    return NextResponse.json({ error: 'Key id is required' }, { status: 400 });
  }

  const revoked = revokeApiKey(session.sub, kid);
  if (!revoked) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, kid });
}