import type { ExecutionResult, ExecutionStage, ParsedIntent, SimulationResult } from './types';
import { generateId } from './utils';

const KEEPERHUB_BASE_URL = process.env.KEEPERHUB_ENDPOINT || process.env.NEXT_PUBLIC_KEEPERHUB_ENDPOINT || '';
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY || process.env.NEXT_PUBLIC_KEEPERHUB_API_KEY || '';

const KEEPERHUB_CHAIN_ID = Number(process.env.KEEPERHUB_CHAIN_ID || 8453);

const ERC20_ADDRESSES: Record<string, string> = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  WETH: '0x4200000000000000000000000000000000000006',
  wstETH: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
  cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
};

const GAS_BASE = 0.00042;

const ACTION_GAS_MULTIPLIER: Record<string, number> = {
  swap: 2.2,
  bridge: 3.8,
  stake: 1.9,
  send: 1,
};

const DEX_PRICE_USD: Record<string, number> = {
  ETH: 3200, WETH: 3200, USDC: 1, USDT: 1, DAI: 1, WBTC: 96000, stETH: 3090, POL: 0.5, AVAX: 30,
};

const ETH_PRICE_USD = 3200;

export function estimateGasUsd(intent: ParsedIntent): { gasLimit: string; costUsd: number } {
  const ethCost = GAS_BASE * (ACTION_GAS_MULTIPLIER[intent.type] ?? 1);
  const costUsd = ethCost * ETH_PRICE_USD;
  return { gasLimit: `0x${Math.round(ethCost * 1e18 * 2.1).toString(16)}`, costUsd };
}

export function simulateIntent(intent: ParsedIntent): SimulationResult {
  const { gasLimit, costUsd } = estimateGasUsd(intent);
  const amount = intent.params?.amount ?? 0;
  const fromToken = intent.params?.fromToken ?? 'ETH';
  const toToken = intent.params?.toToken ?? 'USDC';

  let expectedOutcome = '';
  const price = DEX_PRICE_USD[toToken] ?? 1;
  const received = fromToken === 'USDC' || fromToken === 'USDT' || fromToken === 'DAI'
    ? amount / price
    : amount * (DEX_PRICE_USD[fromToken] ?? price);

  switch (intent.type) {
    case 'swap':
      expectedOutcome = `Receive approximately ${(received * (1 - 0.003)).toFixed(4)} ${toToken} for ${amount} ${fromToken}`;
      break;
    case 'bridge':
      expectedOutcome = `${amount} ${fromToken} arrives on ${intent.params?.targetChain ?? 'destination chain'} (~25 sec)`;
      break;
    case 'stake':
      expectedOutcome = `Stake ${amount} ETH → receive ${(amount * 0.999).toFixed(4)} stETH, earn ~3.2% APY`;
      break;
    case 'send':
      expectedOutcome = `${amount} ${fromToken} sent to ${intent.params?.address?.slice(0, 8) ?? 'destination'}...`;
      break;
    default:
      expectedOutcome = 'No executable action';
  }

  const warnings: string[] = [];
  if (intent.type === 'swap' && received * price < amount * 0.995) warnings.push('Price impact above 0.5% on this route.');
  if (intent.type === 'bridge' && amount > 5000) warnings.push('Large bridge amounts may take longer to finalize.');
  if (intent.type === 'stake') warnings.push('Staked assets cannot be unstaked instantly.');

  return {
    success: true,
    gasEstimateUsd: costUsd,
    gasLimit,
    slippage: 0.003,
    warnings,
    expectedOutcome,
    simulatedAt: new Date().toISOString(),
  };
}

