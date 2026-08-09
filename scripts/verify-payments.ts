import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { decodeEventLog } from 'viem';
import { USDC_DECIMALS, basePublicClient } from '../src/lib/broker/pay';
import type { BrokerJob } from '../src/lib/broker/types';

const projectRoot = resolve(__dirname, '..');
const jobsFilePath = join(projectRoot, '.data', 'broker-jobs.json');
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const TRANSFER_EVENT = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { type: 'address', indexed: true, name: 'from' },
      { type: 'address', indexed: true, name: 'to' },
      { type: 'uint256', indexed: false, name: 'value' },
    ],
  },
] as const;

const args = process.argv.slice(2);
const jobFilter = args.includes('--job') ? args[args.indexOf('--job') + 1] : null;
const asJson = args.includes('--json');

async function loadEnv(): Promise<void> {
  try {
    const envPath = join(projectRoot, '.env.local');
    if (existsSync(envPath)) {
      const { loadEnvFile } = await import('node:process');
      (loadEnvFile as unknown as (p: string) => void)(envPath);
    }
  } catch {
    // .env.local is optional — the default Base RPC is used below
  }
}

function loadJobs(): BrokerJob[] {
  if (!existsSync(jobsFilePath)) return [];
  try {
    const raw = readFileSync(jobsFilePath, 'utf8');
    const parsed = JSON.parse(raw) as { jobs?: BrokerJob[] };
    return Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch {
    return [];
  }
}

interface CheckResult {
  jobId: string;
  jobStatus: string;
  payMode: string;
  paymentMode: string | null;
  recordedAmountUsdc: number | null;
  recordedPayTo: string | null;
  txHash: string | null;
  verified: boolean;
  skipped: boolean;
  receiptStatus: string | null;
  onChainAmountUsdc: number | null;
  onChainRecipient: string | null;
  confirmations: number | null;
  amountMatch: boolean;
  recipientMatch: boolean;
  blockNumber: number | null;
  error: string | null;
}

async function checkJob(job: BrokerJob, client: ReturnType<typeof basePublicClient>): Promise<CheckResult> {
  const base: CheckResult = {
    jobId: job.id,
    jobStatus: job.status,
    payMode: job.payMode,
    paymentMode: job.payment?.mode ?? null,
    recordedAmountUsdc: job.payment?.amountUsdc ?? null,
    recordedPayTo: job.payment?.payTo ?? null,
    txHash: job.payment?.txHash ?? null,
    verified: false,
    skipped: false,
    receiptStatus: null,
    onChainAmountUsdc: null,
    onChainRecipient: null,
    confirmations: null,
    amountMatch: false,
    recipientMatch: false,
    blockNumber: null,
    error: null,
  };

  if (job.payMode !== 'real' || job.payment?.mode !== 'real') {
    return { ...base, skipped: true, error: 'skipped — payment was simulated, nothing to verify on-chain' };
  }
  if (!job.payment.txHash) {
    return { ...base, error: 'REAL PAYMENT WITHOUT txHash — nothing provable was recorded' };
  }
  if (!job.payment.receipt) {
    return { ...base, error: 'REAL PAYMENT WITHOUT RECEIPT — recorded as paid but no on-chain confirmation exists' };
  }

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: job.payment.txHash as `0x${string}` });
  } catch (error) {
    return { ...base, error: `receipt lookup failed: ${error instanceof Error ? error.message : 'unknown'}` };
  }

  const result: CheckResult = {
    ...base,
    verified: true,
    receiptStatus: receipt.status,
    blockNumber: Number(receipt.blockNumber),
  };

  const log = receipt.logs.find((l) => l.topics[0] === TRANSFER_TOPIC);
  if (log) {
    try {
      const decoded = decodeEventLog({ abi: TRANSFER_EVENT, data: log.data, topics: log.topics });
      const decodedArgs = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
      result.onChainRecipient = decodedArgs.to.toLowerCase();
      result.onChainAmountUsdc = Number(decodedArgs.value) / 10 ** USDC_DECIMALS;
    } catch {
      result.error = 'Transfer event present but not decodable';
    }
  }

  const expectedUnits =
    job.quote?.amountUnits ??
    (job.payment.amountUsdc != null ? BigInt(Math.round(job.payment.amountUsdc * 10 ** USDC_DECIMALS)) : null);
  if (expectedUnits !== null && result.onChainAmountUsdc !== null) {
    result.amountMatch = BigInt(Math.round(result.onChainAmountUsdc * 10 ** USDC_DECIMALS)) === expectedUnits;
  }
  result.recipientMatch = Boolean(
    job.payment.payTo && result.onChainRecipient && result.onChainRecipient === job.payment.payTo.toLowerCase()
  );

  const latest = await client.getBlockNumber().catch(() => receipt.blockNumber + 1n);
  result.confirmations = Number(latest - receipt.blockNumber) + 1;

  if (receipt.status !== 'success') {
    result.error = 'receipt status is not success';
  } else if (!result.amountMatch || !result.recipientMatch) {
    result.error = 'receipt decodes but does not match the recorded amount/recipient';
  }
  return result;
}

