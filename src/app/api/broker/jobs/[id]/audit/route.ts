import { NextRequest, NextResponse } from 'next/server';
import { getAudit, getJob, listJobs } from '@/lib/broker/pipeline';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job = await getJob(id);
  if (!job) {
    const all = await listJobs(true);
    job = all.find((j) => j.id === id) ?? null;
  }
  return NextResponse.json({ audit: job?.audit ?? (await getAudit(id)) });
}
