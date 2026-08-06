import type { ChainInfo, ExecutionProvider, SimulationOutcome, ExecutionOutcome, BridgeRoute, CredentialCheck } from './types';
import { detectEnvironment, resolveChainId, chainName } from './types';
import { keeperHubFetch, ProviderError } from './http';
import type { ParsedIntent } from '@/lib/types';

const DEFAULT_BASE_URL = 'https://app.keeperhub.com';

const TOKEN_REGISTRY: Record<number, Record<string, string>> = {
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    WETH: '0x4200000000000000000000000000000000000006',
    wstETH: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  },
  84532: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  11155111: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
};

const NATIVE_SYMBOLS: Record<string, string> = {
  ETH: 'ETH',
  WETH: 'ETH',
  POL: 'POL',
  MATIC: 'POL',
  AVAX: 'AVAX',
};

const MAX_POLLS = 12;
const DEFAULT_POLL_INTERVAL_MS = 2000;

interface TransferBody {
  chainId: number;
  recipientAddress: string;
  amount: string;
  tokenAddress?: string;
  tokenConfig?: string;
  gasLimitMultiplier?: string;
  simulate?: boolean;
}

interface SimulatedTransferResponse {
  success: boolean;
  status?: string;
  from?: string;
  to?: string;
  value?: string;
  gasEstimate?: string;
  simulatedReturnValue?: unknown;
  wouldRevert?: boolean;
  revertReason?: string;
  error?: string;
  code?: string;
  balanceWei?: string;
  requiredWei?: string;
  shortfallWei?: string;
  nativeSymbol?: string;
}

interface ExecuteResponse {
  executionId?: string;
  status?: string;
  transactionHash?: string;
  transactionLink?: string;
  error?: string;
  idempotentReplay?: boolean;
}

interface StatusResponse {
  executionId?: string;
  status?: string;
  type?: string;
  transactionHash?: string;
  transactionLink?: string;
  sponsored?: boolean;
  receipts?: Array<{
    hash?: string;
    chainId?: number;
    verified?: boolean;
    receiptStatus?: string;
    blockNumber?: number;
    gasUsed?: string;
  }>;
  gasUsedWei?: string;
  error?: string | null;
}

interface ChainListResponse {
  chains?: Array<{
    chainId?: number;
    name?: string;
    testnet?: boolean;
    isTestnet?: boolean;
    enabled?: boolean;
    isEnabled?: boolean;
    nativeSymbol?: string;
    symbol?: string;
  }>;
}

export class KeeperHubRestProvider implements ExecutionProvider {
  readonly id = 'keeperhub';
  readonly environment;
  readonly protectedExecution = true;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly chainId: number;
  private readonly gasLimitMultiplier: string;
  private chainsCache: ChainInfo[] | null = null;

