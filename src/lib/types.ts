export type ActionType = 'swap' | 'bridge' | 'stake' | 'portfolio' | 'balance' | 'history' | 'send' | 'unknown';

export type ExecutionEnvironment = 'production' | 'testnet' | 'development';

export interface UnsupportedCapability {
  code: string;
  message: string;
  suggestion?: string;
}

export interface TokenAmount {
  symbol: string;
  amount: number;
  chainId?: number;
}

export interface ParsedIntent {
  type: ActionType;
  confidence: number;
  raw: string;
  params?: {
    fromToken?: string;
    toToken?: string;
    amount?: number;
    sourceChain?: string;
    targetChain?: string;
    protocol?: string;
    address?: string;
  };
  reasoning: string[];
}

export interface SimulationResult {
  success: boolean;
  wouldRevert?: boolean;
  revertReason?: string;
  errorCode?: string;
  from?: string;
  to?: string;
  unsupported?: UnsupportedCapability;
  gasEstimateUnits?: string;
  gasEstimateUsd?: number | null;
  gasLimit?: string;
  congestion?: 'low' | 'medium' | 'high' | 'unknown';
  strategy?: string;
  slippage?: number;
  warnings: string[];
  expectedOutcome: string;
  simulatedAt: string;
  provider?: string;
  environment?: ExecutionEnvironment;
  protectedExecution?: boolean;
  simulated?: boolean;
}

export interface ExecutionStage {
  id: string;
  label: string;
  icon: 'brain' | 'build' | 'simulate' | 'gas' | 'privacy' | 'execute' | 'confirm';
  status: 'pending' | 'active' | 'done' | 'failed';
  detail?: string;
}

export interface ExecutionResult {
  txHash: string;
  status: 'success' | 'failed';
  gasUsed: string;
  gasCostUsd: number | null;
  executedAt: string;
  auditId: string;
  executionId?: string;
  transactionLink?: string;
  relayedVia?: 'keeperhub' | 'keeperhub-mcp' | 'mock';
  simulated?: boolean;
  environment?: ExecutionEnvironment;
  protectedExecution?: boolean;
  verified?: boolean;
  receipts?: Array<{ hash?: string; verified?: boolean; receiptStatus?: string }>;
  error?: {
    code?: string;
    message: string;
    hint?: string;
    requestId?: string;
  };
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  wallet: string;
  action: string;
  intent: ParsedIntent;
  simulation: SimulationResult;
  execution: ExecutionResult;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: ParsedIntent;
  timestamp: string;
  status?: 'thinking' | 'complete' | 'error';
}

export const SUPPORTED_NETWORKS = [
  { name: 'Ethereum', chainId: 1, shortName: 'eth', symbol: 'ETH', rpc: 'https://eth.llamarpc.com' },
  { name: 'Arbitrum', chainId: 42161, shortName: 'arb', symbol: 'ETH', rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'Base', chainId: 8453, shortName: 'base', symbol: 'ETH', rpc: 'https://mainnet.base.org' },
  { name: 'Optimism', chainId: 10, shortName: 'op', symbol: 'ETH', rpc: 'https://mainnet.optimism.io' },
  { name: 'Polygon', chainId: 137, shortName: 'poly', symbol: 'POL', rpc: 'https://polygon-rpc.com' },
  { name: 'Avalanche', chainId: 43114, shortName: 'avax', symbol: 'AVAX', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
] as const;

export const SUPPORTED_TOKENS = [
  { symbol: 'USDC', decimals: 6 },
  { symbol: 'USDT', decimals: 6 },
  { symbol: 'ETH', decimals: 18 },
  { symbol: 'WETH', decimals: 18 },
  { symbol: 'DAI', decimals: 18 },
  { symbol: 'WBTC', decimals: 8 },
  { symbol: 'stETH', decimals: 18 },
] as const;
