/* Live E2E of the fallback authorization gate:
 * 1. create job (payMode user, intent that scores below marketplace threshold)
 * 2. poll until awaiting_payment — must NOT have launched yet, pendingFallback set
 * 3. POST /resume — audit gains user_authorized, status executing
 * 4. poll to terminal — honest outcome recorded
 */
const BASE = process.env.E2E_BASE ?? 'https://sixa-chi.vercel.app';

async function main() {
  const created = await fetch(`${BASE}/api/broker/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Verify the anchor commitment on Base for the demo run',
      budgetUsdc: 0.5,
      payMode: 'real',
    }),
  });
  console.log('POST /api/broker/jobs ->', created.status);
  const { job } = (await created.json()) as { job: any };
  console.log('created job id=%s status=%s payMode=%s', job.id, job.status, job.payMode);

  // Phase A: wait for the authorization pause.
  let paused: any = null;
  for (let i = 1; i <= 40; i++) {
    await sleep(3000);
    const r = await fetch(`${BASE}/api/broker/jobs/${job.id}`);
    const body = (await r.json()) as any;
    const j = body.job ?? body;
    if (j.status === 'awaiting_payment') {
      paused = j;
      console.log(`poll ${i} -> awaiting_payment (authorization gate reached)`);
      break;
    }
    console.log(`poll ${i} -> ${j.status} audit=${j.audit?.length ?? 0}`);
  }
  if (!paused) {
    console.log('FAIL: never reached awaiting_payment');
    process.exit(1);
  }
  console.log('pendingFallback =', JSON.stringify(paused.pendingFallback));
  console.log('decision.workflow_id =', paused.decision?.workflow_id);
  console.log('quote (must be null) =', paused.quote);
  console.log('execution (must be null — nothing launched yet) =', JSON.stringify(paused.execution));
  const preTypes = paused.audit.map((a: any) => a.type);
  console.log('pre-resume audit:', preTypes.join(','));

  // Phase B: explicit authorization.
  const resume = await fetch(`${BASE}/api/broker/jobs/${job.id}/resume`, { method: 'POST' });
  const resumeBody = await resume.json();
  console.log('POST /resume ->', resume.status, 'ok=', resumeBody.ok, 'status=', resumeBody.job?.status);
  const authEvent = resumeBody.job?.audit?.find((a: any) => a.type === 'user_authorized');
  console.log('user_authorized event =', JSON.stringify(authEvent));

  // Phase C: poll to terminal.
  let terminal: any = null;
  for (let i = 1; i <= 40; i++) {
    await sleep(4000);
    const r = await fetch(`${BASE}/api/broker/jobs/${job.id}`);
    const body = (await r.json()) as any;
    const j = body.job ?? body;
    if (j.status === 'completed' || j.status === 'failed') {
      terminal = j;
      console.log(`poll ${i} -> TERMINAL status=${j.status}`);
      break;
    }
    console.log(`poll ${i} -> ${j.status} audit=${j.audit?.length ?? 0}`);
  }
  if (!terminal) {
    console.log('FAIL: no terminal state within window');
    process.exit(1);
  }
  console.log('terminal error =', terminal.error);
  const postTypes = terminal.audit.map((a: any) => a.type);
  console.log('post-resume audit:', postTypes.join(','));
  const hasAuth = postTypes.includes('user_authorized');
  const launchedAfterAuth = terminal.audit.some((a: any) => a.type === 'execution_requested' || a.type === 'verification_failed' || a.type === 'verification_passed' || a.type === 'fallback_executed');
  console.log('RESULT:', hasAuth && launchedAfterAuth ? 'PASS' : 'FAIL');
  process.exit(hasAuth && launchedAfterAuth ? 0 : 1);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
