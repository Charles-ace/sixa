import { NextResponse } from 'next/server';
import { isSharedStoreBroken, usesSharedStore } from '@/lib/broker/store';
import { listJobs } from '@/lib/broker/pipeline';

export async function GET() {
  const store = {
    mode: usesSharedStore() ? 'shared-blob' : 'local-file',
    sharedBroken: isSharedStoreBroken(),
  };
  const jobs = await listJobs().catch(() => []);
  return NextResponse.json({
    ok: true,
    service: 'sixa',
    time: new Date().toISOString(),
    store,
    jobs: { count: jobs.length, completed: jobs.filter((j) => j.status === 'completed').length, failed: jobs.filter((j) => j.status === 'failed').length },
  });
}