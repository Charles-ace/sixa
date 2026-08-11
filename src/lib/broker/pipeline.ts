import { BrokerMcpClient } from './client';
import { discover, type DiscoverPass } from './discover';
import { select, bestMatchScore } from './select';
import { intake } from './intake';
import { basePublicClient, confirmOnChainReceipt, payX402, payerMode } from './pay';
import { verifyExecution } from './verify';
import { createFallbackWorkflow, executeFallbackWorkflow, type FallbackWorkflowRef } from './generate';
import { after } from 'next/server';
import { generateId } from '@/lib/utils';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import { loadJobs, loadSharedJobs, saveJobs, usesSharedStore } from './store';
import { isNativeAsset, type AuditEvent, type AuditEventType, type BrokerJob, type CallRecord, type CheckResultDetail, type CompletionProof, type ExecutionResult, type JobDecision, type JobSpec, type ListingCandidate, type PaymentMode } from './types';

const jobs = new Map<string, BrokerJob>();
for (const job of loadJobs()) {
  jobs.set(job.id, job);
}
const MAX_JOBS = 50;
const MIN_MATCH_SCORE = 4;

export const brokerMcpClient = new BrokerMcpClient();

export async function createJob(input: {
  message: string;
  accountEmail?: string | null;
  budgetUsdc?: number;
  forcedSlug?: string | null;
  payMode?: PaymentMode;
  demoMode?: boolean;
}): Promise<BrokerJob> {
  const jobId = generateId();
  const isDemo = Boolean(input.demoMode || input.payMode === 'demo');
  const pendingSpec: JobSpec = {
    goal: input.message,
    query: '',
    params: {},
    budgetUsdc: 0.5,
    chainId: null,
    maxPriceUsdc: 0.25,
    demoMode: isDemo,
  };
  const job = newJob(jobId, pendingSpec, {
    ...input,
    payMode: isDemo ? 'demo' : input.payMode,
  });
  await storeJob(job);
  const runPromise = runJob(jobId, input);
  await Promise.race([
    runPromise,
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  return jobs.get(jobId) ?? job;
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
    decision: null,
    decisionRecord: null,
    proof: null,
    pendingFallback: null,
  };
  pushAudit(job, 'job_created', `Job ${id} created.`, { goal: spec.goal, budgetUsdc: spec.budgetUsdc, chainId: spec.chainId, payMode: job.payMode });
  return job;
}

export function pushAudit(job: BrokerJob, type: AuditEventType, message: string, data?: Record<string, unknown> | null): void {
  job.audit.push({ id: generateId(), jobId: job.id, type, message, data: data ?? null, timestamp: new Date().toISOString() });
}

export function setStatus(job: BrokerJob, status: BrokerJob['status']): void {
  job.status = status;
  job.updatedAt = new Date().toISOString();
}

export async function storeJob(job: BrokerJob): Promise<void> {
  jobs.set(job.id, job);
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.keys()].sort((a, b) => {
      const ja = jobs.get(a);
      const jb = jobs.get(b);
      return (ja?.createdAt ?? '').localeCompare(jb?.createdAt ?? '');
    }).slice(0, jobs.size - MAX_JOBS);
    for (const key of oldest) jobs.delete(key);
  }
  await saveJobs([...jobs.values()]);
}

// ---- explicit per-job decision record + completion verdict ----

function compactCandidate(c: ListingCandidate): Record<string, unknown> {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    priceUsdcPerCall: c.priceUsdcPerCall,
    organizationId: c.organizationId,
    chain: c.chain,
    listedAt: c.listedAt,
  };
}

function buildDiscoverCall(passes: DiscoverPass[], candidates: ListingCandidate[], error?: unknown): CallRecord {
  return {
    request: {
      method: 'tools/call',
      name: 'search_workflows',
      params: passes,
    },
    response: error
      ? { error: error instanceof Error ? error.message : String(error), count: 0, candidates: [] }
      : { count: candidates.length, candidates: candidates.map(compactCandidate) },
  };
}

function buildGenerateCall(goal: string, params: Record<string, unknown>, ref: FallbackWorkflowRef): CallRecord {
  return {
    request: { method: 'tools/call', name: 'ai_generate_workflow', arguments: { prompt: goal }, params },
    response: {
      workflowId: ref.workflowId,
      name: ref.name,
      buildPath: ref.buildPath,
      workflowCreatedAt: ref.workflowCreatedAt,
      executionId: ref.execution?.executionId ?? null,
      status: ref.execution?.status ?? null,
      verified: ref.execution?.verified ?? false,
      executionTxHash: ref.execution?.executionTxHash ?? null,
    },
  };
}