  constructor(opts?: { endpoint?: string; apiKey?: string; chainId?: number }) {
    this.baseUrl = (opts?.endpoint ?? process.env.KEEPERHUB_ENDPOINT ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = opts?.apiKey ?? process.env.KEEPERHUB_API_KEY ?? '';
    this.chainId = opts?.chainId ?? resolveChainId();
    this.gasLimitMultiplier = process.env.KEEPERHUB_GAS_LIMIT_MULTIPLIER || '1.2';
    this.environment = detectEnvironment(this.chainId);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    if (!this.isConfigured()) return { ok: false };
    try {
      const response = await keeperHubFetch<{ items?: Array<{ name?: string; keyPrefix?: string; expiresAt?: string | null; scope?: string }> }>(this.baseUrl, {
        method: 'GET',
        path: '/api/keys?limit=1',
        apiKey: this.apiKey,
      });
      const first = response.data.items?.[0];
      return {
        ok: true,
        keyName: first?.name,
        keyPrefix: first?.keyPrefix,
        expiresAt: first?.expiresAt ?? null,
        scope: first?.scope,
      };
    } catch (error) {
      if (error instanceof ProviderError && (error.status === 401 || error.status === 403)) {
        return { ok: false, error: error.message };
      }
      return { ok: true, error: 'Credentials reachable but key details could not be listed.' };
    }
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

  private resolveTokenAddress(symbol: string | undefined, fromToken: string | undefined): string | undefined {
    const token = fromToken ?? symbol;
    if (!token) return undefined;
    const upper = token.toUpperCase();
    if (NATIVE_SYMBOLS[upper]) return undefined;
    return TOKEN_REGISTRY[this.chainId]?.[token];
  }

  private buildTransferBody(intent: ParsedIntent, simulate: boolean): TransferBody {
    const params = intent.params ?? {};
    const tokenAddress = this.resolveTokenAddress(params.fromToken, params.fromToken);

    if (!simulate && params.fromToken && !NATIVE_SYMBOLS[params.fromToken.toUpperCase()] && !tokenAddress) {
      throw new ProviderError({
        code: 'unsupported_token',
        message: `${params.fromToken} is not in the token registry for ${chainName(this.chainId)}.`,
        hint: 'Only registered tokens can be sent without an explicit contract address.',
      });
    }

    return {
      chainId: this.chainId,
      recipientAddress: params.address ?? '',
      amount: String(params.amount ?? 0),
      ...(tokenAddress ? { tokenAddress } : {}),
      gasLimitMultiplier: this.gasLimitMultiplier,
      ...(simulate ? { simulate } : {}),
    };
  }

  private unsupportedCapability(intent: ParsedIntent): SimulationOutcome {
    const type = intent.type;
    return {
      ok: false,
      wouldRevert: false,
      gas: { gasEstimateUnits: '', congestion: 'unknown', strategy: '', gasCostUsd: null },
      expectedOutcome: '',
      warnings: [],
      unsupported: {
        code: 'capability_not_supported',
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} execution is not available through the KeeperHub Direct Execution API (REST transport).`,
        suggestion: `The KeeperHub MCP server exposes protocol actions (search_protocol_actions / execute_protocol_action) for ${type}. Configure KEEPERHUB_TRANSPORT=mcp once MCP support is enabled, or use a send/transfer intent which is fully supported.`,
      },
    };
  }

  async simulate(intent: ParsedIntent): Promise<SimulationOutcome> {
    this.requireConfigured();

    if (intent.type !== 'send') {
      return this.unsupportedCapability(intent);
    }

    try {
      const response = await keeperHubFetch<SimulatedTransferResponse>(this.baseUrl, {
        method: 'POST',
        path: '/api/execute/transfer',
        apiKey: this.apiKey,
        body: this.buildTransferBody(intent, true),
      });

      const data = response.data;
      if (!data.success || data.wouldRevert) {
        const code = data.code ?? 'revert';
        return {
          ok: false,
          wouldRevert: true,
          revertReason: data.revertReason ?? data.error ?? 'Transaction would revert.',
          errorCode: code,
          from: data.from,
          to: data.to,
          gas: { gasEstimateUnits: '', congestion: 'unknown', strategy: '', gasCostUsd: null },
          expectedOutcome: '',
          warnings: code === 'insufficient_balance' && data.shortfallWei ? [`Sender is short ${data.shortfallWei} wei (${data.nativeSymbol ?? 'native'}).`] : [],
        };
      }

      return {
        ok: true,
        wouldRevert: false,
        from: data.from,
        to: data.to,
        gas: {
          gasEstimateUnits: data.gasEstimate ?? '0',
          congestion: 'unknown',
          strategy: `gasLimitMultiplier ×${this.gasLimitMultiplier} applied at broadcast`,
          gasCostUsd: null,
        },
        expectedOutcome: `Simulation passed on ${chainName(this.chainId)} — ${data.gasEstimate ?? '0'} gas units, no revert.`,
        warnings: [],
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError({
        code: 'simulation_failed',
        message: `KeeperHub simulation request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        hint: 'Check network connectivity and that the chain is enabled for your organization.',
      });
    }
  }

