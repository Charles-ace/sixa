import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl, getGoogleConfig } from '@/lib/auth/google';
import { signToken } from '@/lib/auth/token';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  const limiter = rateLimit(`auth-google:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.', code: 'rate_limited' }, { status: 429 });
  }

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