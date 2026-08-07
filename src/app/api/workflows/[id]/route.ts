import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowProvider, type UpdateWorkflowInput } from '@/lib/workflows/provider';
import { ProviderError } from '@/lib/keeperhub/providers/http';

function handleError(error: unknown, fallbackStatus = 500) {
  const err = error as ProviderError;
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : fallbackStatus;
  return NextResponse.json(
    {
      error: err.message ?? 'Workflow request failed',
      ...(err.code ? { code: err.code } : {}),
      ...(err.hint ? { hint: err.hint } : {}),
      ...(err.docs ? { docs: err.docs } : {}),
    },
    { status }
  );
}

const WORKFLOW_ID_RE = /^[a-z0-9]{10,40}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!WORKFLOW_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid workflow id', code: 'invalid_input' }, { status: 400 });
    }
    const provider = getWorkflowProvider();
    const workflow = await provider.getWorkflow(id);
    return NextResponse.json({ workflow });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!WORKFLOW_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid workflow id', code: 'invalid_input' }, { status: 400 });
    }
    const body = await request.json();
    const input: UpdateWorkflowInput = {};
    if (typeof body.name === 'string') input.name = body.name;
    if (typeof body.description === 'string') input.description = body.description;
    if (Array.isArray(body.nodes)) input.nodes = body.nodes;
    if (Array.isArray(body.edges)) input.edges = body.edges;
    if (typeof body.enabled === 'boolean') input.enabled = body.enabled;
    if ('tagId' in body) input.tagId = body.tagId;
    if ('projectId' in body) input.projectId = body.projectId;
    if ('visibility' in body) input.visibility = body.visibility;

    const provider = getWorkflowProvider();
    const workflow = await provider.updateWorkflow(id, input);
    return NextResponse.json({ workflow });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!WORKFLOW_ID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid workflow id', code: 'invalid_input' }, { status: 400 });
    }
    const force = request.nextUrl.searchParams.get('force') === 'true';
    const provider = getWorkflowProvider();
    const result = await provider.deleteWorkflow(id, force);
    return NextResponse.json({ ok: result.ok });
  } catch (error) {
    return handleError(error);
  }
}