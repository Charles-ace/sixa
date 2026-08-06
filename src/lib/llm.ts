export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'qwen/qwen-2-7b-instruct:free',
] as const;

export type FreeModel = (typeof FREE_MODELS)[number];

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://sixa.xyz';
}

function getSiteName(): string {
  return process.env.NEXT_PUBLIC_SITE_NAME || 'Sixa';
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new LLMError(
      'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your environment variables.',
      500,
      'MISSING_API_KEY'
    );
  }
  return key;
}

async function handleResponse(response: Response): Promise<LLMResponse> {
  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || `Request failed with status ${response.status}`;
    const errorCode = data.error?.code || 'UNKNOWN_ERROR';

    if (response.status === 429) {
      throw new LLMError(
        'Rate limit exceeded. Please try again later.',
        429,
        'RATE_LIMIT'
      );
    }

    throw new LLMError(errorMessage, response.status, errorCode);
  }

  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new LLMError('No content in response', 500, 'EMPTY_RESPONSE');
  }

  return {
    content: choice.message.content,
    model: data.model || DEFAULT_MODEL,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

export async function chat(
  messages: ChatMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = getApiKey();

  const payload = {
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: false,
  };

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getSiteUrl(),
      'X-Title': getSiteName(),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function chatWithSystemPrompt(
  userMessage: string,
  systemPrompt: string,
  options: Omit<LLMOptions, 'systemPrompt'> = {}
): Promise<LLMResponse> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  return chat(messages, options);
}

export function isFreeModel(model: string): model is FreeModel {
  return FREE_MODELS.includes(model as FreeModel);
}

export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

export function getAvailableFreeModels(): readonly string[] {
  return FREE_MODELS;
}

export async function testConnection(): Promise<{ success: boolean; model: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const response = await chat(
      [{ role: 'user', content: 'Reply with just "OK" if you receive this.' }],
      { model: DEFAULT_MODEL, maxTokens: 10 }
    );
    return {
      success: true,
      model: response.model,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      model: DEFAULT_MODEL,
      latencyMs: Date.now() - start,
    };
  }
}