async function main(): Promise<void> {
  await loadEnv();
  const jobs = loadJobs();
  const targets = jobFilter ? jobs.filter((j) => j.id.startsWith(jobFilter)) : jobs;
  const client = basePublicClient();

  if (targets.length === 0) {
    const notice = jobFilter ? `no stored job matches "${jobFilter}"` : 'no stored jobs found (is .data/broker-jobs.json populated?)';
    console.log(`\nVERIFY PAYMENTS — ${notice}\n`);
    process.exit(jobFilter ? 1 : 0);
  }

  const results: CheckResult[] = [];
  for (const job of targets) {
    try {
      results.push(await checkJob(job, client));
    } catch (error) {
      results.push({
        jobId: job.id,
        jobStatus: job.status,
        payMode: job.payMode,
        paymentMode: job.payment?.mode ?? null,
        recordedAmountUsdc: job.payment?.amountUsdc ?? null,
        recordedPayTo: job.payment?.payTo ?? null,
        txHash: job.payment?.txHash ?? null,
        verified: false,
        skipped: false,
        receiptStatus: null,
        onChainAmountUsdc: null,
        onChainRecipient: null,
        confirmations: null,
        amountMatch: false,
        recipientMatch: false,
        blockNumber: null,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\nVERIFYING PAYMENTS AGAINST BASE MAINNET RECEIPTS\n');
    console.log('job id'.padEnd(14) + 'mode'.padEnd(10) + 'amount$'.padEnd(12) + 'tx'.padEnd(12) + 'block'.padEnd(9) + 'conf'.padEnd(6) + 'verdict');
    console.log('-'.repeat(80));
    for (const r of results) {
      const pass = r.verified && !r.error;
      const verdict = r.skipped ? 'SKIP' : pass ? 'PASS' : 'FAIL';
      console.log(
        r.jobId.slice(0, 12).padEnd(14) +
          (r.paymentMode ?? r.payMode).padEnd(10) +
          (r.onChainAmountUsdc ?? r.recordedAmountUsdc ?? 0).toFixed(6).padEnd(12) +
          (r.txHash ? `${r.txHash.slice(0, 10)}…` : 'none').padEnd(12) +
          (r.blockNumber ?? '-').toString().padEnd(9) +
          (r.confirmations ?? '-').toString().padEnd(6) +
          verdict
      );
      if (r.error) console.log(`   ↳ ${r.error}`);
    }
    console.log('-'.repeat(80));
    const failures = results.filter((r) => !r.skipped && (!r.verified || r.error));
    const checked = results.filter((r) => !r.skipped).length;
    const verifiedCount = results.filter((r) => !r.skipped && r.verified && !r.error).length;
    if (failures.length === 0) {
      console.log(
        checked === 0
          ? 'No real payments in the store — nothing to verify on-chain.'
          : `${verifiedCount}/${checked} verified on-chain — every real payment has a provable, matching receipt.`
      );
    } else {
      console.log(`${verifiedCount}/${checked} verified; ${failures.length} REAL PAYMENT(S) FAILED on-chain verification.`);
    }
  }

  const hardFailures = results.some((r) => !r.skipped && r.payMode === 'real' && (!r.verified || r.error));
  process.exit(hardFailures ? 1 : 0);
}

void main();