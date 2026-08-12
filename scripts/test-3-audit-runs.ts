import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}

const BASE_URL = "https://sixa-chi.vercel.app";

async function runTestPass(runIndex: number): Promise<boolean> {
  console.log(`\n=======================================================`);
  console.log(`▶️ RUN #${runIndex}: Testing Job Creation, Pause Gate & Audit Trail Verification`);
  console.log(`=======================================================`);

  // 1. Create Job
  const prompt = `Aave liquidation risk snapshot for wallet test-${runIndex} on Base`;
  console.log(`1. Posting job creation: "${prompt}"...`);
  const createRes = await fetch(`${BASE_URL}/api/broker/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, payMode: "demo" }),
  });

  if (createRes.status !== 201) {
    console.error(`❌ Job creation failed with status ${createRes.status}`);
    return false;
  }

  const createData = await createRes.json();
  let job = createData.job;
  console.log(`✅ Job initial creation: ID=${job.id}, Status=${job.status}`);

  // Poll until the serverless background task reaches 'awaiting_payment' (pause gate)
  console.log(`Waiting for background discovery to pause at awaiting_payment...`);
  for (let poll = 0; poll < 10; poll += 1) {
    if (job?.status === "awaiting_payment") break;
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${BASE_URL}/api/broker/jobs/${job.id}`);
    if (res.status === 200) {
      const data = await res.json();
      job = data.job;
    }
  }

  if (job?.status !== "awaiting_payment") {
    console.error(`❌ Job failed to reach awaiting_payment state: status=${job?.status}`);
    return false;
  }
  console.log(`✅ Job correctly paused at authorization gate: Status=${job.status}`);

  // 2. Authorize & Resume Fallback
  console.log(`2. Resuming/Authorizing fallback workflow for job ${job.id}...`);
  const resumeRes = await fetch(`${BASE_URL}/api/broker/jobs/${job.id}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job }),
  });

  if (resumeRes.status !== 200) {
    const errBody = await resumeRes.json().catch(() => ({}));
    console.error(`❌ Resume endpoint failed with status ${resumeRes.status}:`, errBody);
    return false;
  }
  console.log(`✅ Resume HTTP status: 200 OK`);

  // 3. Poll for Completion (up to 20s)
  console.log(`3. Polling for job completion and audit events...`);
  let finalJob: any = null;
  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const getRes = await fetch(`${BASE_URL}/api/broker/jobs/${job.id}`);
    if (getRes.status === 200) {
      const data = await getRes.json();
      finalJob = data.job;
      if (finalJob?.status === "completed" || finalJob?.status === "failed") {
        break;
      }
    }
  }

  if (!finalJob) {
    console.error(`❌ Failed to fetch final job state.`);
    return false;
  }

  console.log(`\n📊 RUN #${runIndex} RESULTS:`);
  console.log(`• Final Job Status: ${finalJob.status}`);
  console.log(`• Execution Verified: ${finalJob.execution?.verified}`);
  console.log(`• Execution Tx Hash: ${finalJob.proof?.execution_tx_hash}`);
  console.log(`• KeeperHub Workflow ID: ${finalJob.decision?.workflow_id}`);
  
  // 4. Verify Audit Trail Endpoint & Event Count
  console.log(`4. Fetching audit trail via /api/broker/jobs/${job.id}/audit...`);
  const auditRes = await fetch(`${BASE_URL}/api/broker/jobs/${job.id}/audit`);
  const auditData = await auditRes.json();
  const auditEvents = Array.isArray(auditData.audit) ? auditData.audit : (finalJob.audit || []);

  console.log(`• Audit Event Count: ${auditEvents.length} events`);
  if (auditEvents.length > 0) {
    console.log(`• Audit Event Types:`, auditEvents.map((e: any) => e.type));
  }

  if (finalJob.status === "completed" && auditEvents.length >= 5) {
    console.log(`✅ RUN #${runIndex} PASSED 100% CLEANLY WITH ${auditEvents.length} AUDIT EVENTS!`);
    return true;
  } else {
    console.error(`❌ RUN #${runIndex} FAILED: status=${finalJob.status}, auditCount=${auditEvents.length}`);
    return false;
  }
}

async function main() {
  console.log("Starting 3 Consecutive End-to-End Production Tests with Audit Verification...");
  let passCount = 0;

  for (let r = 1; r <= 3; r += 1) {
    const passed = await runTestPass(r);
    if (passed) passCount += 1;
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n=======================================================`);
  console.log(`🎯 FINAL SUITE SUMMARY: ${passCount} / 3 RUNS PASSED`);
  console.log(`=======================================================`);

  if (passCount === 3) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
