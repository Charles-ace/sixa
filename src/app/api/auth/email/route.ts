import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/auth/account';
import { createOtpToken, generateOtp, OTP_COOKIE, OTP_TTL_SECONDS, sendOtpEmail, getMailConfig } from '@/lib/auth/otp';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const ipLimit = rateLimit(`auth-email-start:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Try again later.', code: 'rate_limited' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.', code: 'invalid_email' }, { status: 400 });
    }

    const emailLimit = rateLimit(`auth-email-start:${email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many sign-in attempts for this email. Try again later.', code: 'rate_limited' }, { status: 429 });
    }

    const code = generateOtp();
    const otpToken = await createOtpToken(email, code);

    const config = getMailConfig();
    let devCode: string | undefined;
    if (config.configured) {
      await sendOtpEmail(email, code);
    } else if (process.env.NODE_ENV !== 'production') {
      devCode = code;
    } else {
      return NextResponse.json(
        { error: 'Email delivery is not configured on this deployment.', code: 'email_not_configured' },
        { status: 501 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(devCode ? { devCode } : {}),
    });
    response.cookies.set(OTP_COOKIE, otpToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: OTP_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send sign-in code.', code: 'signin_failed' },
      { status: 500 }
    );
  }
}
