import { NextRequest, NextResponse } from 'next/server';
import { getExecutionProvider, getConfigStatus, ProviderError } from '@/lib/keeperhub';
import type { ParsedIntent } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent } = body as { intent: ParsedIntent };

    if (!intent?.type) {
      return NextResponse.json({ error: 'Intent is required', code: 'invalid_input' }, { status: 400 });
    }

    const provider = getExecutionProvider();
    const route = await provider.getBridgeRoute(intent);

    return NextResponse.json({
      route,
      keeperHub: getConfigStatus(),
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.hint ? { hint: error.hint } : {}),
          ...(error.docs ? { docs: error.docs } : {}),
        },
        { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 500 }
      );
    }
    console.error('Bridge route error:', error);
    return NextResponse.json({ error: 'Failed to compute bridge route', code: 'internal_error' }, { status: 500 });
  }
}
