import { NextRequest, NextResponse } from 'next/server';
import { runDecisionCycle } from '@/lib/workflows/decision-engine';
import { getWorkflowProvider } from '@/lib/workflows/provider';

export async function POST(request: NextRequest) {
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