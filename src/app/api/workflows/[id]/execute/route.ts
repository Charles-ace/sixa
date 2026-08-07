import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowProvider } from '@/lib/workflows/provider';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import { sendTelegramMessage, buildAgentNotices } from '@/lib/workflows/telegram';

const WORKFLOW_ID_RE = /^[a-z0-9]{10,40}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!WORKFLOW_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid workflow id', code: 'invalid_input' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const input: Record<string, unknown> | undefined =
      body && typeof body.input === 'object' ? (body.input as Record<string, unknown>) : undefined;

    const provider = getWorkflowProvider();
    const result = await provider.executeWorkflow(id, input);

    if (result.executionId) {
      const notices = buildAgentNotices();
      const sent = await sendTelegramMessage(notices.executionStarted('workflow ' + id, result.executionId)).catch(() => null);
      return NextResponse.json({ executionId: result.executionId, status: result.status, telegram: sent ?? { ok: false, reason: 'no dispatch' } });
    }

    return NextResponse.json(result, { status: result.status === 'failed' ? 502 : 200 });
  } catch (error) {
    const err = error as ProviderError;
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return NextResponse.json(
      {
        error: err.message ?? 'Execution failed',
        ...(err.code ? { code: err.code } : {}),
        ...(err.hint ? { hint: err.hint } : {}),
      },
      { status }
    );
  }
}