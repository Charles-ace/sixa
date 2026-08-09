import { BrokerMcpClient } from './client';
import { discover } from './discover';
import { select } from './select';
import { intake } from './intake';
import { payX402, payerMode } from './pay';
import { verifyExecution } from './verify';
import { generateAndRun } from './generate';
import { after } from 'next/server';
import { generateId } from '@/lib/utils';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import { flushSharedNow, loadJobs, loadSharedJobs, saveJobs, usesSharedStore } from './store';
import type { AuditEvent, AuditEventType, BrokerJob, ExecutionResult, JobSpec, ListingCandidate, PaymentMode } from './types';

const jobs = new Map<string, BrokerJob>();
for (const job of loadJobs()) {
  jobs.set(job.id, job);
}
const MAX_JOBS = 50;

export const brokerMcpClient = new BrokerMcpClient();

export async function createJob(input: {
  message: string;
  accountEmail?: string | null;
  budgetUsdc?: number;
  forcedSlug?: string | null;
  payMode?: PaymentMode;
}): Promise<BrokerJob> {
  const jobId = generateId();
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
    payMode: input.payMode,
  });
  storeJob(job);
  // Make the job visible to every instance immediately — a debounced write
  // can be dropped if the creating lambda freezes right after the response.
  flushSharedNow([job]);
  // Keep the pipeline alive past the response on serverless so every state
  // change is flushed before the next poll reads it.
  after(() => void runJob(jobId, input));
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
    const oldest = [...jobs.keys()].sort((a, b) => {
      const ja = jobs.get(a);
      const jb = jobs.get(b);
      return (ja?.createdAt ?? '').localeCompare(jb?.createdAt ?? '');
    }).slice(0, jobs.size - MAX_JOBS);
    for (const key of oldest) jobs.delete(key);
  }
  saveJobs([...jobs.values()]);
}

export async function getJob(jobId: string): Promise<BrokerJob | null> {
  const inMemory = jobs.get(jobId);
  if (inMemory) return inMemory;
  if (usesSharedStore()) {
    const shared = await loadSharedJobs();
    const fromShared = shared.find((j) => j.id === jobId);
    if (fromShared) {
      jobs.set(jobId, fromShared);
      return fromShared;
    }
  }
  const fromDisk = loadJobs().find((j) => j.id === jobId);
  if (fromDisk) {
    jobs.set(jobId, fromDisk);
    return fromDisk;
  }
  return null;
}

export async function listJobs(): Promise<BrokerJob[]> {
  if (usesSharedStore()) {
    for (const job of await loadSharedJobs()) {
      if (!jobs.has(job.id)) jobs.set(job.id, job);
    }
  }
  for (const job of loadJobs()) {
    if (!jobs.has(job.id)) jobs.set(job.id, job);
  }
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAudit(jobId: string): Promise<AuditEvent[]> {
  return (await getJob(jobId))?.audit ?? [];
}

export async function runJob(jobId: string, input: {
  message: string;
  accountEmail?: string | null;
  budgetUsdc?: number;
  forcedSlug?: string | null;
  payMode?: PaymentMode;
}): Promise<BrokerJob> {
  // Reuse the job registered by createJob when present; otherwise register
  // one now so callers can poll it while intake runs.
  let job = jobs.get(jobId) ?? null;
  if (!job) {
    const pendingSpec: JobSpec = {
      goal: input.message,
      query: '',
      params: {},
      budgetUsdc: 0.5,
      chainId: null,
      maxPriceUsdc: 0.25,
    };
    job = newJob(jobId, pendingSpec, {
      ...input,
      payMode: input.payMode, // captured again below after intake
    });
    storeJob(job);
  }

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
      storeJob(job);
      return;
    }
  }

  job.candidates = candidates;
  pushAudit(job, 'candidate_found', `Found ${candidates.length} candidates.`, { slugs: candidates.slice(0, 8).map((c) => c.slug) });

  if (candidates.length === 0) {
    pushAudit(job, 'fallback_generation', 'No marketplace listing matched the intent — generating a workflow instead.', { query: job.spec.query });
    await attemptGenerationFallback(job, client);
    return;
  }

  setStatus(job, 'selecting');
  const selection = select(job.spec, candidates);
  job.selected = selection.selected;
  pushAudit(job, 'selection_made', 'Selection decided.', {
    slug: selection.selected.slug,
    priceUsdcPerCall: selection.selected.priceUsdcPerCall,
    reason: selection.reason,
    runnerUp: selection.runnerUp?.slug ?? null,
  });
  storeJob(job);

  // Try the selected listing first, then each remaining candidate in order.
  const ordered = [
    selection.selected,
    ...candidates.filter((c) => c.slug !== selection.selected.slug),
  ];

  for (const candidate of ordered) {
    try {
      await runCandidate(job, client, candidate);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      pushAudit(job, 'candidate_failed', `Listing "${candidate.slug}" failed at call time.`, { slug: candidate.slug, error: message });
      setStatus(job, 'selecting');
      storeJob(job);
    }
  }

  // Every live listing failed — generate a workflow as a last resort.
  await attemptGenerationFallback(job, client);
}

/**
 * Quote → pay → execute → verify for a single candidate. Throws on any
 * failure so the pipeline can move on to the next candidate.
 */
