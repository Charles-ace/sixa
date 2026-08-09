import { NextRequest, NextResponse } from 'next/server';
import { getAudit, getJob } from '@/lib/broker/pipeline';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found.', code: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ audit: await getAudit(jobId) });
}