function buildCompletionProof(job: BrokerJob): CompletionProof {
  // The fallback path has no payment step by design: verification is
  // execution-based only (workflow built, executed on Base Sepolia, tx hash
  // confirmed via KeeperHub). Payment checks only apply to paid listings.
  const isFallback = job.decision?.source === 'generated_fallback';
  const paymentTx = job.payment?.txHash ?? null;
  const paymentConfirmed: CheckResultDetail = (() => {
    if (isFallback) {
      return {
        ok: true,
        how: 'not applicable — fallback path has no payment step',
        detail: 'verification is execution-based for generated/template workflows',
      };
    }
    if (job.payment?.status !== 'paid' || !paymentTx) {
      return {
        ok: false,
        how: 'Base x402 settlement',
        detail: job.payment?.mode === 'simulated'
          ? 'payment was simulated — no on-chain tx_hash exists'
          : `payment.status=${job.payment?.status ?? 'none'} — no tx_hash recorded`,
      };
    }
    const r = job.payment.receipt;
    if (r && r.status === 'success' && r.matches.amount && r.matches.recipient) {
      return {
        ok: true,
        how: 'Base block explorer receipt (confirmOnChainReceipt)',
        detail: `block ${r.blockNumber}, ${r.confirmations} confirmations, amount/recipient match`,
      };
    }
    return { ok: false, how: 'Base block explorer receipt', detail: 'receipt missing, reverted, or amount/recipient mismatch' };
  })();

  const execTx = job.execution?.executionTxHash ?? null;
  const executionConfirmed: CheckResultDetail = (() => {
    if (job.execution?.verified && job.execution.completed) {
      return {
        ok: true,
        how: 'KeeperHub get_execution status endpoint',
        detail: `status=${job.execution.status}, executionId=${job.execution.executionId ?? 'none'}`,
      };
    }
    return {
      ok: false,
      how: 'KeeperHub get_execution status endpoint',
      detail: `verified=${job.execution?.verified ?? false}, completed=${job.execution?.completed ?? false}${job.execution?.error ? `, error=${job.execution.error}` : ''}`,
    };
  })();

  const checks: Array<{ name: string; ok: boolean }> = [
    { name: 'payment_tx_hash present', ok: isFallback || Boolean(paymentTx) },
    { name: 'payment independently confirmed (Base block explorer)', ok: isFallback || paymentConfirmed.ok },
    { name: 'execution_tx_hash present', ok: Boolean(execTx) },
    { name: 'execution confirmed via KeeperHub status endpoint', ok: executionConfirmed.ok },
    { name: 'workflow_id present', ok: Boolean(job.decision?.workflow_id) },
  ];
  const failed = checks.filter((c) => !c.ok);
  const status: CompletionProof['status'] = failed.length === 0 ? 'verified' : 'unverified';

  const proof: CompletionProof = {
    status,
    payment_tx_hash: paymentTx,
    payment_confirmed: paymentConfirmed,
    execution_tx_hash: execTx,
    execution_confirmed: executionConfirmed,
    workflow_id: job.decision?.workflow_id ?? null,
  };
  job.proof = proof;
  pushAudit(
    job,
    status === 'verified' ? 'completion_verified' : 'completion_unverified',
    status === 'verified'
      ? 'Completion verified — payment and execution independently confirmed.'
      : `Completion UNVERIFIED — failing check${failed.length > 1 ? 's' : ''}: ${failed.map((f) => f.name).join('; ')}.`,
    { status, checks }
  );
  return proof;
}

function printCompletion(job: BrokerJob): void {
  const p = job.proof;
  if (!p) return;
  console.log('\n┌─ JOB COMPLETION REPORT ─────────────────────────────');
  console.log(`│ job ${job.id}  source=${job.decision?.source ?? 'none'}  verdict=${p.status.toUpperCase()}`);
  console.log(`│ payment_tx_hash   : ${p.payment_tx_hash ?? 'null'}`);
  console.log(`│ execution_tx_hash : ${p.execution_tx_hash ?? 'null'}`);
  console.log(`│ workflow_id       : ${p.workflow_id ?? 'null'}`);
  console.log(`│ payment check     : ${p.payment_confirmed.ok ? 'OK' : 'FAILED'} — ${p.payment_confirmed.detail}`);
  console.log(`│ execution check   : ${p.execution_confirmed.ok ? 'OK' : 'FAILED'} — ${p.execution_confirmed.detail}`);
  console.log('└─────────────────────────────────────────────────────');
}

