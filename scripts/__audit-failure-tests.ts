import { verifyExecution } from '../src/lib/broker/verify';
import { confirmUserPayment, resumeAfterUserPayment, brokerMcpClient, getJob } from '../src/lib/broker/pipeline';
import type { BrokerJob, ListingCandidate, PaymentQuote } from '../src/lib/broker/types';

// ---- sandbox the network boundary ----
process.env.BROKER_PAYER_RPC_URL = 'http://127.0.0.1:1'; // unreachable -> any on-chain call fails instantly
delete process.env.BLOB_READ_WRITE_TOKEN; // no shared blob reads/writes during tests

const CANDIDATE: ListingCandidate = {
  id: 'audit-listing-1',
  name: 'Audit Listing',
  slug: 'audit-listing',
  description: 'test listing',
  priceUsdcPerCall: 0.25,
  inputSchema: null,
  workflowType: 'read',
  callCount: 1,
  isListed: true,
  organizationId: 'org',
  category: null,
  chain: null,
  listedAt: new Date().toISOString(),
};

const QUOTE: PaymentQuote = {
  x402Version: 2,
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  network: 'base',
  amountUnits: '250000',
  amountUsdc: 0.25,
  payTo: '0x1111111111111111111111111111111111111111',
  maxTimeoutSeconds: 300,
  resourceUrl: 'x402://audit',
  description: 'audit quote',
};

let auditSeq = 0;
function makeJob(status: BrokerJob['status']): BrokerJob {
  auditSeq += 1;
  const now = new Date().toISOString();
  return {
    id: `audit-job-${auditSeq}`,
    status,
    spec: { goal: 'audit goal', query: 'audit', params: {}, budgetUsdc: 1, chainId: 8453, maxPriceUsdc: 1 },
    accountEmail: null,
    createdAt: now,
    updatedAt: now,
    candidates: [CANDIDATE],
    selected: CANDIDATE,
    quote: QUOTE,
    payment:
      status === 'awaiting_payment'
        ? { mode: 'user', amountUsdc: 0.25, asset: QUOTE.asset, payTo: QUOTE.payTo, network: 'base', status: 'paid', txHash: '0x' + 'a'.repeat(64), paidAt: now }
        : null,
    execution: null,
    audit: [],
    report: null,
    error: null,
    forcedSlug: null,
    payMode: 'user',
    decision: null,
    decisionRecord: null,
    proof: null,
    pendingFallback: null,
  };
}

async function writeStore(jobs: BrokerJob[]): Promise<void> {
  const { mkdirSync, writeFileSync } = await import('fs');
  const { resolve, join } = await import('path');
  mkdirSync(join(resolve(process.cwd()), '.data'), { recursive: true });
  writeFileSync(join(resolve(process.cwd()), '.data', 'broker-jobs.json'), JSON.stringify({ jobs }, null, 0), 'utf8');
}

function stubMcp(overrides: { callWorkflow?: any; waitForExecution?: any }): { calls: Record<string, number>; restore: () => void } {
  const calls = { callWorkflow: 0, getExecution: 0, waitForExecution: 0 };
  const original = { callWorkflow: brokerMcpClient.callWorkflow, waitForExecution: brokerMcpClient.waitForExecution };
  (brokerMcpClient as any).callWorkflow = async (slug: string) => {
    calls.callWorkflow += 1;
    if (overrides.callWorkflow) return overrides.callWorkflow(slug);
    return { quote: null, executionId: `exec-${calls.callWorkflow}`, status: 'running', output: null, error: null };
  };
  (brokerMcpClient as any).waitForExecution = async (executionId: string) => {
    calls.waitForExecution += 1;
    if (overrides.waitForExecution) return overrides.waitForExecution(executionId);
    return { status: 'completed', completed: true, failed: false, error: null };
  };
  const restore = () => {
    (brokerMcpClient as any).callWorkflow = original.callWorkflow;
    (brokerMcpClient as any).waitForExecution = original.waitForExecution;
  };
  return { calls, restore };
}

