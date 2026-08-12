import { NextRequest, NextResponse } from 'next/server';
import { getJob, listJobs } from '@/lib/broker/pipeline';

export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job = await getJob(id);
  if (!job) {
    const all = await listJobs();
    job = all.find((j) => j.id === id) ?? null;
  }
  if (!job) {
    return NextResponse.json({ error: 'Job not found.', code: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ job });
}
