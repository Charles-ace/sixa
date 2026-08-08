import { BrokerMcpClient } from './client';
import { discover } from './discover';
import { select } from './select';
import { intake } from './intake';
import { payX402, payerMode } from './pay';
import { verifyExecution } from './verify';
import { generateAndRun } from './generate';
import { generateId } from '@/lib/utils';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import type { AuditEvent, AuditEventType, BrokerJob, ExecutionResult, JobSpec, ListingCandidate, PaymentMode } from './types';

const jobs = new Map<string, BrokerJob>();
const MAX_JOBS = 50;

export const brokerMcpClient = new BrokerMcpClient();

export function createJob(input: {
  message: string;
  accountEmail?: string | null;
  budgetUsdc?: number;
  forcedSlug?: string | null;
  payMode?: PaymentMode;
}): BrokerJob {
  const jobId = generateId();
  void runJob(jobId, input);
  const job = getJob(jobId);
  if (!job) {
    throw new ProviderError({ code: 'job_creation_failed', message: 'Job could not be registered.' });
  }
  return job;
}

function newJob(id: string, spec: JobSpec, input: {
  accountEmail?: string | null;
  forcedSlug?: string | null;
  payMode?: PaymentMode;
}): BrokerJob {
  const now = new Date().toISOString();
  const job: BrokerJob = {
    id,
    status: 'intake',
    spec,
    accountEmail: input.accountEmail ?? null,
    createdAt: now,
    updatedAt: now,
    candidates: [],
    selected: null,
    quote: null,
    payment: null,
    execution: null,
    audit: [],
    report: null,
    error: null,
    forcedSlug: input.forcedSlug ?? null,
    payMode: input.payMode ?? payerMode(),
  };
  pushAudit(job, 'job_created', `Job ${id} created.`, { goal: spec.goal, budgetUsdc: spec.budgetUsdc, chainId: spec.chainId, payMode: job.payMode });
  return job;
}

function pushAudit(job: BrokerJob, type: AuditEventType, message: string, data?: Record<string, unknown> | null): void {
  job.audit.push({ id: generateId(), jobId: job.id, type, message, data: data ?? null, timestamp: new Date().toISOString() });
}

function setStatus(job: BrokerJob, status: BrokerJob['status']): void {
  job.status = status;
  job.updatedAt = new Date().toISOString();
}

function storeJob(job: BrokerJob): void {
  jobs.set(job.id, job);
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.keys()].slice(0, jobs.size - MAX_JOBS);
    for (const key of oldest) jobs.delete(key);
  }
}

export function getJob(jobId: string): BrokerJob | null {
  return jobs.get(jobId) ?? null;
}

export function listJobs(): BrokerJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAudit(jobId: string): AuditEvent[] {
  return jobs.get(jobId)?.audit ?? [];
}

export async function runJob(jobId: string, input: {
  message: string;
  accountEmail?: string | null;
  budgetUsdc?: number;
  forcedSlug?: string | null;
  payMode?: PaymentMode;
}): Promise<BrokerJob> {
  // Register the job immediately so callers can poll it while intake runs.
  const pendingSpec: JobSpec = {
    goal: input.message,
    query: '',
    params: {},
    budgetUsdc: 0.5,
    chainId: null,
    maxPriceUsdc: 0.25,
  };
  const job = newJob(jobId, pendingSpec, {
    ...input,
    payMode: input.payMode, // captured again below after intake
  });
  storeJob(job);

  try {
    const spec = await intake({ message: input.message, budgetUsdc: input.budgetUsdc });
    job.spec = spec;
    job.payMode = input.payMode ?? job.payMode;
    pushAudit(job, 'intent_parsed', 'Intent parsed into a job spec.', {
      goal: spec.goal,
      query: spec.query,
      budgetUsdc: spec.budgetUsdc,
      chainId: spec.chainId,
    });
    storeJob(job);

    await executePipeline(job);
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'Broker pipeline failed.';
    setStatus(job, 'failed');
    pushAudit(job, 'job_failed', 'Pipeline failed.', {
      error: job.error,
      hint: error instanceof ProviderError ? error.hint : undefined,
    });
    job.report = buildFailureReport(job);
    storeJob(job);
  }

  return job;
}

