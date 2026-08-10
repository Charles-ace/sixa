import { NextRequest, NextResponse } from 'next/server';
import { resumeFallbackAfterAuthorization } from '@/lib/broker/pipeline';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await resumeFallbackAfterAuthorization(id);
  if (!result.ok) {
    const status = result.code === 'job_not_found' ? 404 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, job: result.job });
}
