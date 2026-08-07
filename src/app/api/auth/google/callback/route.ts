import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, getGoogleConfig } from '@/lib/auth/google';
import { verifyToken } from '@/lib/auth/token';
import { createSessionCookie } from '@/lib/auth/session';
import { resolveAccount } from '@/lib/auth/account';

export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config.configured) {
    return NextResponse.redirect(`${new URL(request.url).origin}/app?auth=error&reason=not_configured`);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const storedState = request.cookies.get('sixa_oauth_state')?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${new URL(request.url).origin}/app?auth=error&reason=state_mismatch`);
  }

  try {
    const profile = await exchangeGoogleCode(code, `${new URL(request.url).origin}/api/auth/google/callback`);

    const account = await resolveAccount({
      provider: 'google',
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    const response = await createSessionCookie(account);
    const target = new URL(`${new URL(request.url).origin}/app`);
    target.searchParams.set('auth', 'success');
    return NextResponse.redirect(target, { headers: response.headers });
  } catch (error) {
    return NextResponse.redirect(`${new URL(request.url).origin}/app?auth=error&reason=${encodeURIComponent(error instanceof Error ? error.message : 'unknown')}`);
  }
}