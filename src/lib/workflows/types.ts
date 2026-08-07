export type WorkflowTriggerType = 'Manual' | 'Schedule' | 'Webhook' | 'Event' | 'Block' | 'Transfer';

export type WorkflowActionType =
  | 'web3/transfer-funds'
  | 'web3/transfer-token'
  | 'web3/check-balance'
  | 'web3/read-contract'
  | 'web3/write-contract'
  | 'telegram/send-message'
  | 'Condition'
  | 'HTTP Request';

export interface WorkflowNodeConfig {
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action';
  position?: { x: number; y: number };
  data: {
    type: 'trigger' | 'action';
    label: string;
    description?: string;
    config: WorkflowNodeConfig;
    status?: 'idle' | 'running' | 'success' | 'error';
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false' | 'loop' | 'done';
}

export interface WorkflowStepSummary {
  trigger: {
    type: string;
    description: string;
    cron?: string;
  };
  actions: Array<{
    type: string;
    label: string;
    detail: string;
  }>;
  notifications: string[];
}

export interface WorkflowDraft {
  name: string;
  description: string;
  workflowType: 'transfer' | 'monitor' | 'alert' | 'harmonic' | 'manual';
  trigger: WorkflowTriggerType;
  triggerConfig: WorkflowNodeConfig;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  summary: WorkflowNodeSummary;
  missingFields: string[];
  confidence: number;
  source: 'llm' | 'rules';
  simulated?: boolean;
}

export interface WorkflowNodeSummary {
  trigger: {
    label: string;
    config: WorkflowNodeConfig;
  };
  actions: Array<{
    nodeId: string;
    label: string;
    actionType: string;
    config: WorkflowNodeConfig;
  }>;
  edges: WorkflowEdge[];
}

export interface WorkflowExecutionOutcome {
  ok: boolean;
  status: string;
  executionId?: string;
  transactionHashes?: string[];
  error?: { code?: string; message: string; hint?: string };
  logs?: Array<{ nodeId?: string; status?: string; message?: string; time?: string }>;
}

export interface WorkflowCredentialState {
  configured: boolean;
  provider: 'keeperhub' | 'mock';
  mode: 'live' | 'simulated';
  message: string;
}