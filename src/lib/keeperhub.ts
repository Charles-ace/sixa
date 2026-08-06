import type { ExecutionStage, ParsedIntent, SimulationResult, ExecutionResult } from './types';
import { getExecutionProvider, ProviderError } from './keeperhub/providers';
import type { ExecutionProvider, SimulationOutcome } from './keeperhub/providers/types';
import { detectEnvironment, resolveChainId } from './keeperhub/providers/types';
import { generateId } from './utils';

export { getConfigStatus, getExecutionProvider, ProviderError } from './keeperhub/providers';
export type { ProviderConfigStatus, ProviderMode, ExecutionProvider } from './keeperhub/providers';
export { chainName } from './keeperhub/providers/types';

export function toSimulationResult(intent: ParsedIntent, outcome: SimulationOutcome, provider: ExecutionProvider): SimulationResult {
  return {
    success: outcome.ok,
    wouldRevert: outcome.wouldRevert,
    revertReason: outcome.revertReason,
    errorCode: outcome.errorCode,
    unsupported: outcome.unsupported,
    gasEstimateUnits: outcome.gas.gasEstimateUnits || undefined,
    gasEstimateUsd: outcome.gas.gasCostUsd,
    congestion: outcome.gas.congestion,
    strategy: outcome.gas.strategy || undefined,
    slippage: 0.003,
    warnings: outcome.warnings,
    expectedOutcome: outcome.expectedOutcome,
    simulatedAt: new Date().toISOString(),
    provider: provider.id,
    environment: provider.environment,
    protectedExecution: provider.protectedExecution,
    simulated: provider.id === 'mock',
  };
}

export async function simulateForChat(intent: ParsedIntent): Promise<SimulationResult | undefined> {
  let provider: ExecutionProvider;
  try {
    provider = getExecutionProvider();
  } catch (error) {
    const err = error as ProviderError;
    return {
      success: false,
      wouldRevert: false,
      errorCode: err.code,
      revertReason: err.message,
      warnings: [],
      expectedOutcome: '',
      simulatedAt: new Date().toISOString(),
      provider: 'none',
      environment: detectEnvironment(resolveChainId()),
      protectedExecution: false,
    };
  }

  try {
    const outcome = await provider.simulate(intent);
    return toSimulationResult(intent, outcome, provider);
  } catch (error) {
    const err = error as ProviderError;
    return {
      success: false,
      wouldRevert: false,
      errorCode: err.code,
      revertReason: err.message,
      warnings: [],
      expectedOutcome: '',
      simulatedAt: new Date().toISOString(),
      provider: provider.id,
      environment: provider.environment,
      protectedExecution: provider.protectedExecution,
    };
  }
}

export function buildExecutionStages(intent: ParsedIntent, providerId: string): ExecutionStage[] {
  const label = intent.type.charAt(0).toUpperCase() + intent.type.slice(1);
  const isMock = providerId === 'mock';
  const relay = isMock ? 'Local dev relay (no real broadcast)' : 'Writes relay through KeeperHub infrastructure';

  return [
    { id: 'intent', label: 'AI understood request', icon: 'brain', status: 'pending', detail: intent.type },
    { id: 'build', label: 'Building transaction', icon: 'build', status: 'pending', detail: `${intent.params?.fromToken ?? ''} → ${intent.params?.toToken ?? ''}` },
    { id: 'simulate', label: isMock ? 'Dev simulation (no RPC call)' : 'Dry-run simulation on chain', icon: 'simulate', status: 'pending', detail: isMock ? 'labeled — not a real preflight' : 'revert check + live gas estimate' },
    { id: 'gas', label: isMock ? 'Dev gas estimate' : 'Gas estimate from live simulation', icon: 'gas', status: 'pending', detail: isMock ? 'dev value only' : 'units returned by KeeperHub' },
    { id: 'privacy', label: 'Protected execution', icon: 'privacy', status: 'pending', detail: relay },
    { id: 'execute', label: isMock ? 'Simulated broadcast (dev)' : 'Broadcast through KeeperHub', icon: 'execute', status: 'pending', detail: label },
    { id: 'confirm', label: isMock ? 'Dev confirmation (not on-chain)' : 'On-chain receipt verification', icon: 'confirm', status: 'pending', detail: '' },
  ];
}

export function toExecutionResult(
  outcome: { ok: boolean; status: string; executionId?: string; txHash?: string; transactionLink?: string; receipts?: unknown[]; gasUsedWei?: string; error?: { code?: string; message: string; hint?: string; requestId?: string } },
  simulation: SimulationResult,
  provider: ExecutionProvider
): ExecutionResult {
  const receipts = (outcome.receipts ?? []) as Array<{ hash?: string; verified?: boolean; receiptStatus?: string }>;
  const verified = receipts.length > 0 ? receipts.every((r) => r.verified) : undefined;

  return {
    txHash: outcome.txHash ?? '',
    status: outcome.ok ? 'success' : 'failed',
    gasUsed: outcome.gasUsedWei ?? simulation.gasEstimateUnits ?? 'unknown',
    gasCostUsd: simulation.gasEstimateUsd ?? null,
    executedAt: new Date().toISOString(),
    auditId: outcome.executionId ?? generateId(),
    executionId: outcome.executionId,
    transactionLink: outcome.transactionLink,
    relayedVia: provider.id === 'keeperhub-mcp' ? 'keeperhub-mcp' : provider.id === 'mock' ? 'mock' : 'keeperhub',
    simulated: provider.id === 'mock',
    environment: provider.environment,
    protectedExecution: provider.protectedExecution,
    verified,
    receipts,
    error: outcome.error,
  };
}
