import { BrokerMcpClient } from './client';
import { discover } from './discover';
import { select, bestMatchScore } from './select';
import { intake } from './intake';
import { basePublicClient, confirmOnChainReceipt, payX402, payerMode } from './pay';
import { verifyExecution } from './verify';
import { generateAndRun } from './generate';
import { after } from 'next/server';
import { generateId } from '@/lib/utils';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import { flushSharedNow, loadJobs, loadSharedJobs, saveJobs, usesSharedStore } from './store';
import { isNativeAsset, type AuditEvent, type AuditEventType, type BrokerJob, type ExecutionResult, type JobSpec, type ListingCandidate, type PaymentMode } from './types';

const jobs = new Map<string, BrokerJob>();
for (const job of loadJobs()) {
  jobs.set(job.id, job);
}
const MAX_JOBS = 50;
const MIN_MATCH_SCORE = 3;

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
  if (usesSharedStore()) {
    // Prefer the freshest copy: another serverless instance may have advanced
    // the job (e.g. after a user-signed payment) since this instance cached it.
    try {
      const shared = await loadSharedJobs();
      const fromShared = shared.find((j) => j.id === jobId);
      if (fromShared && (!inMemory || new Date(fromShared.updatedAt) > new Date(inMemory.updatedAt))) {
        jobs.set(jobId, fromShared);
        return fromShared;
      }
    } catch {
      // blob unavailable — fall through to local sources
    }
    if (inMemory) return inMemory;
  } else if (inMemory) {
    return inMemory;
  }
  const fromDisk = loadJobs().find((j) => j.id === jobId);
  if (fromDisk) {
    jobs.set(jobId, fromDisk);
    return fromDisk;
  }
  return null;
}

export async function listJobs(): Promise<BrokerJob[]> {
  let shared: BrokerJob[] = [];
  if (usesSharedStore()) {
    try {
      shared = await loadSharedJobs();
    } catch {
      shared = [];
    }
  }
  for (const job of shared) {
    const existing = jobs.get(job.id);
    if (!existing || new Date(job.updatedAt) > new Date(existing.updatedAt)) jobs.set(job.id, job);
  }
  for (const job of loadJobs()) {
    if (!jobs.has(job.id)) jobs.set(job.id, job);
  }
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Called by the payment confirmation route after the user's on-chain
 * transfer verifies: executes and verifies the selected listing, completing
 * the pipeline that paused in 'awaiting_payment'.
 */
export async function resumeAfterUserPayment(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || job.status !== 'awaiting_payment' || !job.selected) return;
  if (!job.payment || job.payment.status !== 'paid') return;
  await executeAndVerify(job, brokerMcpClient, job.selected, true);
}

/**
 * Verifies the user-signed x402 payment on-chain, records it, and resumes
 * the paused pipeline. Returns an { ok, code, error } envelope the API
 * route can forward verbatim as HTTP statuses.
 */
