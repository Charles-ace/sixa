import type { ParsedIntent } from '@/lib/types';

export type ExecutionEnvironment = 'production' | 'testnet' | 'development';

export type ProviderMode = 'live' | 'testnet' | 'simulated' | 'misconfigured';

export interface ProviderConfigStatus {
  provider: string;
  configured: boolean;
  environment: ExecutionEnvironment;
  mode: ProviderMode;
  chainId: number;
  chainName: string;
  protectedExecution: boolean;
  message: string;
}

export interface ChainInfo {
  chainId: number;
  name: string;
  testnet: boolean;
  enabled: boolean;
  nativeSymbol: string;
}

export interface GasInfo {
  gasEstimateUnits: string;
  congestion: 'low' | 'medium' | 'high' | 'unknown';
  strategy: string;
  gasCostUsd: number | null;
}

export interface UnsupportedCapability {
  code: string;
  message: string;
  suggestion?: string;
}

export interface SimulationOutcome {
  ok: boolean;
  wouldRevert: boolean;
  revertReason?: string;
  errorCode?: string;
  from?: string;
  to?: string;
  gas: GasInfo;
  expectedOutcome: string;
  warnings: string[];
  unsupported?: UnsupportedCapability;
}

export interface ReceiptInfo {
  hash?: string;
  chainId?: number;
  verified?: boolean;
  receiptStatus?: string;
  blockNumber?: number;
  gasUsed?: string;
}

export interface ExecutionOutcome {
  ok: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executionId?: string;
  txHash?: string;
  transactionLink?: string;
  receipts?: ReceiptInfo[];
  gasUsedWei?: string;
  sponsored?: boolean;
  error?: {
    code?: string;
    message: string;
    hint?: string;
    requestId?: string;
  };
}

export interface BridgeRoute {
  executable: boolean;
  fromChain: string;
  toChain: string;
  code?: string;
  message: string;
  suggestion?: string;
  simulated?: boolean;
}

export interface CredentialCheck {
  ok: boolean;
  keyName?: string;
  keyPrefix?: string;
  expiresAt?: string | null;
  scope?: string;
  error?: string;
}

export interface ExecutionProvider {
  readonly id: string;
  readonly environment: ExecutionEnvironment;
  readonly protectedExecution: boolean;
  isConfigured(): boolean;
  simulate(intent: ParsedIntent): Promise<SimulationOutcome>;
  execute(intent: ParsedIntent): Promise<ExecutionOutcome>;
  getExecutionStatus(executionId: string): Promise<ExecutionOutcome>;
  getSupportedChains(): Promise<ChainInfo[]>;
  getBridgeRoute(intent: ParsedIntent): Promise<BridgeRoute>;
  verifyCredentials(): Promise<CredentialCheck>;
}

export const TESTNET_CHAIN_IDS = new Set<number>([
  11155111, 84532, 5, 11155420, 80002, 43113, 97, 420,
]);

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  8453: 'Base',
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
};

export function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

export function detectEnvironment(chainId: number): ExecutionEnvironment {
  const env = process.env.KEEPERHUB_ENVIRONMENT;
  if (env === 'production' || env === 'testnet' || env === 'development') {
    return env;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'development';
  }
  return TESTNET_CHAIN_IDS.has(chainId) ? 'testnet' : 'production';
}

export function resolveChainId(): number {
  const raw = process.env.KEEPERHUB_CHAIN_ID;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 8453;
}

export function isKeeperHubCredentialed(): boolean {
  return Boolean(process.env.KEEPERHUB_API_KEY);
}