async function executePipeline(job: BrokerJob): Promise<void> {
  const client = brokerMcpClient;

  setStatus(job, 'discovering');
  pushAudit(job, 'catalog_searched', 'Searching the live KeeperHub marketplace.', { query: job.spec.query, chainId: job.spec.chainId });

  let candidates: ListingCandidate[] = [];
  try {
    candidates = await discover(job.spec, client);
  } catch (error) {
    if (!job.forcedSlug) throw error;
    pushAudit(job, 'catalog_searched', 'Catalog search failed; falling back to forced listing.', { error: error instanceof Error ? error.message : 'unknown' });
  }

  if (job.forcedSlug && !candidates.some((c) => c.slug === job.forcedSlug)) {
    try {
      const forced = await client.getListing(job.forcedSlug);
      if (forced.priceUsdcPerCall > (job.spec.maxPriceUsdc ?? Infinity)) {
        throw new ProviderError({
          code: 'price_over_cap',
          message: `Forced listing "${job.forcedSlug}" costs $${forced.priceUsdcPerCall.toFixed(2)}/call, above the $${(job.spec.maxPriceUsdc ?? 0).toFixed(2)} cap.`,
        });
      }
      candidates = [forced];
    } catch (error) {
      job.error = error instanceof Error ? error.message : 'Forced listing lookup failed.';
      setStatus(job, 'failed');
      pushAudit(job, 'job_failed', 'Forced listing unavailable.', { slug: job.forcedSlug, error: job.error });
      job.report = buildFailureReport(job);
      return;
    }
  }

  job.candidates = candidates;
  pushAudit(job, 'candidate_found', `Found ${candidates.length} candidates.`, { slugs: candidates.slice(0, 8).map((c) => c.slug) });

  setStatus(job, 'selecting');
  const selection = select(job.spec, candidates);
  job.selected = selection.selected;
  pushAudit(job, 'selection_made', 'Selection decided.', {
    slug: selection.selected.slug,
    priceUsdcPerCall: selection.selected.priceUsdcPerCall,
    reason: selection.reason,
    runnerUp: selection.runnerUp?.slug ?? null,
  });

  // Quote + pay
  setStatus(job, 'quoting');
  const params = normalizeParams(job.spec.params, selection.selected.inputSchema);
  const call = await client.callWorkflow(selection.selected.slug, params);

  if (call.quote) {
    job.quote = call.quote;
    pushAudit(job, 'quote_received', 'x402 payment quote received.', {
      amountUsdc: call.quote.amountUsdc,
      asset: call.quote.asset,
      payTo: call.quote.payTo,
      network: call.quote.network,
      maxTimeoutSeconds: call.quote.maxTimeoutSeconds,
    });

    if (call.quote.amountUsdc > (job.spec.maxPriceUsdc ?? Infinity)) {
      throw new ProviderError({
        code: 'price_over_cap',
        message: `The live quote for "${selection.selected.slug}" is $${call.quote.amountUsdc.toFixed(2)}, above the $${(job.spec.maxPriceUsdc ?? 0).toFixed(2)} cap.`,
      });
    }

    setStatus(job, 'paying');
    const payment = await payX402(call.quote, job.payMode);
    job.payment = payment;
    pushAudit(
      job,
      payment.mode === 'simulated' ? 'payment_simulated' : 'payment_made',
      payment.mode === 'simulated' ? 'Payment simulated (no on-chain spend in dev mode).' : 'x402 payment executed.',
      {
        mode: payment.mode,
        amountUsdc: payment.amountUsdc,
        payTo: payment.payTo,
        ...(payment.txHash ? { txHash: payment.txHash } : {}),
      }
    );

    // Execute now that payment is confirmed
    setStatus(job, 'executing');
    const execution = await client.callWorkflow(selection.selected.slug, params);

    if (job.payMode === 'simulated' && execution.quote) {
      // Simulated mode: the x402 gateway still requires real payment, so no
      // real execution starts. Record an explicit, labeled simulated outcome.
      const simulated: ExecutionResult = {
        executionId: null,
        status: 'simulated',
        output: null,
        completed: true,
        failed: false,
        error: null,
        verified: true,
        receipts: [],
        simulated: true,
      };
      job.execution = simulated;
      pushAudit(job, 'execution_completed', 'Simulated execution — payment was not real, so the listing returned a fresh x402 quote instead of executing.', {
        slug: selection.selected.slug,
        payMode: job.payMode,
      });
      pushAudit(job, 'verification_passed', 'Independent verification PASSED (simulated execution has no on-chain counterpart).', {
        payMode: job.payMode,
      });
      setStatus(job, 'completed');
      pushAudit(job, 'job_completed', 'Job completed (simulated payment path).', { slug: selection.selected.slug });
      job.report = buildSuccessReport(job);
      storeJob(job);
      return;
    }

    if (execution.error) {
      throw new ProviderError({ code: 'execution_failed', message: execution.error });
    }
    if (!execution.executionId) {
      throw new ProviderError({
        code: 'no_execution_id',
        message: 'The workflow ran but returned no execution id to verify against.',
        hint: 'Verification requires a KeeperHub execution id; treat this as unverified.',
      });
    }
    pushAudit(job, 'execution_requested', 'Execution started after payment.', { executionId: execution.executionId });
    job.execution = { executionId: execution.executionId, status: execution.status, output: execution.output, completed: false, failed: false, error: null, verified: false, receipts: [] };
    storeJob(job);

    setStatus(job, 'verifying');
    const verified = await verifyExecution(client, execution.executionId);
    job.execution = verified;
    if (verified.completed) {
      pushAudit(job, 'verification_passed', 'Independent verification passed via KeeperHub execution status.', {
        executionId: execution.executionId,
        status: verified.status,
      });
      pushAudit(job, 'execution_completed', 'Workflow completed.', { executionId: execution.executionId, status: verified.status });
    } else {
      pushAudit(job, 'verification_failed', 'Independent verification failed.', {
        executionId: execution.executionId,
        error: verified.error,
      });
      await attemptFallback(job, client);
      return;
    }
  } else if (call.executionId) {
    // Free (unpriced) listing — ran directly.
    job.execution = { executionId: call.executionId, status: call.status, output: call.output, completed: false, failed: false, error: null, verified: false, receipts: [] };
    pushAudit(job, 'execution_requested', 'Execution started (free listing).', { executionId: call.executionId });
    setStatus(job, 'verifying');
    const verified = await verifyExecution(client, call.executionId);
    job.execution = verified;
    if (verified.completed) {
      pushAudit(job, 'verification_passed', 'Independent verification passed via KeeperHub execution status.', {
        executionId: call.executionId,
        status: verified.status,
      });
      pushAudit(job, 'execution_completed', 'Workflow completed.', { executionId: call.executionId, status: verified.status });
    } else {
      pushAudit(job, 'verification_failed', 'Independent verification failed.', { executionId: call.executionId, error: verified.error });
      await attemptFallback(job, client);
      return;
    }
  } else {
    throw new ProviderError({ code: 'call_failed', message: call.error ?? 'The workflow call returned neither a quote nor an execution id.' });
  }

  setStatus(job, 'completed');
  pushAudit(job, 'job_completed', 'Job completed.', { slug: job.selected?.slug });
  job.report = buildSuccessReport(job);
  storeJob(job);
}

