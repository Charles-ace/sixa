import { NextRequest, NextResponse } from 'next/server';
import { runAgentRequest, AgentApiError } from '@/lib/agent/run';
import { readApiKey } from '@/lib/agent-api/keys';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { resolveChainId } from '@/lib/keeperhub/providers/types';

export async function POST(request: NextRequest) {
  let apiKey = request.headers.get('authorization') ?? '';
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    apiKey = apiKey.slice(7).trim();
  }

  const payload = await readApiKey(apiKey);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired API key. Generate one at /app/agent-api.', code: 'invalid_api_key' },
      { status: 401 }
    );
  }

  const limiter = rateLimit(`agent:${payload.kid}`, { limit: 60, windowMs: 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.', code: 'rate_limited', retryAfterSeconds: Math.ceil(limiter.retryAfterMs / 1000) },
      { status: 429 }
    );
  }

  try {
    const ip = clientIp(request);
    rateLimit(`agent-ip:${ip}`, { limit: 120, windowMs: 60 * 1000 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { message, history = [] } = body as { message?: unknown; history?: unknown };

    const result = await runAgentRequest({
      message: typeof message === 'string' ? message : '',
      history: Array.isArray(history) ? history : [],
      walletAddress: payload.accountAddress,
      chainId: resolveChainId(),
      accountAddress: payload.accountAddress,
      accountEmail: payload.accountEmail,
    });

    return NextResponse.json({
      ...result,
      account: {
        accountAddress: payload.accountAddress,
        accountEmail: payload.accountEmail,
        keyName: payload.name,
      },
    });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message, code: error.code, ...error.extra }, { status: error.statusCode });
    }
    console.error('Agent API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}