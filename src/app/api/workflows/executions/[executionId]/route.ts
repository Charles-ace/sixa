import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowProvider } from '@/lib/workflows/provider';
import { ProviderError } from '@/lib/keeperhub/providers/http';

const EXECUTION_ID_RE = /^[a-zA-Z0-9_-]{6,80}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ executionId: string }> }) {
  try {
    const { executionId } = await params;
    const includeLogs = request.nextUrl.searchParams.get('logs') === 'true';
    if (!EXECUTION_ID_RE.test(executionId)) {
      return NextResponse.json({ error: 'Invalid execution id', code: 'invalid_input' }, { status: 400 });
    }
    const provider = getWorkflowProvider();
    const status = await provider.getExecutionStatus(executionId);
    const logs = includeLogs ? await provider.getExecutionLogs(executionId).catch(() => null) : null;
    return NextResponse.json({ status, logs });
  } catch (error) {
    const err = error as ProviderError;
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return NextResponse.json({ error: err.message ?? 'Status lookup failed', code: err.code }, { status });
  }
}