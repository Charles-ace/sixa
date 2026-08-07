import type { WorkflowEdge, WorkflowNode } from './types';

export interface NodePosition {
  x: number;
  y: number;
}

export function buildTriggerNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: {
      type: 'trigger',
      label: 'Trigger',
      description: 'Workflow trigger',
      config,
      status: 'idle',
    },
  };
}

export function buildActionNode(
  id: string,
  label: string,
  config: Record<string, unknown>,
  description?: string,
  position?: NodePosition | { x: number; y: number }
): WorkflowNode {
  return {
    id,
    type: 'action',
    position: position ?? { x: 0, y: 0 },
    data: {
      type: 'action',
      label,
      ...(description ? { description } : {}),
      config,
      status: 'idle',
    },
  };
}

export function buildWorkflowEdge(
  source: string,
  target: string,
  options?: { sourceHandle?: 'true' | 'false' | 'loop' | 'done'; id?: string }
): WorkflowEdge {
  return {
    id: options?.id ?? `e-${source}-${target}`,
    source,
    target,
    ...(options?.sourceHandle ? { sourceHandle: options.sourceHandle } : {}),
  };
}

export function templateRef(nodeId: string, label: string, field: string): string {
  return `{{@${nodeId}:${label}.${field}}}`;
}

export function autoLayout(nodes: WorkflowNode[], xStep = 252, yStep = 232): WorkflowNode[] {
  const result = nodes.map((node) => ({ ...node }));
  result[0] = { ...result[0], position: { x: 0, y: 0 } };
  const parentCol: Record<string, number> = {};
  for (let i = 1; i < result.length; i += 1) {
    const prev = result[i - 1];
    const prevX = prev.position?.x ?? 0;
    const col = (parentCol[prev.id] ?? 0) + 1;
    parentCol[result[i].id] = col;
    result[i] = {
      ...result[i],
      position: { x: prevX + xStep, y: col % 2 === 1 ? 0 : yStep / 2 },
    };
  }
  return result;
}