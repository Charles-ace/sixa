import { NextResponse } from 'next/server';
import { getGoogleConfig } from '@/lib/auth/google';
import { getMailConfig } from '@/lib/auth/otp';

export async function GET() {
  const google = getGoogleConfig();
  const mail = getMailConfig();
  const emailConfigured = mail.configured || process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_OTP === 'true';
  return NextResponse.json({
    googleConfigured: google.configured,
    emailConfigured,
    provider: mail.provider,
    devOtpAllowed: process.env.ALLOW_DEV_OTP === 'true',
  });
}