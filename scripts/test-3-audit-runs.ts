import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}

const BASE_URL = "https://sixa-chi.vercel.app";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AuditEventPayload {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface JobPayload {
  id: string;
  status: string;
  updatedAt: string;
  audit?: AuditEventPayload[];
  execution?: { verified?: boolean } | null;
  decision?: { workflow_id?: string | null } | null;
}

// Client-faithful merge: keep the newest version by updatedAt. This mirrors
// how the browser holds the authoritative job while polling (BrokerJobView
// never regresses to a stale snapshot from another serverless instance).
function merge(held: JobPayload | null, got: JobPayload | null): JobPayload | null {
  if (!got) return held;
  if (!held) return got;
  if (new Date(got.updatedAt) > new Date(held.updatedAt)) return got;
  if (new Date(got.updatedAt).getTime() === new Date(held.updatedAt).getTime() && (got.audit?.length ?? 0) > (held.audit?.length ?? 0)) return got;
  return held;
}

async function fetchJob(id: string): Promise<JobPayload | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/broker/jobs/${id}`);
    if (res.status !== 200) return null;
    const data = (await res.json()) as { job?: JobPayload };
    return data.job ?? null;
  } catch {
    return null;
  }
}

async function runTestPass(runIndex: number): Promise<boolean> {
  console.log(`\n=======================================================`);
  console.log(`▶️ RUN #${runIndex}: Job Creation → Pause Gate → Authorization → Audit Trail`);
  console.log(`=======================================================`);

  // 1. Create Job
  const prompt = `Aave liquidation risk snapshot for wallet test-${runIndex} on Base`;
  const createRes = await fetch(`${BASE_URL}/api/broker/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, payMode: "demo" }),
  });
  if (createRes.status !== 201) {
    console.error(`❌ Job creation failed with status ${createRes.status}`);
    return false;
  }
  let job: JobPayload | null = ((await createRes.json()) as { job: JobPayload }).job;
  console.log(`✅ Created: ID=${job.id} status=${job.status}`);

  // 2. Poll until the background discovery pauses at the authorization gate
  for (let poll = 0; poll < 20 && job?.status !== "awaiting_payment"; poll += 1) {
    await sleep(1500);
    job = merge(job, await fetchJob(job!.id));
  }
  if (job?.status !== "awaiting_payment") {
    console.error(`❌ Job failed to reach awaiting_payment: status=${job?.status}`);
    return false;
  }
  console.log(`✅ Paused at authorization gate; audit events so far: ${(job.audit ?? []).length}`);

  // 3. Authorize & Resume Fallback (sending the client-held job, like the UI)
  const resumeRes = await fetch(`${BASE_URL}/api/broker/jobs/${job.id}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job }),
  });
  if (resumeRes.status !== 200) {
    console.error(`❌ Resume failed with status ${resumeRes.status}:`, await resumeRes.json().catch(() => ({})));
    return false;
  }
  const resumeBody = (await resumeRes.json()) as { job?: JobPayload };
  if (resumeBody.job) job = merge(job, resumeBody.job);
  console.log(`✅ Resume HTTP 200 (held status now: ${job?.status})`);

  // 4. Poll for the terminal state, merging only strictly newer snapshots
  for (let i = 0; i < 100; i += 1) {
    await sleep(2500);
    const got = await fetchJob(job!.id);
    if (got) job = merge(job, got);
    if (job?.status === "completed" || job?.status === "failed") break;
  }

  // 5. Audit trail assertions
  const audit: AuditEventPayload[] = Array.isArray(job?.audit) ? job.audit : [];
  const types = audit.map((e) => e.type);
  const required = ["job_created", "intent_parsed", "catalog_searched", "fallback_generation", "user_authorized"];
  const missing = required.filter((t) => !types.includes(t));
  const monotonic = audit.every((e, i) => i === 0 || new Date(e.timestamp) >= new Date(audit[i - 1].timestamp));

  console.log(`\n📊 RUN #${runIndex} — AUDIT TRAIL (${audit.length} events):`);
  for (const e of audit) {
    console.log(`   ${new Date(e.timestamp).toISOString().slice(11, 19)}  ${e.type.padEnd(22)} ${e.message.slice(0, 84)}`);
  }
  console.log(`   → final status=${job?.status} verified=${job?.execution?.verified} workflow=${job?.decision?.workflow_id ?? "none"}`);

  const terminalOk = job?.status === "completed";
  const passed = terminalOk && missing.length === 0 && monotonic && audit.length >= 8;
  if (passed) {
    console.log(`✅ RUN #${runIndex} PASSED — completed with ${audit.length} clean audit events`);
  } else {
    console.error(`❌ RUN #${runIndex} FAILED — status=${job?.status}, missing types=[${missing}], monotonic=${monotonic}, auditCount=${audit.length}`);
  }
  return passed;
}

async function main() {
  console.log("Starting 3 Consecutive End-to-End Production Tests with Audit Trail Verification...");
  let passCount = 0;
  for (let r = 1; r <= 3; r += 1) {
    if (await runTestPass(r)) passCount += 1;
    await sleep(2000);
  }
  console.log(`\n=======================================================`);
  console.log(`🎯 FINAL SUITE SUMMARY: ${passCount} / 3 RUNS PASSED`);
  console.log(`=======================================================`);
  process.exit(passCount === 3 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});