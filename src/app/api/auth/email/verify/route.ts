import { NextRequest, NextResponse } from 'next/server';
import { resolveAccount } from '@/lib/auth/account';
import { OTP_COOKIE, verifyOtpToken, OTP_MAX_ATTEMPTS } from '@/lib/auth/otp';
import { createSessionCookie } from '@/lib/auth/session';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const ipLimit = rateLimit(`auth-email-verify:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.', code: 'rate_limited' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!email || !code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code sent to your email.', code: 'invalid_code' }, { status: 400 });
    }

    const otpToken = request.cookies.get(OTP_COOKIE)?.value;
    if (!otpToken) {
      return NextResponse.json({ error: 'No sign-in code found. Request a new one.', code: 'no_otp' }, { status: 400 });
    }

    const result = await verifyOtpToken(otpToken, email, code);
    if (!result.ok) {
      const status = result.reason === 'invalid' ? 400 : 401;
      const messages = {
        expired: 'This code has expired. Request a new one.',
        max_attempts: `Too many incorrect codes. Request a new one (${OTP_MAX_ATTEMPTS} attempts allowed).`,
        invalid: 'Incorrect code. Try again.',
      } as const;
      const response = NextResponse.json({ error: messages[result.reason], code: result.reason }, { status });
      if (result.reason === 'invalid') {
        response.cookies.set(OTP_COOKIE, result.newToken, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 600,
        });
      }
      return response;
    }

    const account = await resolveAccount({ provider: 'email', email });
    const session = await createSessionCookie(account);
    session.cookies.set(OTP_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    return session;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed.', code: 'verify_failed' },
      { status: 500 }
    );
  }
}
