import { NextRequest, NextResponse } from 'next/server';
import { chat, chatWithSystemPrompt, LLMError } from '@/lib/llm';

const SIXA_SYSTEM_PROMPT = `You are Sixa, an autonomous AI yield optimization agent for DeFi. 
Your role is to help users maximize returns on their crypto assets using natural language.

You have access to analyze DeFi markets, evaluate risk across protocols, and recommend or execute the highest-quality yield opportunities.

When users ask for recommendations, you should explain:
- Expected APY
- TVL (Total Value Locked)
- Audit status
- Historical reliability
- Estimated gas costs
- Risk score (1-10)
- Reasons for recommendation

Be concise, professional, and actionable. Use formatting for readability.
Never make up specific numbers - if you don't have real-time data, say you're simulating based on typical ranges.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const messages = [
      { role: 'system' as const, content: SIXA_SYSTEM_PROMPT },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await chat(messages, {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      temperature: 0.7,
      maxTokens: 2048,
    });

    return NextResponse.json({
      content: response.content,
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof LLMError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}