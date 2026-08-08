import { NextResponse } from 'next/server';
import { getGoogleConfig } from '@/lib/auth/google';
import { getMailConfig } from '@/lib/auth/otp';

export async function GET() {
  const google = getGoogleConfig();
  const mail = getMailConfig();
  return NextResponse.json({
    googleConfigured: google.configured,
    emailConfigured: mail.configured,
    provider: mail.provider,
  });
}