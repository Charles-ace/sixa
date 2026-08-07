export interface KeeperHubErrorBody {
  error?: string;
  code?: string;
  detail?: string;
  message?: string;
  hint?: string;
  docs?: string;
  request_id?: string;
}

export class ProviderError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly requestId?: string;
  readonly status?: number;
  readonly docs?: string;
  readonly body?: unknown;

  constructor(opts: { code: string; message: string; hint?: string; requestId?: string; status?: number; docs?: string; body?: unknown }) {
    super(opts.message);
    this.name = 'ProviderError';
    this.code = opts.code;
    this.hint = opts.hint;
    this.requestId = opts.requestId;
    this.status = opts.status;
    this.docs = opts.docs;
    this.body = opts.body;
  }
}

const KNOWN_HINTS: Record<string, string> = {
  wallet_not_configured: 'Provision a wallet for this chain: https://docs.keeperhub.com/api/integrations',
  WALLET_NOT_CONFIGURED: 'Provision a wallet for this chain: https://docs.keeperhub.com/api/integrations',
  insufficient_balance: 'Fund the organization wallet with native gas on this chain, then retry.',
  rate_limited: 'You hit the KeeperHub rate limit. Wait a moment and retry.',
  daily_spending_cap_exceeded: 'The daily spending cap for this organization was exceeded. Raise it in the dashboard or wait for reset.',
};

export function isKeeperHubErrorBody(value: unknown): value is KeeperHubErrorBody {
  return typeof value === 'object' && value !== null;
}

export function normalizeError(status: number, body: unknown): ProviderError {
  if (!isKeeperHubErrorBody(body)) {
    return new ProviderError({ code: 'http_error', message: `KeeperHub returned HTTP ${status} with an unreadable body.`, status, body });
  }

  const code = String(body.code ?? body.error ?? 'http_error');
  const message = String(body.detail ?? body.message ?? body.error ?? `HTTP ${status}`);
  const hint = body.hint ?? KNOWN_HINTS[code];
  const docs = body.docs;
  const requestId = body.request_id;

  return new ProviderError({ code, message, hint, requestId, status, docs, body });
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  body?: unknown;
  apiKey?: string;
  idempotencyKey?: string;
  requestId?: string;
  headers?: Record<string, string>;
}

export async function keeperHubFetch<T>(
  baseUrl: string,
  opts: RequestOptions
): Promise<{ data: T; status: number; headers: Headers }> {
  const url = `${baseUrl.replace(/\/$/, '')}${opts.path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    ...(opts.requestId ? { 'x-request-id': opts.requestId } : {}),
    ...opts.headers,
  };

  const response = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new ProviderError({
        code: 'rate_limited',
        message: 'Rate limited by KeeperHub. Wait and retry.',
        hint: retryAfter ? `Retry after ${retryAfter}s.` : undefined,
        status: 429,
        body,
      });
    }
    throw normalizeError(response.status, body);
  }

  const envelope = body as { data?: T } | null;
  return { data: envelope?.data ?? (body as T), status: response.status, headers: response.headers };
}

export function parseTextContentResult(result: { content?: Array<{ type: string; text?: string }>; isError?: boolean } | undefined): { text: string; isError: boolean } {
  if (!result) return { text: '', isError: true };
  const text = (result.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');
  return { text, isError: Boolean(result.isError) };
}

export function parseJsonFromToolText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    if (start === -1) return null;
    try {
      return JSON.parse(trimmed.slice(start));
    } catch {
      return null;
    }
  }
}
