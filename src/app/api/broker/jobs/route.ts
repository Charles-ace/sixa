import { NextRequest, NextResponse } from 'next/server';
import { createJob, listJobs } from '@/lib/broker/pipeline';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { readSession } from '@/lib/auth/session';
import type { PaymentMode } from '@/lib/broker/types';

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limiter = rateLimit(`broker:${ip}`, { limit: 10, windowMs: 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.', code: 'rate_limited', retryAfterSeconds: Math.ceil(limiter.retryAfterMs / 1000) },
      { status: 429 }
    );
  }

  try {
    const session = await readSession(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid or empty request body.', code: 'invalid_body' }, { status: 400 });
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'A message describing the job goal is required.', code: 'invalid_input' }, { status: 400 });
    }

    const budgetUsdc = typeof body.budgetUsdc === 'number' && body.budgetUsdc > 0 ? body.budgetUsdc : undefined;
    const forcedSlug = typeof body.forcedSlug === 'string' && body.forcedSlug ? body.forcedSlug : null;
    let payMode: PaymentMode | undefined;
    if (body.payMode === 'real' || body.payMode === 'simulated') payMode = body.payMode;

    const job = await createJob({
      message,
      accountEmail: session?.email ?? null,
      budgetUsdc,
      forcedSlug,
      payMode,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Broker job creation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Job creation failed.', code: 'job_failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ jobs: await listJobs() });
}