async function main(): Promise<void> {
  console.log('SIXA BROKER FAILURE TESTS (offline — every network boundary is stubbed)');
  console.log('='.repeat(72));

  // ---- TEST 1a: verifyExecution verdict when KeeperHub says pending, pending, failed ----
  console.log('\nTEST 1a — verifyExecution fed pending -> pending -> failed KeeperHub statuses');
  let attempts = 0;
  const fakeClient = {
    waitForExecution: async (_executionId: string) => {
      attempts += 1;
      if (attempts <= 2) return { status: 'pending', completed: false, failed: false, error: null };
      return { status: 'failed', completed: false, failed: true, error: 'execution reverted' };
    },
  } as any;
  const v1 = await verifyExecution(fakeClient, 'exec-test-1');
  console.log('  verdict:', JSON.stringify(v1));
  console.log('  completed =', v1.completed, '| verified =', v1.verified, '| failed =', v1.failed);
  if (v1.completed || v1.verified) throw new Error('TEST 1a FAILED: job marked complete on failed/pending status');
  console.log('  PASS: broker did NOT mark the job complete or verified');

  // ---- TEST 1b: full user-payment resume path when KeeperHub status is failed ----
  console.log('\nTEST 1b — resumeAfterUserPayment when KeeperHub execution status = failed');
  const job1 = makeJob('awaiting_payment');
  await writeStore([job1]);
  const mcp1 = stubMcp({
    waitForExecution: async () => ({ status: 'failed', completed: false, failed: true, error: 'execution reverted on-chain' }),
  });
  try {
    await resumeAfterUserPayment(job1.id);
  } catch (e) {
    console.log('  resumeAfterUserPayment rejected:', e instanceof Error ? e.message : String(e));
  }
  const after1 = await getJob(job1.id);
  console.log('  job.status            =', after1?.status);
  console.log('  execution.verified    =', after1?.execution?.verified);
  console.log('  execution.completed   =', after1?.execution?.completed);
  console.log('  execution.error       =', after1?.execution?.error);
  console.log('  payment.status        =', after1?.payment?.status);
  console.log('  payment.txHash        =', after1?.payment?.txHash);
  console.log('  callWorkflow count    =', mcp1.calls.callWorkflow);
  console.log('  audit verification_failed =', after1?.audit.filter((a) => a.type === 'verification_failed').length);
  if (after1?.status === 'completed' || after1?.execution?.verified) throw new Error('TEST 1b FAILED: job completed despite failed verification');
  if (after1?.payment?.status !== 'paid' || after1?.payment?.txHash !== '0x' + 'a'.repeat(64)) throw new Error('TEST 1b FAILED: payment was mutated/released');
  console.log('  PASS: job NOT completed, NOT verified, payment untouched (no release), execution not re-triggered');
  mcp1.restore();

  // ---- TEST 2a: duplicate "job complete" signal via double resume ----
  console.log('\nTEST 2a — same job-complete signal delivered twice (sequential)');
  const job2 = makeJob('awaiting_payment');
  await writeStore([job2]);
  const mcp2 = stubMcp({});
  await resumeAfterUserPayment(job2.id);
  await resumeAfterUserPayment(job2.id);
  const after2 = await getJob(job2.id);
  console.log('  callWorkflow count    =', mcp2.calls.callWorkflow, '(must be 1)');
  console.log('  job.status            =', after2?.status);
  console.log('  execution.verified    =', after2?.execution?.verified);
  console.log('  audit execution_requested =', after2?.audit.filter((a) => a.type === 'execution_requested').length);
  console.log('  audit job_completed       =', after2?.audit.filter((a) => a.type === 'job_completed').length);
  if (mcp2.calls.callWorkflow !== 1) throw new Error('TEST 2a FAILED: executed twice');
  if (after2?.status !== 'completed') throw new Error('TEST 2a FAILED: job did not complete on first signal');
  console.log('  PASS: second signal was ignored; executed exactly once, paid once');
  mcp2.restore();

  // ---- TEST 2b: duplicate payment-confirm POSTs with the same txHash ----
  console.log('\nTEST 2b — confirmUserPayment resubmitted twice with the same txHash (no network, RPC unreachable)');
  const job3 = makeJob('awaiting_payment');
  job3.payment = { ...job3.payment!, status: 'quoted', txHash: undefined, paidAt: undefined };
  await writeStore([job3]);
  const hash = '0x' + 'b'.repeat(64);
  const r1 = await confirmUserPayment(job3.id, hash, '0x2222222222222222222222222222222222222222');
  const r2 = await confirmUserPayment(job3.id, hash, '0x2222222222222222222222222222222222222222');
  const after3 = await getJob(job3.id);
  console.log('  first confirm :', JSON.stringify(r1));
  console.log('  second confirm:', JSON.stringify(r2));
  console.log('  payment.status =', after3?.payment?.status, '| job.status =', after3?.status);
  if (after3?.payment?.status === 'paid') throw new Error('TEST 2b FAILED: payment recorded as paid without provable on-chain receipt');
  if (after3?.status === 'completed') throw new Error('TEST 2b FAILED: job completed without verified payment');
  console.log('  PASS: resubmission did NOT pay or execute — payment requires an on-chain receipt, job not completed');

  console.log('\nALL TESTS COMPLETED');
}

main().catch((e) => {
  console.error('TEST RUNNER ERROR:', e);
  process.exit(1);
});
