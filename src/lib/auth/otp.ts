import { sha256Hex, signToken, verifyToken } from './token';

export const OTP_COOKIE = 'sixa_otp';
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpPayload {
  purpose: 'email-otp';
  email: string;
  codeHash: string;
  attempts: number;
  exp: number;
}

export function generateOtp(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const value = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1000000;
  return value.toString().padStart(6, '0');
}

export async function createOtpToken(email: string, code: string): Promise<string> {
  const codeHash = await sha256Hex(`${email}:${code}`);
  return signToken({
    purpose: 'email-otp',
    email,
    codeHash,
    attempts: 0,
    exp: Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS,
  } satisfies OtpPayload);
}

export type OtpVerification =
  | { ok: true }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'max_attempts' }
  | { ok: false; reason: 'invalid'; newToken: string };

export async function verifyOtpToken(
  token: string,
  email: string,
  code: string
): Promise<OtpVerification> {
  const payload = await verifyToken<OtpPayload>(token);
  if (!payload || payload.purpose !== 'email-otp' || payload.email !== email) {
    return { ok: false, reason: 'invalid', newToken: token };
  }

  const expectedHash = await sha256Hex(`${email}:${code}`);
  if (expectedHash !== payload.codeHash) {
    const attempts = payload.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'max_attempts' };
    const newToken = await signToken({ ...payload, attempts });
    return { ok: false, reason: 'invalid', newToken };
  }

  return { ok: true };
}

export interface MailConfig {
  configured: boolean;
  provider: 'resend' | 'generic' | null;
}

export function getMailConfig(): MailConfig {
  if (process.env.RESEND_API_KEY) return { configured: true, provider: 'resend' };
  if (process.env.EMAIL_API_URL && process.env.EMAIL_API_KEY) return { configured: true, provider: 'generic' };
  return { configured: false, provider: null };
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const config = getMailConfig();
  if (!config.configured) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY or EMAIL_API_URL/EMAIL_API_KEY to enable it.');
  }

  const subject = 'Your Sixa sign-in code';
  const text = `Your Sixa sign-in code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`;

  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Sixa <onboarding@resend.dev>',
        to: [email],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Email send failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return;
  }

  const response = await fetch(process.env.EMAIL_API_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Sixa <no-reply@sixa.xyz>',
      to: [email],
      subject,
      text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email send failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
}
