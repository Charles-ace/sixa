import { keeperHubFetch, ProviderError } from '@/lib/keeperhub/providers/http';
import { detectEnvironment, resolveChainId } from '@/lib/keeperhub/providers/types';
import { generateId } from '@/lib/utils';
import type {
  WorkflowEdge,
  WorkflowExecutionOutcome,
  WorkflowNode,
} from './types';

export interface KeeperHubWorkflow {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  organizationId?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  visibility?: string;
  enabled?: boolean;
  sourceWorkflowId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  workflowType?: string;
  projectId?: string | null;
  tagId?: string | null;
  inputSchema?: unknown;
  outputMapping?: unknown;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  projectId?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled?: boolean;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  enabled?: boolean;
  tagId?: string | null;
  projectId?: string | null;
  visibility?: string;
}

export interface ExecuteWorkflowResponse {
  executionId?: string;
  status?: string;
  message?: string;
}

export interface ExecutionStatusResponse {
  executionId?: string;
  workflowId?: string;
  status?: string;
  type?: string;
  transactionHashes?: string[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
  nodeStatuses?: Array<{ nodeId?: string; status?: string }>;
  errorContext?: {
    failedNodeId?: string | null;
    lastSuccessfulNodeId?: string | null;
    lastSuccessfulNodeName?: string | null;
    executionTrace?: string[];
    error?: string;
  };
}

export interface ExecutionLogEntry {
  nodeId?: string;
  nodeLabel?: string;
  status?: string;
  message?: string;
  time?: string;
  data?: unknown;
}

export interface WorkflowLogsResponse {
  executionId?: string;
  logs?: ExecutionLogEntry[];
  error?: string;
}

export interface WorkflowProvider {
  readonly id: string;
  readonly environment: string;
  readonly protectedExecution: boolean;
  isConfigured(): boolean;
  listWorkflows(): Promise<KeeperHubWorkflow[]>;
  getWorkflow(id: string): Promise<KeeperHubWorkflow>;
  createWorkflow(input: CreateWorkflowInput): Promise<KeeperHubWorkflow>;
  updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<KeeperHubWorkflow>;
  setEnabled(id: string, enabled: boolean): Promise<KeeperHubWorkflow>;
  deleteWorkflow(id: string, force?: boolean): Promise<{ ok: boolean }>;
  executeWorkflow(id: string, input?: Record<string, unknown>): Promise<ExecuteWorkflowResponse>;
  getExecutionStatus(executionId: string): Promise<ExecutionStatusResponse>;
  getExecutionLogs(executionId: string): Promise<WorkflowLogsResponse>;
  waitForExecution(executionId: string, maxPolls?: number, intervalMs?: number): Promise<WorkflowExecutionOutcome>;
}

export class KeeperHubWorkflowProvider implements WorkflowProvider {
  readonly id = 'keeperhub';
  readonly environment = detectEnvironment(resolveChainId());
  readonly protectedExecution = true;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts?: { endpoint?: string; apiKey?: string }) {
    this.baseUrl = (opts?.endpoint ?? process.env.KEEPERHUB_ENDPOINT ?? 'https://app.keeperhub.com').replace(/\/$/, '');
    this.apiKey = opts?.apiKey ?? process.env.KEEPERHUB_API_KEY ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderError({
        code: 'config_required',
        message: 'KeeperHub is not configured. Set KEEPERHUB_ENDPOINT and KEEPERHUB_API_KEY.',
        hint: 'Create an organization API key at app.keeperhub.com → Settings → API Keys.',
        docs: 'https://docs.keeperhub.com/api/authentication',
      });
    }
  }

  async listWorkflows(): Promise<KeeperHubWorkflow[]> {
    this.requireConfigured();
    const response = await keeperHubFetch<KeeperHubWorkflow[]>(this.baseUrl, {
      method: 'GET',
      path: '/api/workflows',
      apiKey: this.apiKey,
    });
    return response.data ?? [];
  }

  async getWorkflow(id: string): Promise<KeeperHubWorkflow> {
    this.requireConfigured();
    const response = await keeperHubFetch<KeeperHubWorkflow>(this.baseUrl, {
      method: 'GET',
      path: `/api/workflows/${encodeURIComponent(id)}`,
      apiKey: this.apiKey,
    });
    return response.data;
  }

  async createWorkflow(input: CreateWorkflowInput): Promise<KeeperHubWorkflow> {
    this.requireConfigured();
    const response = await keeperHubFetch<KeeperHubWorkflow>(this.baseUrl, {
      method: 'POST',
      path: '/api/workflows/create',
      apiKey: this.apiKey,
      body: input,
    });
    return response.data;
  }

  async updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<KeeperHubWorkflow> {
    this.requireConfigured();
    const response = await keeperHubFetch<KeeperHubWorkflow>(this.baseUrl, {
      method: 'PATCH',
      path: `/api/workflows/${encodeURIComponent(id)}`,
      apiKey: this.apiKey,
      body: input,
    });
    return response.data;
  }

  async setEnabled(id: string, enabled: boolean): Promise<KeeperHubWorkflow> {
    return this.updateWorkflow(id, { enabled });
  }

  async deleteWorkflow(id: string, force = false): Promise<{ ok: boolean }> {
    this.requireConfigured();
    const response = await keeperHubFetch<{ ok?: boolean }>(this.baseUrl, {
      method: 'DELETE',
      path: `/api/workflows/${encodeURIComponent(id)}${force ? '?force=true' : ''}`,
      apiKey: this.apiKey,
    });
    return { ok: response.data?.ok ?? true };
  }

  async executeWorkflow(id: string, input?: Record<string, unknown>): Promise<ExecuteWorkflowResponse> {
    this.requireConfigured();
    const response = await keeperHubFetch<ExecuteWorkflowResponse>(this.baseUrl, {
      method: 'POST',
      path: `/api/workflows/${encodeURIComponent(id)}/execute`,
      apiKey: this.apiKey,
      body: input !== undefined ? { input } : {},
    });
    return response.data;
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionStatusResponse> {
    this.requireConfigured();
    const response = await keeperHubFetch<ExecutionStatusResponse>(this.baseUrl, {
      method: 'GET',
      path: `/api/workflows/executions/${encodeURIComponent(executionId)}/status`,
      apiKey: this.apiKey,
    });
    return response.data;
  }

  async getExecutionLogs(executionId: string): Promise<WorkflowLogsResponse> {
    this.requireConfigured();
    const response = await keeperHubFetch<WorkflowLogsResponse>(this.baseUrl, {
      method: 'GET',
      path: `/api/workflows/executions/${encodeURIComponent(executionId)}/logs`,
      apiKey: this.apiKey,
    });
    return response.data;
  }

  async waitForExecution(executionId: string, maxPolls = 12, intervalMs = 2000): Promise<WorkflowExecutionOutcome> {
    for (let poll = 0; poll < maxPolls; poll += 1) {
      const status = await this.getExecutionStatus(executionId);
      const current = status.status ?? 'pending';

      if (current === 'completed' || current === 'success' || current === 'succeeded') {
        return {
          ok: true,
          status: current,
          executionId,
          transactionHashes: status.transactionHashes,
        };
      }

      if (current === 'failed' || current === 'error' || current === 'cancelled') {
        return {
          ok: false,
          status: current,
          executionId,
          error: { code: 'execution_failed', message: status.error ?? 'Workflow execution failed.', hint: `Inspect with executionId ${executionId}.` },
        };
      }

      if (current === 'pending' || current === 'running' || current === 'in_progress') {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      return {
        ok: true,
        status: current,
        executionId,
        transactionHashes: status.transactionHashes,
      };
    }

    return {
      ok: false,
      status: 'timeout',
      executionId,
      error: {
        code: 'poll_timeout',
        message: 'Timed out waiting for workflow execution to finish.',
        hint: `Query /api/workflows/executions/${executionId}/status later.`,
      },
    };
  }
}

export class MockWorkflowProvider implements WorkflowProvider {
  readonly id = 'mock';
  readonly environment = detectEnvironment(resolveChainId());
  readonly protectedExecution = false;

  constructor() {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK) {
      throw new Error(
        'MockWorkflowProvider is disabled in production. Configure KEEPERHUB_API_KEY to enable real workflow management.'
      );
    }
  }

  isConfigured(): boolean {
    return false;
  }

  async listWorkflows(): Promise<KeeperHubWorkflow[]> {
    return [
      {
        id: 'mock-demo-rebalance',
        name: 'Dev Demo: Monthly Rebalance (not real)',
        description: 'DEV SIMULATION — created by the mock provider. No real workflow exists in KeeperHub.',
        nodes: [],
        edges: [],
        enabled: false,
        workflowType: 'dev',
      },
    ];
  }

  async getWorkflow(id: string): Promise<KeeperHubWorkflow> {
    const list = await this.listWorkflows();
    const found = list.find((w) => w.id === id);
    if (!found) {
      throw new ProviderError({ code: 'not_found', message: `Mock workflow ${id} not found.` });
    }
    return found;
  }

  async createWorkflow(input: CreateWorkflowInput): Promise<KeeperHubWorkflow> {
    return { id: `mock_${generateId()}`, name: input.name, description: input.description, nodes: input.nodes, edges: input.edges, enabled: input.enabled, workflowType: 'dev' };
  }

  async updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<KeeperHubWorkflow> {
    const workflow = await this.getWorkflow(id);
    return { ...workflow, ...input };
  }

  async setEnabled(id: string, enabled: boolean): Promise<KeeperHubWorkflow> {
    return this.updateWorkflow(id, { enabled });
  }

  async deleteWorkflow(_id: string, _force = false): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async executeWorkflow(_id: string, _input?: Record<string, unknown>): Promise<ExecuteWorkflowResponse> {
    throw new ProviderError({ code: 'mock_only', message: 'Mock workflows cannot execute on-chain. Configure KEEPERHUB_API_KEY.' });
  }

  async getExecutionStatus(_executionId: string): Promise<ExecutionStatusResponse> {
    return { status: 'pending' };
  }

  async getExecutionLogs(_executionId: string): Promise<WorkflowLogsResponse> {
    return { logs: [] };
  }

  async waitForExecution(executionId: string, _maxPolls = 1, _intervalMs = 0): Promise<WorkflowExecutionOutcome> {
    return { ok: false, status: 'failed', executionId, error: { code: 'mock_only', message: 'Mock workflows do not execute.' } };
  }
}

export function getWorkflowProvider(): WorkflowProvider {
  const credentialless = !process.env.KEEPERHUB_API_KEY;
  if (credentialless && process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK) {
    throw new ProviderError({
      code: 'config_required',
      message: 'KeeperHub is not configured. Workflow management is disabled until KEEPERHUB_API_KEY is set.',
      hint: 'Set KEEPERHUB_ENDPOINT and KEEPERHUB_API_KEY. The mock workflow provider is never used in production.',
      docs: 'https://docs.keeperhub.com/api/authentication',
      status: 503,
    });
  }
  return credentialless ? new MockWorkflowProvider() : new KeeperHubWorkflowProvider();
}

export type { WorkflowNode, WorkflowEdge, WorkflowNodeSummary, WorkflowTriggerType } from './types';

export { buildWorkflowEdge } from './builder';