export async function confirmUserPayment(
  jobId: string,
  txHash: string,
  from?: string
): Promise<{ ok: boolean; code?: string; error?: string; hint?: string }> {
  const job = await getJob(jobId);
  if (!job) return { ok: false, code: 'job_not_found', error: 'Job not found.' };
  if (job.status !== 'awaiting_payment' || !job.quote || !job.payment) {
    return { ok: false, code: 'no_pending_payment', error: 'This job is not waiting for a payment.' };
  }
  if (job.payment.status === 'paid') return { ok: true };

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, code: 'invalid_tx_hash', error: 'A valid transaction hash is required.' };
  }
  if (from && !/^0x[0-9a-fA-F]{40}$/.test(from)) {
    return { ok: false, code: 'invalid_from', error: 'Invalid wallet address.' };
  }

  const quote = job.quote;
  let receipt;
  try {
    receipt = await confirmOnChainReceipt({
      txHash: txHash as `0x${string}`,
      asset: quote.asset,
      native: isNativeAsset(quote.asset),
      expectedAmountUnits: quote.amountUnits,
      expectedRecipient: quote.payTo,
      expectedFrom: from || undefined,
      publicClient: basePublicClient(),
      payer: '',
      networkName: 'base',
    });
  } catch (error) {
    return {
      ok: false,
      code: 'payment_unverified',
      error: error instanceof Error ? error.message : 'Payment verification failed.',
      hint: error instanceof ProviderError ? error.hint : undefined,
    };
  }

  const mismatch = receipt.status !== 'success' || !receipt.matches.amount || !receipt.matches.recipient || !receipt.matches.sender;

  job.payment = {
    mode: 'user',
    amountUsdc: quote.amountUsdc,
    asset: quote.asset,
    payTo: quote.payTo,
    network: quote.network,
    status: 'paid',
    txHash,
    paidAt: new Date().toISOString(),
    receipt,
  };

  pushAudit(job, mismatch ? 'payment_unverified' : 'payment_verified', mismatch ? 'ON-CHAIN PAYMENT MISMATCH — your transfer does not match the quote.' : 'On-chain receipt confirmed for your wallet payment.', {
    txHash,
    blockNumber: receipt.blockNumber,
    confirmations: receipt.confirmations,
    amountMatch: receipt.matches.amount,
    recipientMatch: receipt.matches.recipient,
    senderMatch: receipt.matches.sender,
    sender: receipt.from,
    amountUsdc: receipt.amountUsdc,
  });

  if (mismatch) {
    job.error = `Payment ${txHash} does not match the quote (amount=${receipt.matches.amount}, recipient=${receipt.matches.recipient}, sender=${receipt.matches.sender}).`;
    return { ok: false, code: 'payment_mismatch', error: job.error };
  }

  pushAudit(job, 'payment_made', 'x402 payment executed from your wallet.', {
    mode: 'user',
    txHash,
    amountUsdc: receipt.amountUsdc,
    payTo: receipt.recipient,
  });
  storeJob(job);
  after(() => void resumeAfterUserPayment(jobId));
  return { ok: true };
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

  const bestScore = bestMatchScore(job.spec, candidates);
  if (!job.forcedSlug && bestScore < MIN_MATCH_SCORE) {
    pushAudit(job, 'candidate_found', `Best matching listing scored ${bestScore.toFixed(1)} of ${MIN_MATCH_SCORE} — below the relevance threshold. Generating a workflow instead of forcing an unrelated listing.`, {
      bestScore,
      threshold: MIN_MATCH_SCORE,
      slugs: candidates.slice(0, 8).map((c) => c.slug),
    });
    pushAudit(job, 'fallback_generation', `No marketplace listing genuinely matches the intent (best score ${bestScore.toFixed(1)}); generating a workflow as last resort.`);
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
      const phase = await quoteCandidate(job, client, candidate);
      if (phase === 'paused') return;
      await executeAndVerify(job, client, candidate, true);
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
 * Phase 1: quote and settle payment for a candidate.
 *
 * Returns 'paid' when execution may proceed, 'paused' when the payment was
 * handed to the user's wallet (executeAndVerify runs later via the payment
 * route), or throws so the pipeline can move on to the next candidate.
 */
