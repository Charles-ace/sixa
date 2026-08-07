import type { KeeperHubWorkflow, WorkflowNode, WorkflowProvider } from './provider';
import { getLiveUsdPrice } from '@/lib/market';

export interface ConditionSpec {
  mode: 'price' | 'balance' | 'exists';
  token?: string;
  operator: '<' | '<=' | '>' | '>=';
  thresholdUsd?: number;
  percent?: number;
  baselineUsd?: number;
  chainId?: number;
}

export interface WorkflowDecision {
  workflowId: string;
  name: string;
  evaluated: boolean;
  spec?: ConditionSpec;
  current?: number;
  met?: boolean;
  decision: 'execute' | 'hold' | 'skipped' | 'error';
  reason: string;
  cooldownRemainingMs?: number;
  executionId?: string;
}

export interface DecisionCycleResult {
  ranAt: string;
  considered: number;
  evaluated: number;
  executed: number;
  decisions: WorkflowDecision[];
  errors: string[];
}

const COOLDOWN_DEFAULT_MS = 15 * 60 * 1000;
const COOLDOWN_STORAGE_KEY = 'sixaDecisionCooldowns';

function getCooldownMs(): number {
  const raw = Number(process.env.SIXA_DECISION_COOLDOWN_MINUTES ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return COOLDOWN_DEFAULT_MS;
  return raw * 60 * 1000;
}

function readCooldowns(): Record<string, number> {
  try {
    if (typeof globalThis !== 'undefined') {
      const store = (globalThis as { [COOLDOWN_STORAGE_KEY]?: string })[COOLDOWN_STORAGE_KEY];
      if (store) return JSON.parse(store) as Record<string, number>;
    }
  } catch {
    // ignore corrupt in-memory state
  }
  return {};
}

function writeCooldowns(map: Record<string, number>): void {
  try {
    if (typeof globalThis !== 'undefined') {
      (globalThis as { [COOLDOWN_STORAGE_KEY]?: string })[COOLDOWN_STORAGE_KEY] = JSON.stringify(map);
    }
  } catch {
    // non-fatal
  }
}

function findNode(workflow: KeeperHubWorkflow, predicate: (node: WorkflowNode) => boolean): WorkflowNode | undefined {
  return (workflow.nodes ?? []).find(predicate);
}

function extractConditionSpec(workflow: KeeperHubWorkflow): { spec?: ConditionSpec; label?: string } {
  const conditionNode = findNode(workflow, (n) => String(n.data?.config?.actionType ?? n.data?.config?.type ?? '').toLowerCase() === 'condition');
  if (!conditionNode) return {};

  const cfg = (conditionNode.data?.config ?? {}) as Record<string, unknown>;

  if (typeof cfg.mode === 'string') {
    const spec: ConditionSpec = {
      mode: (cfg.mode as ConditionSpec['mode']) ?? 'price',
      operator: (cfg.operator as ConditionSpec['operator']) ?? '<',
      ...(typeof cfg.token === 'string' ? { token: cfg.token } : {}),
      ...(typeof cfg.thresholdUsd === 'number' ? { thresholdUsd: cfg.thresholdUsd } : {}),
      ...(typeof cfg.percent === 'number' ? { percent: cfg.percent } : {}),
      ...(typeof cfg.baselineUsd === 'number' ? { baselineUsd: cfg.baselineUsd } : {}),
      ...(typeof cfg.chainId === 'number' ? { chainId: cfg.chainId } : {}),
    };
    return { spec, label: conditionNode.data?.label };
  }

  const raw = typeof cfg.condition === 'string' ? cfg.condition : '';
  const below = raw.match(/<\s*([\d.]+)/);
  const above = raw.match(/>=\s*([\d.]+)/);
  if (below || above) {
    const numeric = Number((below ?? above)![1]);
    return {
      spec: {
        mode: 'price',
        token: String(cfg.token ?? 'ETH'),
        operator: below ? '<' : '>=',
        thresholdUsd: Number.isFinite(numeric) ? numeric : undefined,
      },
      label: conditionNode.data?.label,
    };
  }
  return { spec: { mode: 'exists', operator: '<' }, label: conditionNode.data?.label };
}

function isAutonomous(workflow: KeeperHubWorkflow): boolean {
  const trigger = (workflow.nodes ?? []).find((n) => n.type === 'trigger');
  return Boolean(trigger?.data?.config?.autonomous) || workflow.workflowType === 'monitor';
}

function compare(current: number, operator: ConditionSpec['operator'], threshold: number): boolean {
  switch (operator) {
    case '<':
      return current < threshold;
    case '<=':
      return current <= threshold;
    case '>':
      return current > threshold;
    case '>=':
      return current >= threshold;
    default:
      return false;
  }
}

async function evaluateWorkflow(workflow: KeeperHubWorkflow): Promise<WorkflowDecision> {
  const base: WorkflowDecision = {
    workflowId: workflow.id,
    name: workflow.name ?? 'Untitled workflow',
    evaluated: true,
    decision: 'hold',
    reason: 'Condition not met',
  };

  const { spec, label } = extractConditionSpec(workflow);
  if (!spec) {
    return { ...base, evaluated: false, decision: 'skipped', reason: 'No condition node — not an autonomous strategy' };
  }

  const token = spec.token ?? 'ETH';
  const chainId = spec.chainId ?? Number(process.env.KEEPERHUB_CHAIN_ID ?? 8453);

  if (spec.mode === 'exists') {
    return { ...base, spec, decision: 'hold', reason: 'Balance-presence conditions are not autonomously actionable' };
  }

  const threshold = spec.thresholdUsd;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
    return { ...base, spec, decision: 'error', reason: `Condition "${label ?? 'Condition'}" has no resolvable threshold` };
  }

  try {
    const current = await getLiveUsdPrice(token, chainId);
    const met = compare(current, spec.operator, threshold);
    return {
      ...base,
      spec,
      current,
      met,
      decision: met ? 'execute' : 'hold',
      reason: met
        ? `${token} is $${current.toFixed(2)}, ${spec.operator} threshold $${threshold.toFixed(2)} — firing`
        : `${token} is $${current.toFixed(2)}, holding (threshold $${threshold.toFixed(2)})`,
    };
  } catch (error) {
    return {
      ...base,
      spec,
      decision: 'error',
      reason: `Market lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

export async function runDecisionCycle(
  provider: WorkflowProvider,
  opts?: { dryRun?: boolean; onDecision?: (decision: WorkflowDecision) => void }
): Promise<DecisionCycleResult> {
  const result: DecisionCycleResult = {
    ranAt: new Date().toISOString(),
    considered: 0,
    evaluated: 0,
    executed: 0,
    decisions: [],
    errors: [],
  };

  let workflows: KeeperHubWorkflow[];
  try {
    workflows = await provider.listWorkflows();
  } catch (error) {
    result.errors.push(`listWorkflows failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return result;
  }

  const cooldown = getCooldownMs();
  const cooldownMap = readCooldowns();

  for (const workflow of workflows) {
    result.considered += 1;
    if (!workflow.enabled || !isAutonomous(workflow)) {
      result.decisions.push({
        workflowId: workflow.id,
        name: workflow.name ?? 'Untitled workflow',
        evaluated: false,
        decision: 'skipped',
        reason: `${workflow.enabled ? '' : 'Disabled'}${workflow.enabled ? '' : ' and '}not autonomous`,
      });
      continue;
    }

    const decision = await evaluateWorkflow(workflow);
    result.decisions.push(decision);
    if (!decision.evaluated || decision.decision === 'error') {
      if (decision.decision === 'error') result.errors.push(`${workflow.name}: ${decision.reason}`);
      continue;
    }
    result.evaluated += 1;

    const lastFired = cooldownMap[workflow.id] ?? 0;
    const remaining = lastFired + cooldown - Date.now();
    if (decision.decision === 'execute' && remaining > 0) {
      decision.decision = 'hold';
      decision.reason = `Already fired — cooling down (${Math.ceil(remaining / 1000)}s left)`;
      decision.cooldownRemainingMs = remaining;
      continue;
    }

    if (decision.decision !== 'execute') continue;

    if (opts?.dryRun) {
      decision.reason = `${decision.reason} (dry run — would execute)`;
      continue;
    }

    try {
      const fired = await provider.executeWorkflow(workflow.id);
      cooldownMap[workflow.id] = Date.now();
      writeCooldowns(cooldownMap);
      result.executed += 1;
      decision.executionId = fired.executionId;
      decision.reason = `${decision.reason} — executed (${fired.executionId ?? 'queued'})`;
      opts?.onDecision?.(decision);
    } catch (error) {
      decision.decision = 'error';
      decision.reason = `Execution failed: ${error instanceof Error ? error.message : 'unknown'}`;
      result.errors.push(`${workflow.name}: ${decision.reason}`);
    }
  }

  return result;
}