async function runCandidate(job: BrokerJob, client: BrokerMcpClient, candidate: ListingCandidate): Promise<void> {
  setStatus(job, 'quoting');
  const params = normalizeParams(job.spec.params, candidate.inputSchema);
  const call = await client.callWorkflow(candidate.slug, params);

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
        message: `The live quote for "${candidate.slug}" is $${call.quote.amountUsdc.toFixed(2)}, above the $${(job.spec.maxPriceUsdc ?? 0).toFixed(2)} cap.`,
      });
    }

    setStatus(job, 'paying');
    const payment = await payX402(call.quote, job.payMode);
    job.payment = payment;
    if (payment.mode === 'real') {
      if (!payment.receipt) {
        throw new ProviderError({
          code: 'payment_unverified',
          message: `Real payment exited with ${payment.txHash ?? 'no hash'} but no on-chain receipt was captured. Treat as unverified.`,
        });
      }
      const r = payment.receipt;
      const mismatch = r.status !== 'success' || !r.matches.amount || !r.matches.recipient;
      pushAudit(job, mismatch ? 'payment_unverified' : 'payment_verified', mismatch ? 'ON-CHAIN PAYMENT MISMATCH — receipt decodes but amount/recipient differ from the quote.' : 'On-chain receipt confirmed for the payment.', {
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        confirmations: r.confirmations,
        amountMatch: r.matches.amount,
        recipientMatch: r.matches.recipient,
        recipient: r.recipient,
        amountUsdc: r.amountUsdc,
      });
      if (mismatch) {
        throw new ProviderError({ code: 'payment_mismatch', message: `On-chain receipt for ${r.txHash} does not match the quote (status=${r.status}, amount=${r.matches.amount}, recipient=${r.matches.recipient}).` });
      }
    }
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
    storeJob(job);

    // Execute now that payment is confirmed
    setStatus(job, 'executing');
    const execution = await client.callWorkflow(candidate.slug, params);

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
        slug: candidate.slug,
        payMode: job.payMode,
      });
      pushAudit(job, 'verification_passed', 'Independent verification PASSED (simulated execution has no on-chain counterpart).', {
        payMode: job.payMode,
      });
      setStatus(job, 'completed');
      pushAudit(job, 'job_completed', 'Job completed (simulated payment path).', { slug: candidate.slug });
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
        message: `The workflow "${candidate.slug}" ran but returned no execution id to verify against.`,
        hint: 'Verification requires a KeeperHub execution id; treat this as unverified.',
      });
    }
    pushAudit(job, 'execution_requested', 'Execution started after payment.', { executionId: execution.executionId });
    job.execution = { executionId: execution.executionId, status: execution.status, output: execution.output, completed: false, failed: false, error: null, verified: false, receipts: [] };
    storeJob(job);

    setStatus(job, 'verifying');
    const verified = await verifyExecution(client, execution.executionId);
    if (verified.completed && job.payment?.txHash) {
      verified.receipts = [job.payment.txHash];
    }
    job.execution = verified;
    if (!verified.completed) {
      pushAudit(job, 'verification_failed', 'Independent verification failed.', {
        executionId: execution.executionId,
        error: verified.error,
      });
      throw new ProviderError({ code: 'verification_failed', message: verified.error ?? 'Execution did not verify.' });
    }
    pushAudit(job, 'verification_passed', 'Independent verification passed via KeeperHub execution status.', {
      executionId: execution.executionId,
      status: verified.status,
    });
    pushAudit(job, 'execution_completed', 'Workflow completed.', { executionId: execution.executionId, status: verified.status });
  } else if (call.executionId) {
    // Free (unpriced) listing — ran directly.
    job.execution = { executionId: call.executionId, status: call.status, output: call.output, completed: false, failed: false, error: null, verified: false, receipts: [] };
    pushAudit(job, 'execution_requested', 'Execution started (free listing).', { executionId: call.executionId });
    storeJob(job);
    setStatus(job, 'verifying');
    const verified = await verifyExecution(client, call.executionId);
    job.execution = verified;
    if (!verified.completed) {
      pushAudit(job, 'verification_failed', 'Independent verification failed.', { executionId: call.executionId, error: verified.error });
      throw new ProviderError({ code: 'verification_failed', message: verified.error ?? 'Execution did not verify.' });
    }
    pushAudit(job, 'verification_passed', 'Independent verification passed via KeeperHub execution status.', {
      executionId: call.executionId,
      status: verified.status,
    });
    pushAudit(job, 'execution_completed', 'Workflow completed.', { executionId: call.executionId, status: verified.status });
  } else {
    throw new ProviderError({ code: 'call_failed', message: call.error ?? `The workflow call for "${candidate.slug}" returned neither a quote nor an execution id.` });
  }

  setStatus(job, 'completed');
  pushAudit(job, 'job_completed', 'Job completed.', { slug: candidate.slug });
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
    ...(job.payment?.receipt
      ? [
          `Receipt: block ${job.payment.receipt.blockNumber} · status ${job.payment.receipt.status} · confirmations ${job.payment.receipt.confirmations}`,
          `On-chain check: amount match ${job.payment.receipt.matches.amount ? 'YES' : 'NO'} · recipient match ${job.payment.receipt.matches.recipient ? 'YES' : 'NO'}`,
          `Explorer: https://basescan.org/tx/${job.payment.txHash}`,
        ]
      : []),
    ...(job.execution?.executionId ? [`Execution id: ${job.execution.executionId}`] : []),
    `Status: ${job.execution?.status ?? 'pending'}`,
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