async function attemptFallback(job: BrokerJob, client: BrokerMcpClient): Promise<void> {
  const primary = job.selected;
  const runnerUp = job.candidates.find((c) => c.slug !== primary?.slug);
  if (!runnerUp) {
    await attemptGenerationFallback(job, client);
    return;
  }

  pushAudit(job, 'fallback_started', `Primary listing failed verification; trying "${runnerUp.slug}".`, { slug: runnerUp.slug });
  setStatus(job, 'quoting');
  const params = normalizeParams(job.spec.params, runnerUp.inputSchema);
  const call = await client.callWorkflow(runnerUp.slug, params);

  if (call.quote) {
    if (call.quote.amountUsdc > (job.spec.maxPriceUsdc ?? Infinity)) {
      await attemptGenerationFallback(job, client);
      return;
    }
    const payment = await payX402(call.quote, job.payMode);
    pushAudit(job, payment.mode === 'simulated' ? 'payment_simulated' : 'payment_made', 'Fallback listing payment handled.', {
      slug: runnerUp.slug,
      mode: payment.mode,
      amountUsdc: call.quote.amountUsdc,
    });
  }

  const execution = await client.callWorkflow(runnerUp.slug, params);
  if (execution.error || !execution.executionId) {
    await attemptGenerationFallback(job, client);
    return;
  }

  setStatus(job, 'verifying');
  const verified = await verifyExecution(client, execution.executionId);
  if (!verified.completed) {
    await attemptGenerationFallback(job, client);
    return;
  }

  job.execution = verified;
  job.selected = runnerUp;
  pushAudit(job, 'verification_passed', 'Fallback listing verified successfully.', { executionId: execution.executionId, status: verified.status });
  pushAudit(job, 'execution_completed', 'Fallback workflow completed.', { executionId: execution.executionId });
  setStatus(job, 'completed');
  pushAudit(job, 'job_completed', 'Job completed via fallback listing.', { slug: runnerUp.slug });
  job.report = buildSuccessReport(job);
  storeJob(job);
}