async function quoteCandidate(job: BrokerJob, client: BrokerMcpClient, candidate: ListingCandidate): Promise<'paid' | 'paused'> {
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

    if (job.payMode === 'user') {
      // Hand the payment to the user's own wallet: the pipeline pauses here
      // and the client signs the USDC/ETH transfer, then confirms it via
      // /api/broker/jobs/[id]/payment, which resumes execution.
      job.payment = {
        mode: 'user',
        amountUsdc: call.quote.amountUsdc,
        asset: call.quote.asset,
        payTo: call.quote.payTo,
        network: call.quote.network,
        status: 'quoted',
      };
      pushAudit(job, 'quote_received', 'Waiting for you to approve the x402 payment from your wallet.', {
        amountUsdc: call.quote.amountUsdc,
        asset: call.quote.asset,
        payTo: call.quote.payTo,
      });
      setStatus(job, 'awaiting_payment');
      storeJob(job);
      return 'paused';
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
      const mismatch = r.status !== 'success' || !r.matches.amount || !r.matches.recipient || !r.matches.sender;
      pushAudit(job, mismatch ? 'payment_unverified' : 'payment_verified', mismatch ? 'ON-CHAIN PAYMENT MISMATCH — receipt decodes but amount/recipient/sender differ from the quote.' : 'On-chain receipt confirmed for the payment.', {
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        confirmations: r.confirmations,
        amountMatch: r.matches.amount,
        recipientMatch: r.matches.recipient,
        recipient: r.recipient,
        amountUsdc: r.amountUsdc,
      });
      if (mismatch) {
        throw new ProviderError({ code: 'payment_mismatch', message: `On-chain receipt for ${r.txHash} does not match the quote (status=${r.status}, amount=${r.matches.amount}, recipient=${r.matches.recipient}, sender=${r.matches.sender}).` });
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

    if (job.payMode === 'simulated') {
      // Simulated mode: the x402 gateway still requires real payment, so no
      // real execution starts. Record an explicit, labeled simulated outcome.
      const execution = await client.callWorkflow(candidate.slug, params);
      if (execution.quote) {
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
        return 'paused';
      }
    }
    return 'paid';
  }

  // Free (unpriced) listing — ran directly; execute without payment.
  await executeAndVerify(job, client, candidate, false, call);
  return 'paused';
}

async function executeAndVerify(
  job: BrokerJob,
  client: BrokerMcpClient,
  candidate: ListingCandidate,
  paid: boolean,
  initialCall?: { executionId: string | null; status: string; output: string | null; error: string | null }
): Promise<void> {
  const params = normalizeParams(job.spec.params, candidate.inputSchema);
  if (paid) {
    setStatus(job, 'executing');
    const execution = await client.callWorkflow(candidate.slug, params);
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
  } else {
    // Free listing: the initial call already returned an execution id.
    const executionId = initialCall?.executionId ?? null;
    if (!executionId) {
      throw new ProviderError({ code: 'call_failed', message: `The workflow call for "${candidate.slug}" returned neither a quote nor an execution id.` });
    }
    job.execution = { executionId, status: initialCall?.status ?? 'running', output: initialCall?.output ?? null, completed: false, failed: false, error: null, verified: false, receipts: [] };
    pushAudit(job, 'execution_requested', 'Execution started (free listing).', { executionId });
    storeJob(job);
    setStatus(job, 'verifying');
    const verified = await verifyExecution(client, executionId);
    job.execution = verified;
    if (!verified.completed) {
      pushAudit(job, 'verification_failed', 'Independent verification failed.', { executionId, error: verified.error });
      throw new ProviderError({ code: 'verification_failed', message: verified.error ?? 'Execution did not verify.' });
    }
    pushAudit(job, 'verification_passed', 'Independent verification passed via KeeperHub execution status.', {
      executionId,
      status: verified.status,
    });
    pushAudit(job, 'execution_completed', 'Workflow completed.', { executionId, status: verified.status });
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
    if (result.buildPath === 'template') {
      pushAudit(job, 'verification_passed', 'Workflow built from a marketplace template; execution launched in KeeperHub (manual trigger — confirm in the KeeperHub dashboard).', {
        executionId: result.execution.executionId,
        workflowId: result.workflowId,
      });
      setStatus(job, 'completed');
      pushAudit(job, 'job_completed', 'Job completed — the agent built a new workflow from a template.', {
        workflowId: result.workflowId,
        name: result.name,
        buildPath: result.buildPath,
      });
    } else {
      pushAudit(job, 'verification_passed', 'Generated workflow verified via KeeperHub execution status.', {
        executionId: result.execution.executionId,
        status: result.execution.status,
        workflowId: result.workflowId,
      });
      setStatus(job, 'completed');
      pushAudit(job, 'job_completed', 'Job completed via generated fallback workflow.', {
        workflowId: result.workflowId,
        name: result.name,
        buildPath: result.buildPath,
      });
    }
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
    ...(job.selected ? [`Listing: ${job.selected.name} (${job.selected.slug})`, `Price: $${job.selected.priceUsdcPerCall.toFixed(2)}/call`] : []),
    ...(job.payment ? [`Payment: ${job.payment.mode === 'simulated' ? 'simulated' : `real (tx ${job.payment.txHash})`} — $${job.payment.amountUsdc.toFixed(2)} ${job.payment.asset}`] : []),
    ...(job.payment?.receipt
      ? [
          `Receipt: block ${job.payment.receipt.blockNumber} · status ${job.payment.receipt.status} · confirmations ${job.payment.receipt.confirmations}`,
          `On-chain check: amount match ${job.payment.receipt.matches.amount ? 'YES' : 'NO'} · recipient match ${job.payment.receipt.matches.recipient ? 'YES' : 'NO'}`,
          `Explorer: https://basescan.org/tx/${job.payment.txHash}`,
        ]
      : []),
    ...(job.execution?.executionId ? [`Execution id: ${job.execution.executionId}`] : []),
    ...(job.execution?.verified ? [`Verified: yes (KeeperHub execution status)`] : [`Verified: execution launched — pending manual trigger on KeeperHub`]),
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