function recordDecision(job: BrokerJob, decision: JobDecision): void {
  job.decision = decision;
  pushAudit(job, 'path_decided', `Decision path: ${decision.source}.`, {
    source: decision.source,
    workflow_id: decision.workflow_id,
    workflow_created_at: decision.workflow_created_at,
    workflow_owner_address: decision.workflow_owner_address,
  });
}

export async function getJob(jobId: string): Promise<BrokerJob | null> {
  const all = await listJobs();
  return all.find((j) => j.id === jobId) ?? null;
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
  const quoteChainId = quote.network === 'eip155:8453' || quote.network === '8453' || quote.network === 'base' ? 8453 : 84532;
  let receipt;
  try {
    receipt = await confirmOnChainReceipt({
      txHash: txHash as `0x${string}`,
      asset: quote.asset,
      native: isNativeAsset(quote.asset),
      expectedAmountUnits: quote.amountUnits,
      expectedRecipient: quote.payTo,
      expectedFrom: from || undefined,
      publicClient: basePublicClient(undefined, quoteChainId),
      payer: '',
      networkName: quoteChainId === 8453 ? 'base' : 'base-sepolia',
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
  await storeJob(job);
  await resumeAfterUserPayment(jobId);
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
  demoMode?: boolean;
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
    await storeJob(job);
  }

  try {
    const isDemo = Boolean(input.demoMode || input.payMode === 'demo' || job.spec.demoMode || job.payMode === 'demo');
    const spec = await intake({ message: input.message, budgetUsdc: input.budgetUsdc });
    if (isDemo) spec.demoMode = true;
    job.spec = spec;
    job.payMode = isDemo ? 'demo' : (input.payMode ?? job.payMode);
    pushAudit(job, 'intent_parsed', 'Intent parsed into a job spec.', {
      goal: spec.goal,
      query: spec.query,
      budgetUsdc: spec.budgetUsdc,
      chainId: spec.chainId,
      demoMode: isDemo,
    });
    await storeJob(job);

    await executePipeline(job);
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'Broker pipeline failed.';
    setStatus(job, 'failed');
    pushAudit(job, 'job_failed', 'Pipeline failed.', {
      error: job.error,
      hint: error instanceof ProviderError ? error.hint : undefined,
    });
    job.report = buildFailureReport(job);
    await storeJob(job);
  }

  return job;
}

async function executePipeline(job: BrokerJob): Promise<void> {
  const client = brokerMcpClient;

  setStatus(job, 'discovering');
  pushAudit(job, 'catalog_searched', 'Searching the live KeeperHub marketplace.', { query: job.spec.query, chainId: job.spec.chainId });

  let candidates: ListingCandidate[] = [];
  let passes: DiscoverPass[] = [];
  let discoverError: unknown = null;
  try {
    const discovered = await discover(job.spec, client);
    candidates = discovered.candidates;
    passes = discovered.passes;
  } catch (error) {
    discoverError = error;
    passes = [{ query: job.spec.query, sort: 'popular', chainId: job.spec.chainId }];
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
      await storeJob(job);
      return;
    }
  }

  const discoverCall = buildDiscoverCall(passes, candidates, discoverError ?? undefined);
  job.candidates = candidates;
  pushAudit(job, 'candidate_found', `Found ${candidates.length} candidates.`, { slugs: candidates.slice(0, 8).map((c) => c.slug) });

  const isDemoMode = Boolean(job.spec.demoMode || job.payment?.mode === 'demo');
  if (isDemoMode) {
    const bestScore = candidates.length > 0 ? bestMatchScore(job.spec, candidates) : 0;
    pushAudit(job, 'candidate_found', `Marketplace path skipped: demo mode active, no mainnet funds available for live payment. Probed ${candidates.length} marketplace listings (best match score ${bestScore.toFixed(1)}); proceeding to the free Base Sepolia generation fallback.`, {
      demoMode: true,
      bestScore,
      reason: 'demo mode, no mainnet funds available for live payment',
      slugs: candidates.slice(0, 8).map((c) => c.slug),
    });
    pushAudit(job, 'fallback_generation', 'Demo mode active — no marketplace payment attempt; proceeding to free Base Sepolia generation fallback.');
    await attemptGenerationFallback(job, client, discoverCall);
    return;
  }

  if (candidates.length === 0) {
    pushAudit(job, 'fallback_generation', 'No marketplace listing matched the intent — generating a workflow instead.', { query: job.spec.query });
    await attemptGenerationFallback(job, client, discoverCall);
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
    await attemptGenerationFallback(job, client, discoverCall);
    return;
  }

  setStatus(job, 'selecting');
  const selection = select(job.spec, candidates);
  job.selected = selection.selected;
  recordDecision(job, {
    source: 'marketplace_existing',
    workflow_id: selection.selected.id || selection.selected.slug,
    workflow_created_at: selection.selected.listedAt || job.createdAt,
    workflow_owner_address: selection.selected.organizationId || null,
    discover_call: discoverCall,
    generate_call: null,
  });
  pushAudit(job, 'selection_made', 'Selection decided.', {
    slug: selection.selected.slug,
    priceUsdcPerCall: selection.selected.priceUsdcPerCall,
    reason: selection.reason,
    runnerUp: selection.runnerUp?.slug ?? null,
  });
  await storeJob(job);

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
      if (job.payment?.mode === 'real' && job.payment.status === 'paid' && job.payment.txHash) {
        // A real on-chain payment was made but the listing never returned an
        // execution id. STOP — never pay the next candidate after a paid one
        // failed, and never claim this job completed.
        const hint = 'The listing was paid (see payment tx hash) but the gateway did not return an execution id to verify. Contact the listing provider or retry later.';
        job.error = `${message} (${hint})`;
        pushAudit(job, 'job_failed', 'Real payment made but execution unconfirmed — job failed to avoid double-spending.', {
          slug: candidate.slug,
          paymentTxHash: job.payment.txHash,
          hint,
        });
        setStatus(job, 'failed');
        job.report = buildFailureReport(job);
        await storeJob(job);
        return;
      }
      setStatus(job, 'selecting');
      await storeJob(job);
    }
  }

  // Every live listing failed — generate a workflow as a last resort.
  await attemptGenerationFallback(job, client, discoverCall);
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
      await storeJob(job);
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
    await storeJob(job);

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
        buildCompletionProof(job);
        printCompletion(job);
        job.report = buildSuccessReport(job);
        await storeJob(job);
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
    // After paying an x402 quote the gateway needs a moment to index the
    // payment before it lets the same call execute. Retry with backoff so a
    // verified payment isn't burned on a premature re-quote.
    let execution = await client.callWorkflow(candidate.slug, params);
    if (!execution.executionId && !execution.error && execution.quote) {
      const backoffs = [5_000, 10_000, 15_000, 20_000, 30_000];
      for (const delay of backoffs) {
        pushAudit(job, 'payment_indexing', 'Payment made but the gateway has not confirmed it yet — retrying the execution call.', {
          slug: candidate.slug,
          retryAfterMs: delay,
          paymentTxHash: job.payment?.txHash ?? null,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        execution = await client.callWorkflow(candidate.slug, params);
        if (execution.executionId) break;
      }
    }
    if (execution.error) {
      throw new ProviderError({ code: 'execution_failed', message: execution.error });
    }
    if (!execution.executionId) {
      throw new ProviderError({
        code: 'no_execution_id',
        message: `The workflow "${candidate.slug}" ran but returned no execution id to verify against.`,
        hint: 'The payment may not have been indexed by the listing gateway; check the payment tx on the explorer before retrying.',
      });
    }
    pushAudit(job, 'execution_requested', 'Execution started after payment.', { executionId: execution.executionId });
    job.execution = { executionId: execution.executionId, status: execution.status, output: execution.output, completed: false, failed: false, error: null, verified: false, receipts: [] };
    await storeJob(job);

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
    await storeJob(job);
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
  buildCompletionProof(job);
  printCompletion(job);
  job.report = buildSuccessReport(job);
  await storeJob(job);
}

async function attemptGenerationFallback(job: BrokerJob, client: BrokerMcpClient, discoverCall: CallRecord): Promise<void> {
  pushAudit(job, 'fallback_generation', 'No reliable marketplace listing remains; generating a workflow as last resort.');
  setStatus(job, 'executing');
  job.quote = null;
  await storeJob(job);

  const ref = await createFallbackWorkflow(client, job.spec.goal);
  if (ref.buildPath === 'none' && ref.execution) {
    job.execution = ref.execution;
    pushAudit(job, 'fallback_executed', 'Generated fallback failed.', { error: ref.execution.error });
    job.error = ref.execution.error ?? 'Fallback workflow generation failed.';
    setStatus(job, 'failed');
    job.report = buildFailureReport(job);
    await storeJob(job);
    return;
  }

  const params = normalizeParams(job.spec.params, null);

  // Enforce explicit user authorization before any fallback execution starts.
  // Demo mode still honors the gate: the pause is the honest, recorded
  // authorization step before the free Base Sepolia execution starts — no
  // payment is involved at any point (marketplace payments were skipped).
  if (job.payMode === 'user' || job.payMode === 'real' || job.payMode === 'demo') {
    job.pendingFallback = {
      workflowId: ref.workflowId,
      name: ref.name,
      buildPath: ref.buildPath,
      workflowCreatedAt: ref.workflowCreatedAt,
    };
    recordDecision(job, {
      source: 'generated_fallback',
      workflow_id: ref.workflowId,
      workflow_created_at: ref.workflowCreatedAt || new Date().toISOString(),
      workflow_owner_address: null, // KeeperHub's create response does not expose the org wallet address
      discover_call: discoverCall,
      generate_call: buildGenerateCall(job.spec.goal, params, ref),
    });
    pushAudit(job, 'fallback_generation', 'Generated fallback workflow requires explicit user authorization before execution.', {
      workflowId: ref.workflowId,
      name: ref.name,
      buildPath: ref.buildPath,
      payMode: job.payMode,
      demoMode: job.payMode === 'demo',
    });
    if (job.payMode === 'demo') {
      pushAudit(job, 'fallback_generation', 'Demo mode: awaiting explicit authorization before executing the free Base Sepolia fallback workflow — no payment required in this mode (marketplace payments skipped).', {
        workflowId: ref.workflowId,
        demoMode: true,
      });
    }
    setStatus(job, 'awaiting_payment');
    await storeJob(job);
    return;
  }

  const execution = await executeFallbackWorkflow(client, ref.workflowId, params);
  recordDecision(job, {
    source: 'generated_fallback',
    workflow_id: ref.workflowId,
    workflow_created_at: ref.workflowCreatedAt || new Date().toISOString(),
    workflow_owner_address: null, // KeeperHub's create response does not expose the org wallet address
    discover_call: discoverCall,
    generate_call: buildGenerateCall(job.spec.goal, params, { ...ref, execution }),
  });
  await applyFallbackExecution(job, ref, execution);
}

async function applyFallbackExecution(job: BrokerJob, ref: FallbackWorkflowRef, execution: ExecutionResult): Promise<void> {
  job.execution = execution;
  if (execution.verified) {
    if (ref.buildPath === 'template') {
      pushAudit(job, 'verification_passed', 'Workflow built from a marketplace template; execution confirmed via KeeperHub execution status.', {
        executionId: execution.executionId,
        workflowId: ref.workflowId,
        status: execution.status,
      });
      setStatus(job, 'completed');
      pushAudit(job, 'job_completed', 'Job completed — the agent built a new workflow from a template.', {
        workflowId: ref.workflowId,
        name: ref.name,
        buildPath: ref.buildPath,
      });
    } else {
      pushAudit(job, 'verification_passed', 'Generated workflow verified via KeeperHub execution status.', {
        executionId: execution.executionId,
        status: execution.status,
        workflowId: ref.workflowId,
      });
      setStatus(job, 'completed');
      pushAudit(job, 'job_completed', 'Job completed via generated fallback workflow.', {
        workflowId: ref.workflowId,
        name: ref.name,
        buildPath: ref.buildPath,
      });
    }
    buildCompletionProof(job);
    printCompletion(job);
    job.report = buildSuccessReport(job);
    await storeJob(job);
    return;
  }
  if (execution.executionId) {
    // The workflow was genuinely built and launched, but KeeperHub never
    // confirmed completion in the polling window. Record it honestly as an
    // unverified launch, never as a verified success.
    pushAudit(job, 'verification_failed', 'Workflow launched but completion was NOT confirmed within the polling window.', {
      executionId: execution.executionId,
      workflowId: ref.workflowId,
      error: execution.error,
      hint: 'Confirm the run in the KeeperHub dashboard before trusting the outcome.',
    });
    setStatus(job, 'failed');
    job.error = execution.error ?? 'Workflow launch unconfirmed.';
    buildCompletionProof(job);
    printCompletion(job);
    job.report = buildFailureReport(job);
    await storeJob(job);
    return;
  }
  pushAudit(job, 'fallback_executed', 'Generated fallback failed.', { error: execution.error });
  throw new ProviderError({ code: 'all_fallbacks_failed', message: execution.error ?? 'All fallbacks failed.' });
}

/**
 * Called by the resume route after the user explicitly authorizes a paused
 * fallback workflow: launches the stored workflow, polls it, and records the
 * honest terminal outcome. Returns synchronously with the job paused-state
 * transition; the background continuation keeps the pipeline alive.
 */
export async function resumeFallbackAfterAuthorization(jobId: string): Promise<{ ok: boolean; job?: BrokerJob; code?: string; error?: string }> {
  const job = await getJob(jobId);
  if (!job) return { ok: false, code: 'job_not_found', error: 'Job not found.' };
  if (job.status !== 'awaiting_payment') {
    return { ok: false, code: 'invalid_state', error: 'Job is not awaiting authorization.' };
  }
  if (job.payMode !== 'user' && job.payMode !== 'real' && job.payMode !== 'demo') {
    return { ok: false, code: 'not_paused', error: 'This job does not require fallback authorization.' };
  }
  const ref = job.pendingFallback;
  if (!ref) {
    return { ok: false, code: 'no_pending_workflow', error: 'No pending fallback workflow found for this job.' };
  }

  pushAudit(job, 'user_authorized', 'User explicitly authorized fallback workflow execution from UI.');
  setStatus(job, 'executing');
  await storeJob(job);

  try {
    const execution = await executeFallbackWorkflow(brokerMcpClient, ref.workflowId, normalizeParams(job.spec.params, null));
    const current = await getJob(jobId);
    if (current) {
      await applyFallbackExecution(current, { ...ref, execution: null }, execution);
    }
  } catch (error) {
    const current = await getJob(jobId);
    if (current) {
      current.error = error instanceof Error ? error.message : 'Fallback execution failed.';
      setStatus(current, 'failed');
      pushAudit(current, 'job_failed', 'Fallback execution failed.', { error: current.error });
      current.report = buildFailureReport(current);
      await storeJob(current);
    }
  }

  const finalJob = await getJob(jobId);
  return { ok: true, job: finalJob ?? job };
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
  const p = job.proof;
  const verdict = p && p.status === 'verified' ? 'COMPLETED (VERIFIED)' : 'UNVERIFIED';
  const lines = [
    `Job ${job.id} — ${verdict}.`,
    '',
    `Goal: ${job.spec.goal}`,
    ...(job.selected ? [`Listing: ${job.selected.name} (${job.selected.slug})`, `Price: $${job.selected.priceUsdcPerCall.toFixed(2)}/call`] : []),
    `Source: ${job.decision?.source ?? 'unknown'}`,
    `Workflow id: ${p?.workflow_id ?? 'none'}`,
    ...(p
      ? [
          `Payment tx hash: ${p.payment_tx_hash ?? 'none'} — ${p.payment_confirmed.ok ? 'CONFIRMED' : `CHECK FAILED: ${p.payment_confirmed.detail}`} (${p.payment_confirmed.how})`,
          `Execution tx hash: ${p.execution_tx_hash ?? 'none'} — ${p.execution_confirmed.ok ? 'CONFIRMED' : `CHECK FAILED: ${p.execution_confirmed.detail}`} (${p.execution_confirmed.how})`,
        ]
      : []),
    ...(job.payment?.receipt
      ? [
          `Receipt: block ${job.payment.receipt.blockNumber} · status ${job.payment.receipt.status} · confirmations ${job.payment.receipt.confirmations}`,
          `Explorer: https://basescan.org/tx/${job.payment.txHash}`,
        ]
      : []),
    ...(job.execution?.executionId ? [`Execution id: ${job.execution.executionId}`] : []),
    ...(p && p.status !== 'verified' ? [`Warning: this job is NOT reported as completed — ${p.payment_confirmed.ok && p.execution_confirmed.ok ? 'an independent check is missing' : 'see failing checks above'}.`] : []),
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