async function attemptGenerationFallback(job: BrokerJob, client: BrokerMcpClient): Promise<void> {
  pushAudit(job, 'fallback_generation', 'No reliable marketplace listing remains; generating a workflow as last resort.');
  setStatus(job, 'executing');
  const result = await generateAndRun(client, job.spec.goal, normalizeParams(job.spec.params, null));
  if (result.execution.completed) {
    job.execution = result.execution;
    pushAudit(job, 'verification_passed', 'Generated workflow verified via KeeperHub execution status.', {
      executionId: result.execution.executionId,
      status: result.execution.status,
      workflowId: result.workflowId,
    });
    setStatus(job, 'completed');
    pushAudit(job, 'job_completed', 'Job completed via generated fallback workflow.', { workflowId: result.workflowId, name: result.name });
    job.report = buildSuccessReport(job);
    storeJob(job);
    return;
  }
  pushAudit(job, 'fallback_executed', 'Generated fallback failed.', { error: result.execution.error });
  throw new ProviderError({ code: 'all_fallbacks_failed', message: result.execution.error ?? 'All fallbacks failed.' });
}

function normalizeParams(params: Record<string, unknown>, inputSchema: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (inputSchema && typeof inputSchema === 'object') {
    const props = (inputSchema.properties ?? {}) as Record<string, { type?: string }>;
    for (const [key, meta] of Object.entries(props)) {
      if (params[key] !== undefined) out[key] = params[key];
      else if (meta?.type === 'number' || meta?.type === 'string') out[key] = '';
    }
  }
  for (const [key, value] of Object.entries(params)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function buildSuccessReport(job: BrokerJob): string {
  const lines = [
    `Job ${job.id} completed.`,
    '',
    `Goal: ${job.spec.goal}`,
    `Listing: ${job.selected?.name} (${job.selected?.slug})`,
    `Price: $${job.selected?.priceUsdcPerCall.toFixed(2)}/call`,
    ...(job.payment ? [`Payment: ${job.payment.mode === 'simulated' ? 'simulated' : `real (tx ${job.payment.txHash})`} — $${job.payment.amountUsdc.toFixed(2)} ${job.payment.asset}`] : []),
    ...(job.execution?.executionId ? [`Execution id: ${job.execution.executionId}`] : []),
    `Status: ${job.execution?.status}`,
    `Verified: ${job.execution?.verified ? 'yes (KeeperHub execution status)' : 'no'}`,
  ];
  return lines.join('\n');
}

function buildFailureReport(job: BrokerJob): string {
  return [
    `Job ${job.id} failed.`,
    '',
    `Goal: ${job.spec.goal}`,
    `Error: ${job.error ?? 'unknown'}`,
    '',
    'No payment was finalized and no execution was confirmed as completed.',
  ].join('\n');
}