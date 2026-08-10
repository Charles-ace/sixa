import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { BrokerMcpClient } from "../src/lib/broker/client";

const API_KEY = process.env.KEEPERHUB_API_KEY ?? "";
const URL = process.env.KEEPERHUB_MCP_ENDPOINT ?? "https://app.keeperhub.com/mcp";
let sessionId: string | null = null;
let rpcId = 1;
async function rpc(method: string, params?: Record<string, unknown>): Promise<{ status: number; raw: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${API_KEY}`, ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) };
  const body: Record<string, unknown> = { jsonrpc: "2.0", method };
  if (params !== undefined) body.params = params;
  if (method !== "notifications/initialized") { body.id = rpcId; rpcId += 1; }
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  const sid = res.headers.get("Mcp-Session-Id");
  if (sid) sessionId = sid;
  return { status: res.status, raw: await res.text() };
}
function innerText(raw: string): string {
  try {
    const env = JSON.parse(raw) as { result?: { content?: Array<{ type: string; text?: string }> } };
    if (env.result && Array.isArray(env.result.content)) {
      const t = env.result.content.filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n");
      if (t.trim()) return t.trim();
    }
  } catch {}
  return raw.trim();
}

const WORKFLOW_ID = "14jtbaylhv2o3rofwlhzj";
const INPUT = { address: "0x3c52D0AAB5BfE5A1A3FBB365A2b7B04C5B8d1A8c" };

async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-issue1-rerun", version: "1.0.0" } });
  if (init.status !== 200) throw new Error(`init HTTP ${init.status}`);
  await rpc("notifications/initialized", {});
  const client = new BrokerMcpClient({ apiKey: API_KEY, endpoint: URL });

  console.log("=== 1. get_workflow (node config — enabled flags, networks) ===");
  const wf = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: WORKFLOW_ID } });
  const wfText = innerText(wf.raw);
  const wfObj = JSON.parse(wfText);
  const wfData = wfObj.result ?? wfObj;
  console.log(`workflow ${WORKFLOW_ID}: enabled=${wfData.workflow?.enabled ?? wfData.enabled ?? "?"} name=${wfData.workflow?.name ?? wfData.name}`);
  const nodes = (wfData.workflow?.nodes ?? wfData.nodes ?? []) as Array<Record<string, unknown>>;
  for (const n of nodes) {
    const d = (n.data ?? {}) as Record<string, unknown>;
    console.log(`node ${n.id} type=${n.type} enabled=${d.enabled} dataType=${d.type} config=${JSON.stringify(d.config ?? null)}`);
  }

  console.log(`\n=== 2. execute_workflow on SAME workflow ${WORKFLOW_ID} ===`);
  const exec = await rpc("tools/call", { name: "execute_workflow", arguments: { workflowId: WORKFLOW_ID, input: INPUT } });
  console.log(`HTTP ${exec.status} raw: ${innerText(exec.raw).slice(0, 800)}`);
  const execObj = JSON.parse(innerText(exec.raw));
  const execId = execObj.result?.executionId ?? execObj.executionId;
  console.log(`executionId: ${execId}`);
  if (!execId) throw new Error("no execution id");

  console.log(`\n=== 3. poll with FIXED parser (client.getExecution), raw response each poll ===`);
  for (let i = 1; i <= 10; i += 1) {
    const rawCall = await rpc("tools/call", { name: "get_execution", arguments: { executionId: execId } });
    const rawText = innerText(rawCall.raw);
    const parsed = await client.getExecution(execId);
    const rawStatus = (() => {
      try { return JSON.parse(rawText).result?.status ?? JSON.parse(rawText).status ?? null; } catch { return null; }
    })();
    console.log(`poll#${i} raw status.status=${rawStatus?.status} nodeStatuses=${rawStatus?.nodeStatuses?.length} txHashes=${rawStatus?.transactionHashes?.length}`);
    console.log(`  parsed -> status=${parsed.status} completed=${parsed.completed} failed=${parsed.failed} txHashes=${JSON.stringify(parsed.transactionHashes)} error=${parsed.error ?? "null"}`);
    const rawObj = JSON.parse(rawText);
    const logsExec = rawObj.result?.logs?.execution ?? rawObj.logs?.execution;
    if (logsExec) console.log(`  raw logs.execution -> status=${logsExec.status} executionTrace=${JSON.stringify(logsExec.executionTrace)} completedAt=${logsExec.completedAt} duration=${logsExec.duration}ms txHashes=${JSON.stringify(logsExec.transactionHashes ?? [])}`);
    if (parsed.completed || parsed.failed) { console.log("  (terminal state reached — stopping poll)"); break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });