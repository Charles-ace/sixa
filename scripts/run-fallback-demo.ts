/**
 * Live demo driver for the generation-fallback path (Job 2):
 * 1. POST /api/broker/jobs  { message, budgetUsdc, payMode: 'real' }
 * 2. Poll GET /api/broker/jobs/:id until awaiting_payment (fallback authorization gate)
 * 3. POST /api/broker/jobs/:id/resume  (explicit user authorization)
 * 4. Poll until terminal (completed | failed)
 * 5. Print every raw response, save full trace + tx hash to results/
 *
 * Usage: npx tsx scripts/run-fallback-demo.ts <port> <runId>
 */
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const PORT = process.argv[2] ?? '3211';
const RUN_ID = process.argv[3] ?? Date.now().toString();
const BASE = `http://localhost:${PORT}`;
const MESSAGE =
  process.env.DEMO_MESSAGE ??
  'Verify the anchor commitment on Base for the demo run';

const RESULTS_DIR = resolve(join(__dirname, '..', 'results'));
const trace: Record<string, unknown> = {
  runId: RUN_ID,
  startedAt: new Date().toISOString(),
  base: BASE,
  message: MESSAGE,
  steps: [] as unknown[],
};

function log(step: string, data?: unknown) {
  console.log(`\n=== [${RUN_ID}] ${step} ===`);
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  (trace.steps as unknown[]).push({ step, at: new Date().toISOString(), data });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJob(id: string) {
  const res = await fetch(`${BASE}/api/broker/jobs/${id}`, { cache: 'no-store' });
  const body = (await res.json()) as any;
  return { httpStatus: res.status, job: (body.job ?? body) as any };
}

async function main() {
  mkdirSync(RESULTS_DIR, { recursive: true });

  log('STEP 1: POST /api/broker/jobs', {
    message: MESSAGE,
    budgetUsdc: 0.5,
    payMode: 'real',
  });
  const created = await fetch(`${BASE}/api/broker/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: MESSAGE, budgetUsdc: 0.5, payMode: 'real' }),
  });
  const createdBody = (await created.json()) as any;
  log('STEP 1 RESPONSE (raw)', {
    httpStatus: created.status,
    body: createdBody,
  });
  const jobId = createdBody?.job?.id ?? createdBody?.id;
  if (!jobId) throw new Error(`No job id returned: ${JSON.stringify(createdBody)}`);
  log('JOB ID', jobId);

  log('STEP 2: poll until authorization gate (awaiting_payment)');
  let paused: any = null;
  for (let i = 1; i <= 60; i++) {
    await sleep(3000);
    const { httpStatus, job } = await getJob(jobId);
    log(`STEP 2 poll ${i} (http ${httpStatus})`, {
      status: job.status,
      audit: job.audit?.map((a: any) => a.type) ?? [],
      pendingFallback: job.pendingFallback ?? null,
      quote: job.quote ?? null,
      execution: job.execution ?? null,
      error: job.error ?? null,
    });
    if (job.status === 'awaiting_payment') {
      paused = job;
      break;
    }
    if (job.status === 'failed') throw new Error(`Job failed before gate: ${job.error}`);
  }
  if (!paused) throw new Error('Never reached awaiting_payment');

  log('STEP 3: decision record at the gate', {
    decision: paused.decision ?? null,
    decisionRecord: paused.decisionRecord ?? null,
  });
  log('STEP 3: pendingFallback (workflow must exist, NOT launched)', paused.pendingFallback);

  log('STEP 4: POST /api/broker/jobs/:id/resume (explicit authorization)');
  const resume = await fetch(`${BASE}/api/broker/jobs/${jobId}/resume`, { method: 'POST' });
  const resumeBody = (await resume.json()) as any;
  log('STEP 4 RESPONSE (raw)', { httpStatus: resume.status, body: resumeBody });

  log('STEP 5: poll until terminal state');
  let terminal: any = null;
  for (let i = 1; i <= 60; i++) {
    await sleep(4000);
    const { httpStatus, job } = await getJob(jobId);
    log(`STEP 5 poll ${i} (http ${httpStatus})`, {
      status: job.status,
      audit: job.audit?.map((a: any) => a.type) ?? [],
      execution: job.execution ?? null,
      error: job.error ?? null,
    });
    if (job.status === 'completed' || job.status === 'failed') {
      terminal = job;
      break;
    }
  }
  if (!terminal) throw new Error('No terminal state within window');

  log('STEP 6: terminal job (full raw)', terminal);
  log('STEP 6: report', terminal.report ?? null);
  log('STEP 6: completion proof', terminal.proof ?? null);
  const txHash =
    terminal.execution?.transactionHash ??
    terminal.proof?.execution_tx_hash ??
    terminal.execution?.receipts?.[0] ??
    null;
  log('STEP 6: EXECUTION TX HASH', txHash);

  const traceFile = join(RESULTS_DIR, `fallback-run-${RUN_ID}.json`);
  writeFileSync(traceFile, JSON.stringify({ ...trace, finishedAt: new Date().toISOString(), terminal }, null, 2));
  console.log(`\nTRACE SAVED -> ${traceFile}`);

  const summaryFile = join(RESULTS_DIR, 'fallback-demo-summary.md');
  const summaryLines = [
    `## Run ${RUN_ID} (${new Date().toISOString()})`,
    '',
    `- Job id: ${jobId}`,
    `- Intent: ${MESSAGE}`,
    `- Path: no marketplace match -> generated fallback -> authorization gate -> resume -> ${terminal.status}`,
    `- Execution id: ${terminal.execution?.executionId ?? 'none'}`,
    `- Execution tx hash: ${txHash ?? 'none'}`,
    `- Verified: ${terminal.execution?.verified ?? false}`,
    `- Error: ${terminal.error ?? 'none'}`,
    `- Trace: ${traceFile}`,
    '',
  ];
  if (!existsSync(summaryFile)) writeFileSync(summaryFile, '# Fallback demo runs\n\n');
  appendFileSync(summaryFile, summaryLines.join('\n'));

  console.log(`SUMMARY APPENDED -> ${summaryFile}`);
  process.exit(terminal.status === 'completed' && terminal.execution?.verified ? 0 : 1);
}

main().catch((e) => {
  console.error('DRIVER FAILED:', e);
  const traceFile = join(RESULTS_DIR, `fallback-run-${RUN_ID}.json`);
  try {
    writeFileSync(traceFile, JSON.stringify({ ...trace, failedAt: new Date().toISOString(), error: String(e) }, null, 2));
  } catch {}
  process.exit(1);
});
export {};
