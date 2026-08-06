import { NextRequest, NextResponse } from 'next/server';
import { getExecutionProvider, getConfigStatus, ProviderError, toSimulationResult, toExecutionResult, buildExecutionStages } from '@/lib/keeperhub';
import type { ParsedIntent } from '@/lib/types';

function errorResponse(error: unknown) {
  const err = error as ProviderError;
  return NextResponse.json(
    {
      error: err.message ?? 'Execution failed',
      ...(err.code ? { code: err.code } : {}),
      ...(err.hint ? { hint: err.hint } : {}),
      ...(err.requestId ? { requestId: err.requestId } : {}),
      ...(err.docs ? { docs: err.docs } : {}),
    },
    { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 500 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent } = body as { intent: ParsedIntent };

    if (!intent?.type) {
      return NextResponse.json({ error: 'Intent is required', code: 'invalid_input' }, { status: 400 });
    }

    const provider = getExecutionProvider();
    const config = getConfigStatus();

    const simulation = await provider.simulate(intent);
    const simulationResult = toSimulationResult(intent, simulation, provider);

    if (!simulationResult.success) {
      return NextResponse.json(
        {
          error: simulationResult.revertReason ?? 'Simulation failed',
          ...(simulationResult.errorCode ? { code: simulationResult.errorCode } : {}),
          ...(simulationResult.unsupported ? { unsupported: simulationResult.unsupported } : {}),
          simulation: simulationResult,
          keeperHub: config,
        },
        { status: 422 }
      );
    }

    const outcome = await provider.execute(intent);
    const result = toExecutionResult(outcome, simulationResult, provider);

    return NextResponse.json({
      stages: buildExecutionStages(intent, provider.id),
      simulation: simulationResult,
      result,
      keeperHub: config,
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return errorResponse(error);
    }
    console.error('KeeperHub execute error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed', code: 'internal_error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = getConfigStatus();
  return NextResponse.json({
    status: config.configured ? 'ok' : 'degraded',
    ...config,
  });
}
