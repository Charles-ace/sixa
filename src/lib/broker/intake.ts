import { chat } from '@/lib/llm';
import type { JobSpec } from './types';

export const DEFAULT_BUDGET_USDC = 0.5;
export const DEFAULT_MAX_PRICE_USDC = 0.25;

export interface IntakeInput {
  message: string;
  budgetUsdc?: number;
}

function parseEmbeddedBudget(msg: string): number | null {
  const match = msg.match(/\$\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 100) : null;
}

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseStrictJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  if (start === -1) return null;
  const end = trimmed.lastIndexOf('}');
  if (end <= start) return null;
  try {
    const value = JSON.parse(trimmed.slice(start, end + 1));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function inferAddressParams(msg: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const address = msg.match(/\b0x[a-fA-F0-9]{40}\b/);
  if (address) params.address = address[0];
  return params;
}

function inferChainId(msg: string): number | null {
  if (/base|8453/i.test(msg)) return 8453;
  if (/\bethereum\b|\bmainnet\b/i.test(msg)) return 1;
  return null;
}

function fallbackQuery(msg: string): string {
  const stripped = msg
    .replace(/\$\s*\d+(?:\.\d+)?/g, '')
    .replace(/\bbudget\s*(?:of|under|of about|~)?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\bbudget\s*(?:of|under|is)?\b.*$/i, '')
    .replace(/\b0x[a-fA-F0-9]{40}\b/g, '')
    .replace(/\b(?:pay|paying|run|check|get|give|show|tell|me|the|for|to|on|my|a|an|of|with|please|can|you|usdc|eth)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 60) || 'marketplace';
}

function sanitizeSpec(parsed: Record<string, unknown>, fallback: JobSpec): JobSpec {
  const budget = numberOr(parsed.budgetUsdc, fallback.budgetUsdc);
  const maxPrice = numberOr(parsed.maxPriceUsdc, DEFAULT_MAX_PRICE_USDC);
  let chainId: number | null = fallback.chainId;
  if (parsed.chainId === 8453 || parsed.chainId === '8453' || parsed.chainId === 'base') chainId = 8453;
  else if (parsed.chainId === 1 || parsed.chainId === '1') chainId = 1;
  return {
    goal: typeof parsed.goal === 'string' && parsed.goal.trim() ? String(parsed.goal).trim().slice(0, 300) : fallback.goal,
    query: typeof parsed.query === 'string' && parsed.query.trim() ? String(parsed.query).trim().slice(0, 80) : fallback.query,
    params: typeof parsed.params === 'object' && parsed.params !== null ? (parsed.params as Record<string, unknown>) : fallback.params,
    budgetUsdc: budget,
    chainId,
    maxPriceUsdc: Math.min(budget, maxPrice),
  };
}

export async function intake(input: IntakeInput): Promise<JobSpec> {
  const budgetUsdc = input.budgetUsdc ?? parseEmbeddedBudget(input.message) ?? DEFAULT_BUDGET_USDC;
  const fallbackSpec: JobSpec = {
    goal: input.message,
    query: fallbackQuery(input.message),
    params: inferAddressParams(input.message),
    budgetUsdc,
    chainId: inferChainId(input.message),
    maxPriceUsdc: Math.min(budgetUsdc, DEFAULT_MAX_PRICE_USDC),
  };

  try {
    const systemPrompt = [
      'You convert a user\'s plain-language goal into a structured job spec for a workflow broker.',
      'Return ONLY valid JSON with this exact shape:',
      '{"goal":"short restated goal","query":"3-6 keyword search query for a workflow marketplace","params":{},"chainId":8453 or null,"budgetUsdc":number,"maxPriceUsdc":number}',
      'Rules:',
      '- params: extract concrete inputs (addresses with 0x prefix, amounts, thresholds); leave empty when absent',
      '- chainId: 8453 (Base) when the user mentions Base, 1 for Ethereum mainnet, else null',
      '- budgetUsdc: the user\'s stated cap or 0.50',
      '- maxPriceUsdc: never above half the budget',
      '- Respond with raw JSON only, no markdown fences, no commentary.',
    ].join('\n');

    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.message },
      ],
      { temperature: 0.2, maxTokens: 400 }
    );

    const parsed = parseStrictJson(response.content);
    if (parsed) {
      return sanitizeSpec(parsed, fallbackSpec);
    }
  } catch (error) {
    console.error('Broker intent LLM failed, using heuristics:', error instanceof Error ? error.message : 'unknown');
  }

  return fallbackSpec;
}