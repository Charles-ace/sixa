import { NextRequest, NextResponse } from 'next/server';
import { resumeFallbackAfterAuthorization } from '@/lib/broker/pipeline';
import type { BrokerJob } from '@/lib/broker/types';

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The browser already polls the full job object. When the shared store
  // (Vercel Blob) is unreachable and the server-side lookup misses the job,
  // the client-held job lets the authorization resume anyway.
  const body = (await request.json().catch(() => ({}))) as { job?: BrokerJob | null };
  const clientJob = body?.job && body.job.id === id ? body.job : undefined;
  const result = await resumeFallbackAfterAuthorization(id, clientJob);
  if (!result.ok) {
    const status = result.code === 'job_not_found' ? 404 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, job: result.job });
}
