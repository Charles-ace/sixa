import { NextRequest, NextResponse } from 'next/server';
import { confirmUserPayment } from '@/lib/broker/pipeline';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { txHash?: string; from?: string };
  const result = await confirmUserPayment(id, body.txHash ?? '', body.from);

  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  const status =
    result.code === 'job_not_found' ? 404 : result.code === 'no_pending_payment' ? 409 : result.code === 'payment_mismatch' ? 422 : result.code === 'payment_unverified' ? 422 : 400;
  return NextResponse.json({ error: result.error, code: result.code, ...(result.hint ? { hint: result.hint } : {}) }, { status });
}