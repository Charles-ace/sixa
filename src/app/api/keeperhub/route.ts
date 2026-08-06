import { NextRequest, NextResponse } from 'next/server';
import { executeThroughKeeperHub, simulateIntent, isKeeperHubConfigured, buildExecutionStages } from '@/lib/keeperhub';
import type { ParsedIntent } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, walletAddress } = body as { intent: ParsedIntent; walletAddress: string };

    if (!intent || !walletAddress) {
      return NextResponse.json({ error: 'Intent and wallet address are required' }, { status: 400 });
    }

    const simulation = simulateIntent(intent);
    const stages = buildExecutionStages(intent);
    const result = await executeThroughKeeperHub({ intent, simulation, wallet: walletAddress });

    return NextResponse.json({
      stages,
      simulation,
      result,
      keeperHub: {
        configured: isKeeperHubConfigured(),
        mode: isKeeperHubConfigured() ? 'live' : 'simulated',
        endpoint: isKeeperHubConfigured() ? 'KeeperHub Direct Execution API' : 'local simulation engine',
      },
    });
  } catch (error) {
    console.error('KeeperHub execute error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    configured: isKeeperHubConfigured(),
    mode: isKeeperHubConfigured() ? 'live' : 'simulated',
    message: isKeeperHubConfigured()
      ? 'KeeperHub Direct Execution API connected'
      : 'KeeperHub not configured — running local simulation. Set KEEPERHUB_ENDPOINT and KEEPERHUB_API_KEY to enable live execution.',
  });
}
