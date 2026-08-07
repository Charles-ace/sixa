import { NextRequest, NextResponse } from 'next/server';
import { SessionAccount, SESSION_COOKIE, SESSION_MAX_AGE_DAYS, accountId, deriveAccountAddress } from './account';
import { signToken, verifyToken } from './token';

export interface SessionPayload extends SessionAccount {
  sub: string;
  accountAddress: string;
  exp: number;
}

export const SESSION_TTL_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

export async function createSessionCookie(account: SessionAccount): Promise<NextResponse<unknown>> {
  const sub = await accountId(account);
  const accountAddress = await deriveAccountAddress(account);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  const token = await signToken({
    ...account,
    sub,
    accountAddress,
    exp,
  } satisfies SessionPayload);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export async function clearSessionCookie(): Promise<NextResponse<unknown>> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken<SessionPayload>(token);
}