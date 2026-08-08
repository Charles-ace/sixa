import { NextRequest, NextResponse } from 'next/server';
import { runDecisionCycle } from '@/lib/workflows/decision-engine';
import { getWorkflowProvider } from '@/lib/workflows/provider';
import { rateLimit, clientIp } from '@/lib/rate-limit';

function applyRateLimit(request: NextRequest): NextResponse | null {
  const ip = clientIp(request);
  const limiter = rateLimit(`decision:${ip}`, { limit: 10, windowMs: 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'rate_limited', retryAfterSeconds: Math.ceil(limiter.retryAfterMs / 1000) },
      { status: 429 }
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const secret = process.env.SIXA_DECISION_SECRET;
  if (secret) {
    const provided = request.headers.get('x-sixa-secret') ?? '';
    if (provided !== secret) {
      return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun === true || request.nextUrl.searchParams.get('dryRun') === 'true';

  try {
    const provider = getWorkflowProvider();
    const result = await runDecisionCycle(provider, { dryRun });
    return NextResponse.json({ ...result, dryRun });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Decision cycle failed',
        code: 'decision_cycle_failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const secret = process.env.SIXA_DECISION_SECRET;
  if (secret) {
    const provided = request.headers.get('x-sixa-secret') ?? '';
    if (provided !== secret) {
      return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 });
    }
  }

  const dryRun = request.nextUrl.searchParams.get('run') !== '1';

  try {
    const provider = getWorkflowProvider();
    const result = await runDecisionCycle(provider, { dryRun });
    return NextResponse.json({ ...result, dryRun });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Decision cycle failed',
        code: 'decision_cycle_failed',
      },
      { status: 500 }
    );
  }
}