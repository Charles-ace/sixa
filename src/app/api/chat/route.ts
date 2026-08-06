import { NextRequest, NextResponse } from 'next/server';
import { chat, LLMError } from '@/lib/llm';
import { parseIntent, isExecutable } from '@/lib/intent-parser';
import { SIXA_SYSTEM_PROMPT, buildIntentExplanation, buildClarification } from '@/lib/chat-explainer';
import { simulateIntent } from '@/lib/keeperhub';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], walletAddress, chainId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const intent = parseIntent(message);

    if (intent.type === 'unknown') {
      return NextResponse.json({
        content: buildIntentExplanation(intent),
        intent,
        executable: false,
        simulation: null,
      });
    }

    const simulation = isExecutable(intent) ? simulateIntent(intent) : undefined;
    const fallbackExplanation = buildIntentExplanation(intent, simulation, Boolean(walletAddress));

    const contextLines = [
      `Wallet connected: ${walletAddress ? 'yes' : 'no'}`,
      walletAddress ? `Wallet: ${walletAddress}` : '',
      `Chain ID: ${chainId ?? 1}`,
      `Parsed intent: ${JSON.stringify(intent)}`,
      simulation ? `Simulation: ${JSON.stringify(simulation)}` : '',
    ].filter(Boolean).join('\n');

    let content = fallbackExplanation;
    try {
      const messages = [
        { role: 'system' as const, content: SIXA_SYSTEM_PROMPT },
        ...history
          .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
          .slice(-6)
          .map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: `USER REQUEST: ${message}\n\nCONTEXT:\n${contextLines}\n\nExplain the plan and confirm readiness.` },
      ];

      const response = await chat(messages, { temperature: 0.4, maxTokens: 600 });
      if (response.content && response.content.trim().length > 10) {
        content = response.content.trim();
      }
    } catch (error) {
      console.error('LLM fallback used:', error instanceof Error ? error.message : 'unknown');
    }

    const needsClarification = isExecutable(intent) && (
      (intent.type === 'swap' && !intent.params?.toToken) ||
      (intent.type === 'bridge' && !intent.params?.targetChain) ||
      (intent.type === 'send' && !intent.params?.address)
    );

    if (needsClarification) {
      return NextResponse.json({
        content: buildClarification(intent),
        intent,
        executable: false,
        simulation: null,
      });
    }

    return NextResponse.json({
      content,
      intent,
      executable: isExecutable(intent),
      simulation,
    });
  } catch (error) {
    if (error instanceof LLMError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
