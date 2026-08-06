import type { ChainInfo, ExecutionProvider, SimulationOutcome, ExecutionOutcome, BridgeRoute } from './types';
import { detectEnvironment, resolveChainId } from './types';
import type { ParsedIntent } from '@/lib/types';
import { generateId } from '@/lib/utils';

const ERC20_PRICE_USD: Record<string, number> = {
  ETH: 3200, WETH: 3200, USDC: 1, USDT: 1, DAI: 1, WBTC: 96000, stETH: 3090, POL: 0.5, AVAX: 30,
};

const GAS_BASE = 0.00042;
const ACTION_GAS_MULTIPLIER: Record<string, number> = { swap: 2.2, bridge: 3.8, stake: 1.9, send: 1 };

const SUPPORTED_CHAINS: ChainInfo[] = [
  { chainId: 1, name: 'Ethereum', testnet: false, enabled: true, nativeSymbol: 'ETH' },
  { chainId: 8453, name: 'Base', testnet: false, enabled: true, nativeSymbol: 'ETH' },
  { chainId: 42161, name: 'Arbitrum', testnet: false, enabled: true, nativeSymbol: 'ETH' },
  { chainId: 10, name: 'Optimism', testnet: false, enabled: true, nativeSymbol: 'ETH' },
  { chainId: 137, name: 'Polygon', testnet: false, enabled: true, nativeSymbol: 'POL' },
  { chainId: 43114, name: 'Avalanche', testnet: false, enabled: true, nativeSymbol: 'AVAX' },
  { chainId: 11155111, name: 'Ethereum Sepolia', testnet: true, enabled: true, nativeSymbol: 'ETH' },
  { chainId: 84532, name: 'Base Sepolia', testnet: true, enabled: true, nativeSymbol: 'ETH' },
];

const DEV_SIMULATION_WARNING = 'DEV SIMULATION — no real transaction. Set KEEPERHUB_API_KEY to enable live execution.';

export class MockProvider implements ExecutionProvider {
  readonly id = 'mock';
  readonly environment = detectEnvironment(resolveChainId());
  readonly protectedExecution = false;

  private readonly chainId: number;

  constructor(opts?: { chainId?: number }) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK) {
      throw new Error(
        'MockProvider is disabled in production. Configure KEEPERHUB_API_KEY (and KEEPERHUB_ENDPOINT) to enable real execution.'
      );
    }
    this.chainId = opts?.chainId ?? resolveChainId();
  }

  isConfigured(): boolean {
    return false;
  }

  private estimateGas(intent: ParsedIntent): { units: string; costUsd: number } {
    const ethCost = GAS_BASE * (ACTION_GAS_MULTIPLIER[intent.type] ?? 1);
    return { units: String(Math.round(ethCost * 1e18 * 2.1 / 2e9)), costUsd: ethCost * 3200 };
  }

  async simulate(intent: ParsedIntent): Promise<SimulationOutcome> {
    const { units, costUsd } = this.estimateGas(intent);
    const amount = intent.params?.amount ?? 0;
    const fromToken = intent.params?.fromToken ?? 'ETH';
    const toToken = intent.params?.toToken ?? 'USDC';

    let expectedOutcome = '';
    const price = ERC20_PRICE_USD[toToken] ?? 1;
    const received =
      ['USDC', 'USDT', 'DAI'].includes(fromToken)
        ? amount / price
        : amount * (ERC20_PRICE_USD[fromToken] ?? price);

    switch (intent.type) {
      case 'swap':
        expectedOutcome = `Dev estimate: receive ~${(received * (1 - 0.003)).toFixed(4)} ${toToken} for ${amount} ${fromToken}`;
        break;
      case 'bridge':
        expectedOutcome = `Dev estimate: ${amount} ${fromToken} arrives on ${intent.params?.targetChain ?? 'destination chain'} (~25 sec)`;
        break;
      case 'stake':
        expectedOutcome = `Dev estimate: stake ${amount} ETH → receive ${(amount * 0.999).toFixed(4)} stETH, ~3.2% APY`;
        break;
      case 'send':
        expectedOutcome = `Dev estimate: ${amount} ${fromToken} to ${(intent.params?.address ?? 'destination').slice(0, 12)}…`;
        break;
      default:
        expectedOutcome = 'No executable action';
    }

    const warnings = [DEV_SIMULATION_WARNING];
    if (intent.type === 'swap' && received * price < amount * 0.995) warnings.push('Price impact above 0.5% on this route (dev estimate).');
    if (intent.type === 'bridge' && amount > 5000) warnings.push('Large bridge amounts may take longer to finalize.');
    if (intent.type === 'stake') warnings.push('Staked assets cannot be unstaked instantly.');

    return {
      ok: true,
      wouldRevert: false,
      gas: {
        gasEstimateUnits: units,
        congestion: 'unknown',
        strategy: 'dev estimate — no live gas data',
        gasCostUsd: costUsd,
      },
      expectedOutcome,
      warnings,
    };
  }

  async execute(intent: ParsedIntent): Promise<ExecutionOutcome> {
    const hash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const { units } = this.estimateGas(intent);
    return {
      ok: true,
      status: 'completed',
      executionId: `mock_${generateId()}`,
      txHash: hash,
      transactionLink: `https://sepolia.etherscan.io/tx/${hash}`,
      receipts: [
        { hash, verified: true, receiptStatus: 'success' },
      ],
      gasUsedWei: String(Number(units) * 2e9),
      sponsored: false,
    };
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionOutcome> {
    return { ok: true, status: 'completed', executionId };
  }

  async getSupportedChains(): Promise<ChainInfo[]> {
    return SUPPORTED_CHAINS;
  }

  async getBridgeRoute(intent: ParsedIntent): Promise<BridgeRoute> {
    const fromChain = `chain ${this.chainId}`;
    const toChain = intent.params?.targetChain ?? 'unknown';
    return {
      executable: true,
      fromChain,
      toChain,
      code: 'dev_route',
      message: 'DEV SIMULATION — a real bridge route is not computed without a live provider.',
      suggestion: 'Configure KEEPERHUB_API_KEY for real chain routing.',
      simulated: true,
    };
  }
}
