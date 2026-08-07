import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowProvider, type CreateWorkflowInput } from '@/lib/workflows/provider';
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

export async function GET() {
  try {
    const provider = getWorkflowProvider();
    const workflows = await provider.listWorkflows();
    return NextResponse.json({
      workflows,
      provider: provider.id,
      protectedExecution: provider.protectedExecution,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: CreateWorkflowInput = {
      name: typeof body.name === 'string' ? body.name : 'Untitled workflow',
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
      ...(typeof body.projectId === 'string' ? { projectId: body.projectId } : {}),
      nodes: Array.isArray(body.nodes) ? body.nodes : [],
      edges: Array.isArray(body.edges) ? body.edges : [],
      enabled: typeof body.enabled === 'boolean' ? body.enabled : false,
    };

    if (input.nodes.length === 0) {
      return NextResponse.json({ error: 'Workflow must include nodes', code: 'invalid_input' }, { status: 400 });
    }

    const provider = getWorkflowProvider();
    const created = await provider.createWorkflow(input);
    return NextResponse.json({ workflow: { ...created, ...(created.id ? {} : {}) } }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}