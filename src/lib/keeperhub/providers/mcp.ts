import type { ChainInfo, ExecutionProvider, SimulationOutcome, ExecutionOutcome, BridgeRoute, CredentialCheck } from './types';
import { detectEnvironment, resolveChainId } from './types';
import { ProviderError, parseJsonFromToolText, parseTextContentResult } from './http';
import type { ParsedIntent } from '@/lib/types';

const DEFAULT_MCP_URL = 'https://app.keeperhub.com/mcp';
const PROTOCOL_VERSION = '2025-03-26';
const MAX_POLLS = 12;
const DEFAULT_POLL_INTERVAL_MS = 2000;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean } | unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

interface ExecuteTransferResult {
  success?: boolean;
  status?: string;
  executionId?: string;
  transactionHash?: string;
  transactionLink?: string;
  wouldRevert?: boolean;
  revertReason?: string;
  error?: string;
  gasEstimate?: string;
  from?: string;
  to?: string;
}

interface StatusResult {
  executionId?: string;
  status?: string;
  transactionHash?: string;
  transactionLink?: string;
  receipts?: Array<{ hash?: string; verified?: boolean; receiptStatus?: string }>;
  gasUsedWei?: string;
  sponsored?: boolean;
  error?: string | null;
}

interface ChainAction {
  chainId?: number;
  status?: string;
}

interface ActionSchema {
  actionType?: string;
  title?: string;
  name?: string;
  slug?: string;
  chains?: ChainAction[];
}

function parseSsePayload(body: string): JsonRpcResponse | null {
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      return JSON.parse(payload) as JsonRpcResponse;
    } catch {
      continue;
    }
  }
  return null;
}

export class KeeperHubMcpProvider implements ExecutionProvider {
  readonly id = 'keeperhub-mcp';
  readonly environment;
  readonly protectedExecution = true;

  private readonly url: string;
  private readonly apiKey: string;
  private readonly chainId: number;
  private sessionId: string | null = null;
  private rpcId = 1;
  private chainsCache: ChainInfo[] | null = null;