  async execute(intent: ParsedIntent): Promise<ExecutionOutcome> {
    this.requireConfigured();

    if (intent.type !== 'send') {
      return {
        ok: false,
        status: 'failed',
        error: {
          code: 'capability_not_supported',
          message: `${intent.type} execution is not supported by the KeeperHub REST provider.`,
          hint: 'Use a send/transfer intent, or the MCP transport for protocol actions.',
        },
      };
    }

    const idempotencyKey = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    try {
      const broadcast = await keeperHubFetch<ExecuteResponse>(this.baseUrl, {
        method: 'POST',
        path: '/api/execute/transfer',
        apiKey: this.apiKey,
        idempotencyKey,
        requestId,
        body: this.buildTransferBody(intent, false),
      });

      const data = broadcast.data;
      const status = data.status ?? 'pending';

      if (data.error && status === 'failed') {
        return {
          ok: false,
          status: 'failed',
          error: { code: 'execution_failed', message: data.error, hint: 'Check the organization wallet balance and spending cap.' },
        };
      }

      if (status === 'completed') {
        return {
          ok: true,
          status: 'completed',
          executionId: data.executionId,
          txHash: data.transactionHash,
          transactionLink: data.transactionLink,
        };
      }

      if (status === 'failed') {
        return { ok: false, status: 'failed', executionId: data.executionId };
      }

      return await this.pollStatus(data.executionId ?? '');
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.status === 409 && error.code === 'idempotency_conflict') {
          return {
            ok: false,
            status: 'failed',
            error: {
              code: 'idempotency_conflict',
              message: 'A different request was already sent with this idempotency key. Nothing was executed.',
              hint: 'Retry with a fresh request.',
            },
          };
        }
        throw error;
      }
      throw new ProviderError({
        code: 'broadcast_failed',
        message: `KeeperHub broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
  }

  private async pollStatus(executionId: string): Promise<ExecutionOutcome> {
    let intervalMs = DEFAULT_POLL_INTERVAL_MS;

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      const response = await keeperHubFetch<StatusResponse>(this.baseUrl, {
        method: 'GET',
        path: `/api/execute/${encodeURIComponent(executionId)}/status`,
        apiKey: this.apiKey,
      });

      const hint = response.headers.get('X-Poll-Interval-Hint');
      if (hint && Number(hint) > 0) intervalMs = Number(hint) * 1000;

      const data = response.data;
      const status = data.status ?? 'pending';

      if (status === 'completed' || status === 'failed') {
        const receipts = data.receipts ?? [];
        const verified = receipts.length > 0 ? receipts.every((r) => r.verified) : undefined;

        return {
          ok: status === 'completed',
          status,
          executionId,
          txHash: data.transactionHash,
          transactionLink: data.transactionLink,
          receipts,
          gasUsedWei: data.gasUsedWei,
          sponsored: data.sponsored,
          error: data.error
            ? {
                code: 'execution_failed',
                message: data.error,
                hint: verified === false ? 'On-chain receipt verification failed. Check the explorer link above.' : undefined,
              }
            : undefined,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return {
      ok: false,
      status: 'failed',
      executionId,
      error: {
        code: 'poll_timeout',
        message: 'Timed out waiting for the execution to settle.',
        hint: `Check the status with executionId ${executionId}.`,
      },
    };
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionOutcome> {
    this.requireConfigured();
    const response = await keeperHubFetch<StatusResponse>(this.baseUrl, {
      method: 'GET',
      path: `/api/execute/${encodeURIComponent(executionId)}/status`,
      apiKey: this.apiKey,
    });
    const data = response.data;
    return {
      ok: data.status === 'completed',
      status: (data.status as ExecutionOutcome['status']) ?? 'pending',
      executionId,
      txHash: data.transactionHash,
      transactionLink: data.transactionLink,
      receipts: data.receipts,
      gasUsedWei: data.gasUsedWei,
      sponsored: data.sponsored,
    };
  }

  async getSupportedChains(): Promise<ChainInfo[]> {
    if (this.chainsCache) return this.chainsCache;

    const response = await keeperHubFetch<ChainListResponse>(this.baseUrl, {
      method: 'GET',
      path: '/api/chains',
      apiKey: this.apiKey,
    });

    const chains = (response.data.chains ?? []).map((chain) => ({
      chainId: Number(chain.chainId ?? 0),
      name: chain.name ?? `Chain ${chain.chainId ?? '?'}`,
      testnet: Boolean(chain.isTestnet ?? chain.testnet),
      enabled: Boolean(chain.isEnabled ?? chain.enabled),
      nativeSymbol: chain.nativeSymbol ?? chain.symbol ?? 'native',
    }));

    this.chainsCache = chains;
    return chains;
  }

  private async resolveTargetChain(target: string | undefined): Promise<number | null> {
    if (!target) return null;
    if (/^\d+$/.test(target)) {
      const id = Number(target);
      if (id > 0) return id;
    }
    const chains = await this.getSupportedChains();
    const match = chains.find(
      (chain) => chain.name.toLowerCase() === target.toLowerCase() || String(chain.chainId) === target
    );
    return match ? match.chainId : null;
  }

  async getBridgeRoute(intent: ParsedIntent): Promise<BridgeRoute> {
    this.requireConfigured();

    const fromChain = chainName(this.chainId);
    const target = intent.params?.targetChain;
    const targetId = await this.resolveTargetChain(target);
    const toChain = targetId ? chainName(targetId) : target ?? 'unknown';

    if (!targetId) {
      return {
        executable: false,
        fromChain,
        toChain,
        code: 'unknown_destination_chain',
        message: `"${target ?? 'unknown'}" is not a supported KeeperHub chain.`,
        suggestion: 'List supported chains with GET /api/chains and retry with an exact name or chain id.',
      };
    }

    if (targetId === this.chainId) {
      return {
        executable: false,
        fromChain,
        toChain,
        code: 'same_chain',
        message: 'Source and destination chains are the same — no bridge needed.',
      };
    }

    return {
      executable: false,
      fromChain,
      toChain,
      code: 'bridge_execution_unsupported',
      message: `Both chains are supported by KeeperHub, but the Direct Execution API has no cross-chain bridge endpoint.`,
      suggestion: 'Transfer the assets on the source chain, then execute on the destination chain. Protocol-action bridge support is planned via the MCP transport.',
    };
  }
}
