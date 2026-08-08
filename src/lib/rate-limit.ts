import { NextRequest } from 'next/server';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => t > now - config.windowMs);
  if (hits.length >= config.limit) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterMs: hits[0] + config.windowMs - now };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

export function clearExpiredBuckets(): void {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => t > now - 60 * 60 * 1000);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}

setInterval(clearExpiredBuckets, 10 * 60 * 1000).unref?.();

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
