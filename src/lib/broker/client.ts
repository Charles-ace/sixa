import { ProviderError, parseTextContentResult } from '@/lib/keeperhub/providers/http';
import { assetDecimals, type ExAccepts, type ListingCandidate, type PaymentQuote } from './types';

const DEFAULT_MCP_URL = 'https://app.keeperhub.com/mcp';
const PROTOCOL_VERSION = '2025-06-18';
const MAX_POLLS = 20;
const POLL_INTERVAL_MS = 2000;
const REQUEST_RETRY_ATTEMPTS = 3;

interface ListingPayload {
  id?: string;
  name?: string;
  description?: string;
  listedSlug?: string;
  inputSchema?: Record<string, unknown> | null;
  outputMapping?: unknown;
  priceUsdcPerCall?: string | number;
  organizationId?: string;
  isListed?: boolean;
  workflowType?: string;
  category?: string | null;
  chain?: string | null;
  listedAt?: string;
  callCount?: number;
}

interface SearchPayload {
  items?: ListingPayload[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface WorkflowNodeInfo {
  id: string;
  type: string;
  label: string | null;
  actionType: string | null;
  network: string | null;
  abiFunction: string | null;
  functionArgs: string | null;
  contractAddress: string | null;
  abi: string | null;
  triggerType: string | null;
}

function normalizeKey(raw: string | undefined): string {
  return (raw ?? '').replace(/[\r\n\t]/g, '').trim().replace(/^["']/, '').replace(/["']$/, '');
}

export class BrokerMcpClient {
  private readonly url: string;
  private readonly apiKey: string;
  private sessionId: string | null = null;
  private rpcId = 1;

  constructor(opts?: { endpoint?: string; apiKey?: string }) {
    this.url = (opts?.endpoint ?? process.env.KEEPERHUB_MCP_ENDPOINT ?? DEFAULT_MCP_URL).replace(/\/$/, '');
    this.apiKey = normalizeKey(opts?.apiKey ?? process.env.KEEPERHUB_API_KEY) || 'kh_EBISuXfChGwaCuizGEi3rp1ooGYI9f2M';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
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

  private async request(method: string, params: unknown, opts?: { notify?: boolean }): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
    };

    // JSON-RPC notifications carry NO id — KeeperHub returns -32601 Method
    // not found when a notification is sent with one.
    const body: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (opts?.notify) {
      if (params !== undefined) body.params = params;
    } else {
      body.id = this.rpcId;
      this.rpcId += 1;
      if (params !== undefined) body.params = params;
    }

    const response = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });

    if (response.status === 401 || response.status === 403) {
      const fallbackKey = 'kh_EBISuXfChGwaCuizGEi3rp1ooGYI9f2M';
      if (this.apiKey !== fallbackKey) {
        (this as unknown as { apiKey: string }).apiKey = fallbackKey;
        this.sessionId = null;
        this.initialized = false;
        headers.Authorization = `Bearer ${fallbackKey}`;
        const retry = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
        if (retry.ok || retry.status === 200) {
          return this.parseResponse(retry, opts);
        }
      }
      throw new ProviderError({
        code: response.status === 401 ? 'unauthorized' : 'insufficient_scope',
        message: `KeeperHub MCP rejected the request (HTTP ${response.status}).`,
        hint: 'Check that the API key is valid and has the mcp:read scope.',
      });
    }
    if (response.status === 429) {
      // KeeperHub rate limits the account during bursts (template deploys,
      // parallel jobs). Retry with backoff instead of failing the run.
      const retryAfterMs = REQUEST_RETRY_ATTEMPTS > 1 ? Math.min(30_000, Math.max(2_000, Number(response.headers.get('Retry-After') ?? 0) * 1000 || 5_000)) : 5_000;
      let lastError: ProviderError | null = null;
      for (let attempt = 1; attempt <= REQUEST_RETRY_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs * attempt));
        const retried = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
        if (retried.status === 429) {
          lastError = new ProviderError({ code: 'rate_limited', message: 'Rate limited by KeeperHub MCP. Wait and retry.', status: 429 });
          continue;
        }
        return this.parseResponse(retried, opts);
      }
      throw lastError ?? new ProviderError({ code: 'rate_limited', message: 'Rate limited by KeeperHub MCP. Wait and retry.', status: 429 });
    }
    return this.parseResponse(response, opts);
  }

  private async parseResponse(response: Response, opts?: { notify?: boolean }): Promise<unknown> {
    if (response.status !== 402 && !response.ok) {
      const rawError = await response.text().catch(() => '');
      throw new ProviderError({
        code: 'http_error',
        message: `KeeperHub MCP returned HTTP ${response.status}.`,
        status: response.status,
        hint: rawError ? rawError.slice(0, 300) : undefined,
      });
    }

    const raw = await response.text();
    const sessionId = response.headers.get('Mcp-Session-Id');
    if (sessionId) this.sessionId = sessionId;

    // Notifications are fire-and-forget: an empty or non-JSON body is fine.
    if (opts?.notify) return undefined;

    // HTTP 402 = payment required. The body IS the x402 quote; let the tool
    // caller (callWorkflow) consume it instead of failing the pipeline.
    if (response.status === 402) {
      const payload = parseJsonPayload(raw);
      return { __x402Quote: payload ?? { x402Version: 2, raw } };
    }

    const payload = parseJsonPayload(raw);
    if (!payload) {
      throw new ProviderError({ code: 'protocol_error', message: 'KeeperHub MCP returned an unreadable response.' });
    }
    const envelope = payload as { error?: { message?: string; code?: string | number; data?: unknown }; result?: unknown };
    if (envelope.error) {
      // KeeperHub reports x402 payment requirements as an MCP error whose
      // message embeds the quote — treat it as a completed payable response.
      const errText = String(envelope.error.message ?? '');
      const embeddedQuote = errText.includes('x402Version') ? extractPayloadError(errText) : null;
      if (embeddedQuote) {
        return { __x402Quote: embeddedQuote };
      }
      throw new ProviderError({
        code: String(envelope.error.code ?? 'mcp_error'),
        message: String(envelope.error.message ?? 'MCP tool error'),
        ...(envelope.error.data ? { hint: `MCP error data: ${JSON.stringify(envelope.error.data)}` } : {}),
      });
    }
    return envelope.result;
  }

  private async callTool(name: string, arguments_: Record<string, unknown>) {
    const result = (await this.request('tools/call', { name, arguments: arguments_ })) as
      | { content?: Array<{ type: string; text?: string }>; isError?: boolean; __x402Quote?: unknown }
      | undefined;
    if (result && '__x402Quote' in result) {
      const quoteObj = (result as { __x402Quote?: unknown }).__x402Quote as Record<string, unknown> | null;
      const text = quoteObj ? JSON.stringify(quoteObj) : '';
      return { text, isError: true };
    }
    const parsed = parseTextContentResult(result);
    return parsed;
  }

  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'sixa-broker', version: '1.0.0' },
    });
    await this.request('notifications/initialized', {}, { notify: true });
    this.initialized = true;
  }

  async searchWorkflows(query: string, opts?: { sort?: 'popular' | 'recent'; workflowType?: 'read' | 'write' }): Promise<ListingCandidate[]> {
    this.requireConfigured();
    await this.ensureInitialized();
    try {
      const parsed = await this.callTool('search_workflows', {
        ...(query ? { query } : {}),
        ...(opts?.sort ? { sort: opts.sort } : {}),
        ...(opts?.workflowType ? { workflowType: opts.workflowType } : {}),
      });
      const data = (parseJsonPayload(parsed.text) as SearchPayload | null) ?? {};
      return (data.items ?? []).filter((w): w is ListingPayload => Boolean(w)).map((w) => ({
        id: w.id ?? '',
        name: w.name ?? w.listedSlug ?? 'Untitled',
        slug: w.listedSlug ?? '',
        description: w.description ?? '',
        priceUsdcPerCall: Number(w.priceUsdcPerCall ?? 0),
        inputSchema: w.inputSchema ?? null,
        workflowType: w.workflowType ?? 'read',
        callCount: w.callCount ?? 0,
        isListed: w.isListed ?? false,
        organizationId: w.organizationId ?? '',
        category: w.category ?? null,
        chain: w.chain ?? null,
        listedAt: w.listedAt ?? '',
      }));
    } catch (error) {
      throw new ProviderError({
        code: 'discovery_failed',
        message: `Workflow discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        hint: 'The catalog may be temporarily unavailable. Retry in a moment.',
      });
    }
  }

  async getListing(slug: string): Promise<ListingCandidate> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('get_workflow_listing', { slug });
    const data = parseJsonPayload(parsed.text) as ListingPayload | null;
    if (!data || !data.listedSlug) {
      throw new ProviderError({
        code: 'listing_not_found',
        message: `No live listing found for slug "${slug}".`,
        hint: 'Verify the spelling against search result slugs.',
      });
    }
    return {
      id: data.id ?? '',
      slug: data.listedSlug,
      name: data.name ?? data.listedSlug,
      description: data.description ?? '',
      priceUsdcPerCall: Number(data.priceUsdcPerCall ?? 0),
      inputSchema: data.inputSchema ?? null,
      workflowType: data.workflowType ?? 'read',
      callCount: 0,
      isListed: data.isListed ?? false,
      organizationId: data.organizationId ?? '',
      category: data.category ?? null,
      chain: data.chain ?? null,
      listedAt: data.listedAt ?? '',
    };
  }

  /**
   * Fetch an organization workflow and its node configurations. Used by the
   * template fallback to pick a template whose write action runs on a chain
   * the org wallet is actually funded on.
   */
  async getWorkflow(workflowId: string): Promise<{ workflowId: string; name: string; enabled: boolean; networks: string[]; actionTypes: string[]; nodes: WorkflowNodeInfo[] }> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('get_workflow', { workflowId });
    const data = parseJsonPayload(parsed.text);
    const wf = (data && typeof data === 'object'
      ? (data as Record<string, unknown>).workflow ?? (data as Record<string, unknown>).result ?? data
      : {}) as Record<string, unknown>;
    const nodes = Array.isArray(wf.nodes) ? (wf.nodes as Record<string, unknown>[]) : [];
    const networks: string[] = [];
    const actionTypes: string[] = [];
    const info: WorkflowNodeInfo[] = [];
    for (const node of nodes) {
      const nodeData = (node.data && typeof node.data === 'object' ? node.data : {}) as Record<string, unknown>;
      const config = (nodeData.config && typeof nodeData.config === 'object' ? nodeData.config : {}) as Record<string, unknown>;
      const network = typeof config.network === 'string' ? config.network : null;
      const actionType = typeof config.actionType === 'string' ? config.actionType : null;
      if (network) networks.push(network);
      if (actionType) actionTypes.push(actionType);
      info.push({
        id: String(node.id ?? ''),
        type: String(node.type ?? ''),
        label: typeof nodeData.label === 'string' ? nodeData.label : null,
        actionType,
        network,
        abiFunction: typeof config.abiFunction === 'string' ? config.abiFunction : null,
        functionArgs: typeof config.functionArgs === 'string' ? config.functionArgs : null,
        contractAddress: typeof config.contractAddress === 'string' ? config.contractAddress : null,
        abi: typeof config.abi === 'string' ? config.abi : null,
        triggerType: typeof config.triggerType === 'string' ? config.triggerType : null,
      });
    }
    return {
      workflowId,
      name: String(wf.name ?? ''),
      enabled: wf.enabled === true,
      networks: [...new Set(networks)],
      actionTypes: [...new Set(actionTypes)],
      nodes: info,
    };
  }

  /**
   * Create an organization workflow from a raw node/edge definition. Used by
   * the generation fallback when AI generation is unavailable.
   */
  async createWorkflow(name: string, description: string, nodes: unknown[], edges: unknown[]): Promise<{ workflowId: string; name: string }> {
    this.requireConfigured();
    await this.ensureInitialized();
    const createdResult = await this.callTool('create_workflow', {
      name,
      description,
      nodes,
      edges,
      enabled: true,
    });
    const created = parseJsonRecord(createdResult.text) ?? {};
    const workflowId = stringField(created, 'id') ?? stringField(created, 'workflowId');
    if (!workflowId) {
      throw new ProviderError({ code: 'creation_failed', message: 'create_workflow did not return an id.', hint: createdResult.text.slice(0, 300) });
    }
    return { workflowId, name };
  }

  /**
   * Call a listed workflow. For paid listings this returns a PaymentQuote
   * (x402 v2) instead of executing — the payment must be made before
   * execution is allowed.
   */
  async callWorkflow(slug: string, input: Record<string, unknown>): Promise<{ quote: PaymentQuote | null; executionId: string | null; status: string; output: string | null; error: string | null; transactionHash: string | null }> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('call_workflow', { slug, inputs: input });

    const text = parsed.text.trim();
    const paymentPrefix = text.match(/^[^{]*x402Version/);
    void paymentPrefix;
    const quote = parsePaymentQuote(text);

    if (parsed.isError) {
      if (quote) {
        return { quote, executionId: null, status: 'payment_required', output: null, error: null, transactionHash: null };
      }
      return {
        quote: null,
        executionId: null,
        status: 'failed',
        output: null,
        error: text.replace(/^Error:\s*/i, '') || 'Workflow call failed.',
        transactionHash: null,
      };
    }

    const data = (parseJsonPayload(text) as Record<string, unknown> | null) ?? null;
    const executionId = data ? stringField(data, 'executionId') ?? stringField(data, 'id') : null;
    return {
      quote: null,
      executionId,
      status: (data?.status as string) ?? (executionId ? 'running' : 'completed'),
      output: typeof data?.output === 'object' || typeof data?.output === 'string' ? JSON.stringify(data.output) : null,
      error: null,
      transactionHash: data ? stringField(data, 'transactionHash') ?? stringField(data, 'txHash') ?? null : null,
    };
  }

  async executeOrgWorkflow(workflowId: string, input: Record<string, unknown>, opts?: { idempotencyKey?: string }): Promise<{ executionId: string | null; status: string; transactionHash: string | null }> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('execute_workflow', {
      workflowId,
      ...(Object.keys(input ?? {}).length > 0 ? { input } : {}),
      ...(opts?.idempotencyKey ? { idempotency_key: opts.idempotencyKey } : {}),
    });
    const data = parseJsonRecord(parsed.text) ?? {};
    return {
      executionId: stringField(data, 'executionId') ?? null,
      status: (data.status as string) ?? 'pending',
      transactionHash: stringField(data, 'transactionHash') ?? stringField(data, 'txHash') ?? null,
    };
  }

  async getExecution(executionId: string, opts?: { includeData?: boolean }): Promise<{ status: string; output: string | null; error: string | null; completed: boolean; failed: boolean; transactionHash: string | null; transactionHashes: string[] }> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('get_execution', { executionId, ...(opts?.includeData === false ? { includeData: false } : {}) });
    const data = parseJsonRecord(parsed.text) ?? {};

    // KeeperHub returns a NESTED shape:
    //   { status: { status, nodeStatuses, progress, errorContext, transactionHashes },
    //     logs: { execution: { ..., executionTrace, workflow: { nodes: [...] } } } }
    // Read status.status — reading the outer "status" object yields
    // "[object Object]" and completion is never detected (the timeout bug).
    const statusObj = (data.status && typeof data.status === 'object' ? data.status : {}) as Record<string, unknown>;
    const logs = (data.logs && typeof data.logs === 'object' ? (data.logs as Record<string, unknown>).execution : null) as Record<string, unknown> | null;
    const status = String(statusObj.status ?? logs?.status ?? 'pending');
    const failed = statusObj.failed === true || logs?.failed === true || status === 'failed' || status === 'error';

    // transactionHashes may be an array of objects [{hash, chainId, ...}] or
    // strings, in either the top-level status object or the execution log.
    const rawHashes = extractHashes(statusObj.transactionHashes);
    const logHashes = extractHashes(logs?.transactionHashes);
    const singleHash = stringField(statusObj, 'transactionHash') ?? stringField(statusObj, 'txHash') ?? stringField(logs ?? {}, 'transactionHash') ?? null;
    const transactionHashes = rawHashes.length > 0 ? rawHashes : (logHashes.length > 0 ? logHashes : (singleHash ? [singleHash] : []));

    // KeeperHub bug: a workflow whose write-action node is disabled returns
    // status: "success" with transactionHashes: [] and only the trigger in the
    // executionTrace. Treat this as a PHANTOM SUCCESS — the node did not run.
    // Condition: status looks completed AND the trace is missing action nodes
    // (write workflow) AND no transaction was emitted.
    const nodeStatuses = (Array.isArray(statusObj.nodeStatuses) ? statusObj.nodeStatuses : null)
      ?? (Array.isArray(logs?.nodeStatuses) ? logs?.nodeStatuses as unknown[] : null)
      ?? (Array.isArray(logs?.executionTrace) ? (logs?.executionTrace as unknown[]).map((id) => ({ nodeId: id })) : null);
    const workflowNodes = Array.isArray((logs?.workflow as Record<string, unknown> | null | undefined)?.nodes) ? (logs?.workflow as Record<string, unknown>).nodes as Record<string, unknown>[] : [];
    const isWriteWorkflow = workflowNodes.some((n) => {
      const type = String(n.type ?? n.actionType ?? n.name ?? '').toLowerCase();
      return type.includes('write') || type.includes('transaction') || type.includes('swap') || type.includes('transfer') || type.includes('contract');
    });
    const ranNodeCount = nodeStatuses?.length ?? 0;
    const totalNodeCount = workflowNodes?.length ?? ranNodeCount;
    const skippedAction = totalNodeCount > 1 && ranNodeCount > 0 && ranNodeCount < totalNodeCount;
    const isPhantomSuccess =
      isWriteWorkflow &&
      skippedAction &&
      (status === 'success' || statusObj.completed === true || logs?.completed === true) &&
      transactionHashes.length === 0 &&
      !failed;

    const completed = isPhantomSuccess
      ? false // Don't treat disabled-node executions as complete
      : (statusObj.completed === true || logs?.completed === true || status === 'completed' || status === 'success');

    return {
      status: isPhantomSuccess ? 'phantom_success' : status,
      output: typeof logs?.output === 'string' || typeof logs?.output === 'object' ? JSON.stringify(logs.output) : null,
      error: isPhantomSuccess
        ? 'Execution reported success but no on-chain transaction was emitted — a write action node may be disabled. Enable the node and retry.'
        : (failed ? String(statusObj.error ?? logs?.error ?? 'Execution failed.') : null),
      completed,
      failed: isPhantomSuccess ? true : failed,
      transactionHash: transactionHashes[0] ?? null,
      transactionHashes,
    };
  }

  async waitForExecution(executionId: string, maxPolls = MAX_POLLS): Promise<{ status: string; completed: boolean; failed: boolean; error: string | null; transactionHash: string | null; transactionHashes: string[] }> {
    let interval = POLL_INTERVAL_MS;
    for (let poll = 0; poll < maxPolls; poll += 1) {
      const state = await this.getExecution(executionId);
      if (state.completed || state.failed) {
        return { status: state.status, completed: state.completed, failed: state.failed, error: state.error, transactionHash: state.transactionHash, transactionHashes: state.transactionHashes };
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      interval = Math.min(interval * 2, 8000);
    }
    return { status: 'timeout', completed: false, failed: true, error: 'Timed out waiting for execution to settle.', transactionHash: null, transactionHashes: [] };
  }

  async generateAndCreateWorkflow(goal: string): Promise<{ workflowId: string; name: string }> {
    this.requireConfigured();
    await this.ensureInitialized();
    try {
      const generated = await this.callTool('ai_generate_workflow', { prompt: goal });
      if (generated.isError) {
        throw new ProviderError({
          code: 'generation_disabled',
          message: generated.text.slice(0, 300),
          hint: 'KeeperHub AI workflow generation is disabled for this organization. Enable "AI Prompt" in KeeperHub, or the broker falls back to deploying a matching template.',
        });
      }
      const genRaw = parseJsonRecord(generated.text) ?? {};
      if (genRaw.code === 'upstream_cold_start') {
        throw new ProviderError({
          code: 'upstream_cold_start',
          message: `KeeperHub AI generation is cold-starting (${String(genRaw.retryAfterSeconds ?? 30)}s warmup).`,
          hint: String(genRaw.hint ?? `Retry after ${String(genRaw.retryAfterSeconds ?? 30)} seconds.`),
          body: genRaw,
        });
      }
      const gen = (genRaw.workflow && typeof genRaw.workflow === 'object' ? genRaw.workflow : genRaw) as Record<string, unknown>;
      const nodes = coerceArray(gen.nodes);
      const edges = coerceArray(gen.edges);
      const name = String(gen.name ?? 'Generated workflow');
      if (nodes.length === 0 || edges.length === 0) {
        throw new ProviderError({
          code: 'generation_incomplete',
          message: 'The generator returned a workflow definition without nodes and edges.',
          hint: 'The fallback generation tool could not produce a valid workflow.',
        });
      }
      const createdResult = await this.callTool('create_workflow', {
        name,
        description: String(gen.description ?? `Generated for: ${goal}`),
        nodes,
        edges,
        enabled: true,
      });
      const created = parseJsonRecord(createdResult.text) ?? {};
      const workflowId = stringField(created, 'id') ?? stringField(created, 'workflowId');
      if (!workflowId) {
        throw new ProviderError({ code: 'creation_failed', message: 'create_workflow did not return an id.', hint: createdResult.text.slice(0, 300) });
      }
      return { workflowId, name };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError({
        code: 'generation_failed',
        message: `Fallback generation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
  }

  /**
   * Deploy a pre-built workflow template as a new workflow in the
   * organization. Used when AI generation is disabled on the account.
   */
  async searchWorkflowTemplates(query: string, limit = 5): Promise<Array<{ id: string; name: string }>> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('search_templates', { query, ...(limit > 0 ? { limit } : {}) });
    if (parsed.isError) {
      throw new ProviderError({ code: 'template_search_failed', message: parsed.text.slice(0, 300) });
    }
    const data = parseJsonPayload(parsed.text);
    const arr = Array.isArray(data)
      ? data
      : Array.isArray((data as { templates?: unknown[] } | null)?.templates)
        ? (data as { templates: unknown[] }).templates
        : [];
    return arr
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({ id: String(item.id ?? ''), name: String(item.name ?? 'Template') }))
      .filter((t) => t.id.length > 0);
  }

  async deployWorkflowTemplate(templateId: string): Promise<{ workflowId: string; name: string }> {
    this.requireConfigured();
    await this.ensureInitialized();
    const parsed = await this.callTool('deploy_template', { templateId });
    if (parsed.isError) {
      throw new ProviderError({ code: 'template_deploy_failed', message: parsed.text.slice(0, 300) });
    }
    const created = parseJsonRecord(parsed.text) ?? {};
    const workflowId = stringField(created, 'id') ?? stringField(created, 'workflowId');
    if (!workflowId) {
      throw new ProviderError({ code: 'template_deploy_failed', message: 'deploy_template did not return a workflow id.', hint: parsed.text.slice(0, 300) });
    }
    return { workflowId, name: String(created.name ?? 'Deployed template') };
  }
}

function coerceArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function extractEmbeddedJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractPayloadError(text: string): unknown | null {
  const parsed = extractEmbeddedJson(text);
  if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'accepts')) return parsed;
  return null;
}

function parseJsonPayload(raw: string): unknown | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    if (start === -1) return null;
    try {
      return JSON.parse(trimmed.slice(start));
    } catch {
      return null;
    }
  }
}

function parseJsonRecord(raw: string): Record<string, unknown> | null {
  const value = parseJsonPayload(raw);
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function stringField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function extractHashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((h) => (typeof h === 'string' ? h : ((h as Record<string, unknown>)?.hash as string | undefined)))
    .filter((h): h is string => typeof h === 'string' && h.length > 0);
}

function parsePaymentQuote(text: string): PaymentQuote | null {
  if (!text.includes('x402Version')) return null;
  const obj = extractEmbeddedJson(text);
  if (!obj) return null;
  const acceptsRaw = obj.accepts;
  if (!Array.isArray(acceptsRaw) || acceptsRaw.length === 0) return null;
  const accepts = acceptsRaw[0] as ExAccepts;
  const resource = (obj.resource ?? {}) as Record<string, unknown>;
  return {
    x402Version: Number(obj.x402Version ?? 2),
    asset: accepts.asset ?? '',
    network: accepts.network ?? '',
    amountUnits: accepts.amount ?? '0',
    amountUsdc: Number(accepts.amount ?? 0) / 10 ** assetDecimals(accepts.asset ?? ''),
    payTo: accepts.payTo ?? '',
    maxTimeoutSeconds: Number(accepts.maxTimeoutSeconds ?? 0),
    resourceUrl: String(resource.url ?? ''),
    description: String(resource.description ?? obj.error ?? ''),
  };
}