import { NextRequest, NextResponse } from 'next/server';
import { AgentApiError, runAgentRequest } from '@/lib/agent/run';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const limiter = rateLimit(`chat:${ip}`, { limit: 20, windowMs: 60 * 1000 });
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a minute.', code: 'rate_limited', retryAfterSeconds: Math.ceil(limiter.retryAfterMs / 1000) },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid or empty request body.', code: 'invalid_body' }, { status: 400 });
    }
    const { message, history = [], walletAddress, chainId, accountAddress, accountEmail } = body;

    const result = await runAgentRequest({ message, history, walletAddress, chainId, accountAddress, accountEmail });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message, code: error.code, ...error.extra }, { status: error.statusCode });
    }
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}