  constructor(opts?: { endpoint?: string; apiKey?: string; chainId?: number }) {
    this.url = (opts?.endpoint ?? process.env.KEEPERHUB_MCP_ENDPOINT ?? DEFAULT_MCP_URL).replace(/\/$/, '');
    this.apiKey = opts?.apiKey ?? process.env.KEEPERHUB_API_KEY ?? '';
    this.chainId = opts?.chainId ?? resolveChainId();
    this.environment = detectEnvironment(this.chainId);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    if (!this.isConfigured()) return { ok: false };
    try {
      await this.ensureInitialized();
      const parsed = await this.callToolText('list_integrations', {});
      if (!parsed.text.trim()) {
        return { ok: true, error: 'MCP reachable but returned an empty integration list.' };
      }
      return { ok: true };
    } catch (error) {
      const err = error as ProviderError;
      return { ok: false, error: err.message };
    }
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderError({
        code: 'config_required',
        message: 'KeeperHub MCP is not configured. Set KEEPERHUB_API_KEY.',
        hint: 'Pass the key as a Bearer token to https://app.keeperhub.com/mcp.',
        docs: 'https://docs.keeperhub.com/ai-tools/mcp-server',
      });
    }
  }

  private async request(method: string, params: unknown): Promise<JsonRpcResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
    };

    const body: JsonRpcRequest = { jsonrpc: '2.0', id: this.rpcId, method, ...(params !== undefined ? { params } : {}) };
    this.rpcId += 1;

    const response = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError({
        code: response.status === 401 ? 'unauthorized' : 'insufficient_scope',
        message: `KeeperHub MCP rejected the request (HTTP ${response.status}).`,
        hint: 'Check that the API key is valid and has the mcp:write scope for writes.',
      });
    }
    if (response.status === 429) {
      throw new ProviderError({ code: 'rate_limited', message: 'Rate limited by KeeperHub MCP. Wait and retry.', status: 429 });
    }
    if (!response.ok) {
      throw new ProviderError({ code: 'http_error', message: `KeeperHub MCP returned HTTP ${response.status}.`, status: response.status });
    }

    const raw = await response.text();
    const sessionId = response.headers.get('Mcp-Session-Id');
    if (sessionId) this.sessionId = sessionId;

    let payload: JsonRpcResponse | null = null;
    try {
      payload = JSON.parse(raw) as JsonRpcResponse;
    } catch {
      payload = parseSsePayload(raw);
    }

    if (!payload) {
      throw new ProviderError({ code: 'protocol_error', message: 'KeeperHub MCP returned an unreadable response.' });
    }
    if (payload.error) {
      throw new ProviderError({
        code: 'mcp_error',
        message: String(payload.error.message ?? 'MCP tool error'),
        ...(typeof payload.error.data === 'object' && payload.error.data
          ? { hint: `MCP error data: ${JSON.stringify(payload.error.data)}` }
          : {}),
      });
    }
    return payload;
  }

  private async callTool(name: string, arguments_: Record<string, unknown>): Promise<ToolResult> {
    const payload = await this.request('tools/call', { name, arguments: arguments_ });
    const result = payload.result as ToolResult | undefined;
    if (!result) {
      throw new ProviderError({ code: 'mcp_error', message: `Tool ${name} returned no result.` });
    }
    return result;
  }

  private async ensureInitialized(): Promise<void> {
    const payload = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'sixa', version: '1.0.0' },
    });
    void payload;
    await this.request('notifications/initialized', undefined);
  }

  private async callToolText(name: string, arguments_: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    const result = await this.callTool(name, arguments_);
    const parsed = parseTextContentResult(result);
    if (parsed.isError) {
      throw new ProviderError({
        code: 'tool_error',
        message: parsed.text.replace(/^Error:\s*/, '') || `MCP tool ${name} failed.`,
        hint: 'Treat any tool error as a failed preflight — no transaction was broadcast.',
      });
    }
    return parsed;
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
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} needs a protocol action the parsed intent does not describe precisely.`,
        suggestion: 'List available actions with list_action_schemas (or search_protocol_actions) and construct the exact actionType and parameters.',
      },
    };
  }

  private async simulateTransfer(intent: ParsedIntent): Promise<SimulationOutcome> {
    const params = intent.params ?? {};
    const parsed = await this.callToolText('execute_transfer', {
      chain_id: String(this.chainId),
      to_address: params.address ?? '',
      amount: String(params.amount ?? 0),
      ...(params.fromToken && params.fromToken.toUpperCase() !== 'ETH'
        ? { token_address: params.fromToken }
        : {}),
      simulate: true,
    });

    const data = (parseJsonFromToolText(parsed.text) as ExecuteTransferResult | null) ?? {};
    if (data.wouldRevert || data.success === false) {
      return {
        ok: false,
        wouldRevert: true,
        revertReason: data.revertReason ?? data.error ?? 'Transaction would revert.',
        errorCode: 'revert',
        gas: { gasEstimateUnits: '', congestion: 'unknown', strategy: '', gasCostUsd: null },
        expectedOutcome: '',
        warnings: [],
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
        strategy: 'gas estimation from KeeperHub MCP simulation',
        gasCostUsd: null,
      },
      expectedOutcome: `Simulation passed via KeeperHub MCP — ${data.gasEstimate ?? '0'} gas units, no revert.`,
      warnings: [],
    };
  }

  async simulate(intent: ParsedIntent): Promise<SimulationOutcome> {
    this.requireConfigured();
    await this.ensureInitialized();

    if (intent.type === 'send') {
      return this.simulateTransfer(intent);
    }

    return this.unsupportedCapability(intent);
  }

  async execute(intent: ParsedIntent): Promise<ExecutionOutcome> {
    this.requireConfigured();
    await this.ensureInitialized();

    if (intent.type !== 'send') {
      return {
        ok: false,
        status: 'failed',
        error: {
          code: 'capability_not_supported',
          message: `${intent.type} execution requires explicit protocol-action parameters.`,
          hint: 'Use a send/transfer intent.',
        },
      };
    }

    const params = intent.params ?? {};
    const parsed = await this.callToolText('execute_transfer', {
      chain_id: String(this.chainId),
      to_address: params.address ?? '',
      amount: String(params.amount ?? 0),
      ...(params.fromToken && params.fromToken.toUpperCase() !== 'ETH' ? { token_address: params.fromToken } : {}),
      idempotency_key: crypto.randomUUID(),
    });

    const data = (parseJsonFromToolText(parsed.text) as ExecuteTransferResult | null) ?? {};
    if (!data.executionId && data.status === 'completed') {
      return { ok: true, status: 'completed', txHash: data.transactionHash, transactionLink: data.transactionLink };
    }
    if (data.error || !data.executionId) {
      return {
        ok: false,
        status: 'failed',
        error: { code: 'execution_failed', message: data.error ?? 'Broadcast failed without an execution id.', hint: 'Check wallet integration: get_wallet_integration.' },
      };
    }

    return this.pollStatus(data.executionId);
  }

  private async pollStatus(executionId: string): Promise<ExecutionOutcome> {
    let intervalMs = DEFAULT_POLL_INTERVAL_MS;

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      const parsed = await this.callToolText('get_direct_execution_status', { execution_id: executionId });
      const data = (parseJsonFromToolText(parsed.text) as StatusResult | null) ?? {};
      const status = data.status ?? 'pending';

      if (status === 'completed' || status === 'failed') {
        return {
          ok: status === 'completed',
          status,
          executionId,
          txHash: data.transactionHash,
          transactionLink: data.transactionLink,
          receipts: data.receipts,
          gasUsedWei: data.gasUsedWei,
          sponsored: data.sponsored,
          error: data.error
            ? { code: 'execution_failed', message: data.error }
            : undefined,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      intervalMs = Math.min(intervalMs * 2, 8000);
    }

    return {
      ok: false,
      status: 'failed',
      executionId,
      error: {
        code: 'poll_timeout',
        message: 'Timed out waiting for the execution to settle.',
        hint: `Query get_direct_execution_status with execution_id ${executionId}.`,
      },
    };
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionOutcome> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callToolText('get_direct_execution_status', { execution_id: executionId });
    const data = (parseJsonFromToolText(parsed.text) as StatusResult | null) ?? {};
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
    this.requireConfigured();
    await this.ensureInitialized();

    const parsed = await this.callToolText('list_action_schemas', {});
    const data = (parseJsonFromToolText(parsed.text) as { actionSchemas?: ActionSchema[] } | null) ?? {};

    const chains = new Map<number, ChainInfo>();
    for (const schema of data.actionSchemas ?? []) {
      for (const chain of schema.chains ?? []) {
        const chainId = Number(chain.chainId ?? 0);
        if (!chainId || chains.has(chainId)) continue;
        chains.set(chainId, {
          chainId,
          name: `Chain ${chainId}`,
          testnet: false,
          enabled: chain.status !== 'deprecated',
          nativeSymbol: 'native',
        });
      }
    }

    this.chainsCache = Array.from(chains.values());
    return this.chainsCache;
  }

  async getBridgeRoute(intent: ParsedIntent): Promise<BridgeRoute> {
    const fromChain = `chain ${this.chainId}`;
    const toChain = intent.params?.targetChain ?? 'unknown';
    return {
      executable: false,
      fromChain,
      toChain,
      code: 'bridge_execution_unsupported',
      message: 'The MCP transport does not expose a cross-chain bridge execution tool.',
      suggestion: 'Execute on the source chain, then on the destination chain, or wait for a bridge protocol action in list_action_schemas.',
    };
  }
}
