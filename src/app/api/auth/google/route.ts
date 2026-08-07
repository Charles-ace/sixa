import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl, getGoogleConfig } from '@/lib/auth/google';
import { signToken } from '@/lib/auth/token';

export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.', code: 'google_not_configured' },
      { status: 501 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = await signToken({ purpose: 'google-oauth-state', nonce: crypto.randomUUID() });
  const authUrl = buildGoogleAuthUrl(redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('sixa_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return response;
}