export function buildExecutionStages(intent: ParsedIntent): ExecutionStage[] {
  const label = intent.type.charAt(0).toUpperCase() + intent.type.slice(1);
  return [
    { id: 'intent', label: 'AI understood request', icon: 'brain', status: 'pending', detail: intent.type },
    { id: 'build', label: 'Building transaction', icon: 'build', status: 'pending', detail: `${intent.params?.fromToken ?? ''} → ${intent.params?.toToken ?? ''}` },
    { id: 'simulate', label: 'Running simulation', icon: 'simulate', status: 'pending', detail: 'RPC call + revert check' },
    { id: 'gas', label: 'Smart gas selected', icon: 'gas', status: 'pending', detail: 'MEV-aware pricing' },
    { id: 'privacy', label: 'Private routing enabled', icon: 'privacy', status: 'pending', detail: 'No public mempool exposure' },
    { id: 'execute', label: 'Executing through KeeperHub', icon: 'execute', status: 'pending', detail: label },
    { id: 'confirm', label: 'Transaction confirmed', icon: 'confirm', status: 'pending', detail: '' },
  ];
}

interface KeeperHubExecuteRequest {
  intent: ParsedIntent;
  simulation: SimulationResult;
  wallet: string;
}

export async function executeThroughKeeperHub(request: KeeperHubExecuteRequest): Promise<ExecutionResult> {
  if (KEEPERHUB_BASE_URL && KEEPERHUB_API_KEY) {
    const chainId = (request.intent.params as { chainId?: number } | undefined)?.chainId ?? KEEPERHUB_CHAIN_ID;
    const params = request.intent.params ?? {};
    const tokenAddress = params.fromToken ? ERC20_ADDRESSES[params.fromToken.toUpperCase()] : undefined;

    const transferBody = {
      chainId,
      recipientAddress: params.address,
      amount: String(params.amount ?? 0),
      ...(tokenAddress ? { tokenAddress } : {}),
    };

    try {
      const dryRun = await fetch(`${KEEPERHUB_BASE_URL.replace(/\/$/, '')}/api/execute/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
          'X-Sixa-Client': 'web',
        },
        body: JSON.stringify({ ...transferBody, simulate: true }),
      });

      if (!dryRun.ok) {
        throw new Error(`Simulation rejected by KeeperHub: ${dryRun.status}`);
      }

      const simulated = await dryRun.json();
      if (simulated.wouldRevert) {
        throw new Error(simulated.revertReason ?? 'Transaction would revert — not broadcasting.');
      }

      const broadcast = await fetch(`${KEEPERHUB_BASE_URL.replace(/\/$/, '')}/api/execute/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
          'Idempotency-Key': crypto.randomUUID(),
          'X-Sixa-Client': 'web',
        },
        body: JSON.stringify(transferBody),
      });

      if (!broadcast.ok) {
        throw new Error(`KeeperHub execution failed: ${broadcast.status}`);
      }

      const data = await broadcast.json();

      return {
        txHash: data.transactionHash ?? '',
        status: data.status === 'completed' ? 'success' : 'failed',
        gasUsed: simulated.gasEstimate ?? 'unknown',
        gasCostUsd: request.simulation.gasEstimateUsd,
        executedAt: new Date().toISOString(),
        auditId: data.executionId ?? generateId(),
        executionId: data.executionId,
        transactionLink: data.transactionLink,
        relayedVia: 'keeperhub',
      };
    } catch (error) {
      console.error('KeeperHub direct execution error:', error);
      throw error;
    }
  }

  return simulateKeeperHubExecution(request);
}

export function simulateKeeperHubExecution(request: KeeperHubExecuteRequest): ExecutionResult {
  const hash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  return {
    txHash: hash,
    status: 'success',
    gasUsed: `${Math.round(120000 + Math.random() * 40000)}`,
    gasCostUsd: request.simulation.gasEstimateUsd,
    executedAt: new Date().toISOString(),
    auditId: generateId(),
    relayedVia: 'local-simulation',
  };
}

export function isKeeperHubConfigured(): boolean {
  return Boolean(KEEPERHUB_BASE_URL && KEEPERHUB_API_KEY);
}
