const BASE = "https://sixa-chi.vercel.app";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJob(message: string, payMode = "simulated"): Promise<{ id: string; status: string }> {
  const res = await fetch(`${BASE}/api/broker/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, budgetUsdc: 0.05, payMode }),
  });
  const body = (await res.json()) as { job?: { id: string; status: string }; error?: string };
  console.log(`POST /api/broker/jobs -> HTTP ${res.status}${body.error ? ` error=${body.error}` : ""}`);
  if (!body.job) throw new Error("no job created");
  console.log(`created job id=${body.job.id} status=${body.job.status}`);
  return body.job;
}

async function pollJob(id: string, label: string): Promise<Record<string, unknown>> {
  console.log(`\n--- polling ${label} (${id}) ---`);
  let job: Record<string, unknown> | null = null;
  for (let i = 1; i <= 60; i += 1) {
    await sleep(2000);
    const res = await fetch(`${BASE}/api/broker/jobs/${id}`);
    const body = (await res.json()) as { job?: Record<string, unknown>; error?: string };
    if (res.status === 404) { console.log(`poll ${i} -> HTTP 404 ${body.error ?? ""}`); break; }
    job = body.job ?? null;
    if (!job) continue;
    const s = String(job.status);
    const a = Array.isArray(job.audit) ? (job.audit as unknown[]).length : 0;
    const exec = (job.execution as { executionId?: string | null } | null)?.executionId ?? null;
    const err = String(job.error ?? "");
    console.log(`poll ${i} -> status=${s} audit=${a} exec=${exec}${err ? ` error=${err}` : ""}`);
    if (s === "completed" || s === "failed") break;
  }
  if (!job) throw new Error(`${label}: job not found`);
  return job;
}

async function dumpAudit(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/broker/jobs/${id}/audit`);
  const body = (await res.json()) as { audit?: Array<{ type: string; timestamp: string; message: string; data?: unknown }>; error?: string };
  console.log(`GET /api/broker/jobs/${id}/audit -> HTTP ${res.status}`);
  for (const e of body.audit ?? []) {
    console.log(`  [${e.type}] ${e.timestamp} :: ${e.message}${e.data && Object.keys(e.data as object).length ? ` ${JSON.stringify(e.data).slice(0, 220)}` : ""}`);
  }
}

async function main() {
  console.log("================================================================");
  console.log("SIXA E2E DEMO — Job 1 primary path, Job 2 fallback path");
  console.log(`target: ${BASE}`);
  console.log("================================================================");

  const j1 = await postJob("Verify the anchor commitment on Base for the demo run");
  const job1 = await pollJob(j1.id, "Job 1 (primary/marketplace)");
  console.log("\n--- Job 1 full raw job record (key fields) ---");
  console.log(JSON.stringify({
    id: job1.id,
    status: job1.status,
    decision: (job1.decision as { source?: string; workflow_id?: string | null }) ?? null,
    selected: (job1.selected as { slug?: string; name?: string; priceUsdcPerCall?: number } | null) ?? null,
    payment: job1.payment ? { mode: (job1.payment as { mode?: string }).mode, status: (job1.payment as { status?: string }).status } : null,
    execution: (job1.execution as { status?: string; verified?: boolean; completed?: boolean; executionTxHash?: string | null; error?: string | null } | null) ?? null,
    proof: job1.proof ?? null,
    report: job1.report,
    error: job1.error ?? null,
  }, null, 2));
  console.log("\n--- Job 1 full audit log ---");
  await dumpAudit(j1.id);

  const j2 = await postJob("Get an Aave liquidation snapshot for 0x3c52D0AAB5BfE5A1A3FBB365A2b7B04C5B8d1A8c on Base, budget $0.05");
  const job2 = await pollJob(j2.id, "Job 2 (fallback/generation)");
  console.log("\n--- Job 2 full raw job record (key fields) ---");
  console.log(JSON.stringify({
    id: job2.id,
    status: job2.status,
    decision: (job2.decision as { source?: string; workflow_id?: string | null }) ?? null,
    selected: (job2.selected as { slug?: string; name?: string; priceUsdcPerCall?: number } | null) ?? null,
    payment: job2.payment ? { mode: (job2.payment as { mode?: string }).mode } : null,
    execution: (job2.execution as { status?: string; verified?: boolean; completed?: boolean; executionId?: string | null; executionTxHash?: string | null; error?: string | null } | null) ?? null,
    proof: job2.proof ?? null,
    report: job2.report,
    error: job2.error ?? null,
  }, null, 2));
  console.log("\n--- Job 2 full audit log ---");
  await dumpAudit(j2.id);

  console.log("\n================================================================");
  console.log("HONEST STATUS TABLE");
  console.log("================================================================");
  const rows = [job1, job2];
  console.log("job_id | path | status | payment | execution_verified | execution_completed | tx_hash | audit_events | error");
  for (const job of rows) {
    const decision = (job.decision as { source?: string }) ?? {};
    const execution = (job.execution as { verified?: boolean; completed?: boolean; executionTxHash?: string | null; status?: string } | null) ?? null;
    const payment = job.payment ? String((job.payment as { mode?: string }).mode ?? "?") : "none";
    const tx = execution?.executionTxHash ?? (job.payment && (job.payment as { txHash?: string | null }).txHash) ?? null;
    const audits = Array.isArray(job.audit) ? job.audit.length : 0;
    console.log([
      String(job.id), String(decision.source ?? "none"), String(job.status),
      payment, String(execution?.verified ?? false), String(execution?.completed ?? false),
      String(tx ?? "null"), String(audits), String(job.error ?? "-"),
    ].join(" | "));
  }
  console.log("================================================================");
}

main().catch((e) => { console.error(e); process.exit(1); });