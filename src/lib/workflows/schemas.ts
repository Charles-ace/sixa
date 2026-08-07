import { keeperHubFetch } from '@/lib/keeperhub/providers/http';

export interface ActionSchema {
  actionType: string;
  label: string;
  description?: string;
  category?: string;
  integration?: string;
  requiresCredentials?: boolean;
  requiredFields?: Record<string, string>;
  optionalFields?: Record<string, string>;
  outputFields?: Record<string, string>;
  sourceHandles?: string[];
  behavior?: string;
}

export interface TriggerSchema {
  triggerType: string;
  label: string;
  description?: string;
  requiredFields?: Record<string, string>;
  optionalFields?: Record<string, string>;
  outputFields?: Record<string, string>;
}

export interface ChainSchema {
  chainId: number;
  name: string;
  symbol: string;
  chainType: string;
  isTestnet: boolean;
  status: string;
  explorerUrl?: string;
}

export interface WorkflowSchemas {
  version?: string;
  generatedAt?: string;
  actions: Record<string, ActionSchema>;
  triggers: Record<string, TriggerSchema>;
  chains: ChainSchema[];
  templateSyntax?: { pattern?: string; description?: string; examples?: Array<{ template: string; description?: string }>; notes?: string[] };
  builtinVariables?: { variables?: Record<string, { type?: string; description?: string; example?: string }> };
  tips?: string[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { data: WorkflowSchemas; fetchedAt: number } | null = null;

export async function getWorkflowSchemas(force = false): Promise<WorkflowSchemas> {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const response = await keeperHubFetch<WorkflowSchemas>(
    process.env.KEEPERHUB_ENDPOINT ?? 'https://app.keeperhub.com',
    {
      method: 'GET',
      path: '/api/mcp/schemas',
      apiKey: process.env.KEEPERHUB_API_KEY,
    }
  );

  cache = { data: response.data, fetchedAt: now };
  return response.data;
}

export function getActionSchema(schemas: WorkflowSchemas, actionType: string): ActionSchema | undefined {
  return schemas.actions[actionType];
}

export function getTriggerSchema(schemas: WorkflowSchemas, triggerType: string): TriggerSchema | undefined {
  return schemas.triggers[triggerType];
}

export function getChainByNetwork(schemas: WorkflowSchemas, network: string): ChainSchema | undefined {
  const id = Number(network);
  return schemas.chains.find((c) => c.chainId === id || String(c.chainId) === network || c.name.toLowerCase() === network.toLowerCase());
}

export function getChainByName(schemas: WorkflowSchemas, name: string): ChainSchema | undefined {
  const normalized = name.toLowerCase();
  return schemas.chains.find(
    (c) =>
      c.name.toLowerCase() === normalized ||
      c.name.toLowerCase().includes(normalized) ||
      c.symbol.toLowerCase() === normalized
  );
}

export function findActionsByCategory(schemas: WorkflowSchemas, category: string): ActionSchema[] {
  const needle = category.toLowerCase();
  return Object.values(schemas.actions).filter(
    (a) => a.category?.toLowerCase().includes(needle) || a.actionType.toLowerCase().includes(needle)
  );
}

export function describeAction(schema: ActionSchema): string {
  const required = Object.entries(schema.requiredFields ?? {})
    .map(([key, hint]) => `${key}=${hint}`)
    .join(' | ');
  return `${schema.actionType}: ${schema.label} — ${required ? `requires ${required}` : 'no required fields'}`;
}

export function describeTrigger(schema: TriggerSchema): string {
  const required = Object.entries(schema.requiredFields ?? {})
    .map(([key, hint]) => `${key}=${hint}`)
    .join(' | ');
  return `${schema.triggerType}: ${schema.label} — ${required ? `requires ${required}` : 'no required fields'}`;
}

export function summarizeSchemas(schemas: WorkflowSchemas, maxActions = 400): string {
  const lines: string[] = [];
  lines.push('Available KeeperHub trigger types:');
  for (const trigger of Object.values(schemas.triggers)) {
    lines.push(describeTrigger(trigger));
  }
  lines.push('');
  lines.push(`Available action types (${Object.keys(schemas.actions).length} total):`);
  Object.values(schemas.actions)
    .slice(0, maxActions)
    .forEach((action) => lines.push(describeAction(action)));
  lines.push('');
  lines.push(`Template syntax: ${schemas.templateSyntax?.pattern ?? '{{@nodeId:Label.field}}'}`);
  lines.push(`Supported chains: ${schemas.chains.map((c) => `${c.name} (${c.chainId})`).join(', ')}`);
  return lines.join('\n');
}