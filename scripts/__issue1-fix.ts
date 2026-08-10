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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WID = "14jtbaylhv2o3rofwlhzj";
const ORG_WALLET = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";

async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-issue1-fix", version: "1.0.0" } });
  if (init.status !== 200) throw new Error(`init HTTP ${init.status}`);
  await rpc("notifications/initialized", {});
  const client = new BrokerMcpClient({ apiKey: API_KEY, endpoint: URL });

  console.log("=== STEP 1: get_workflow (current state) ===");
  const g = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: WID } });
  const wf = JSON.parse(innerText(g.raw));
  const nodes = (wf.nodes ?? []) as Array<Record<string, unknown>>;
  const edges = (wf.edges ?? []) as Array<Record<string, unknown>>;
  console.log(`workflow.enabled=${wf.enabled} nodes=${nodes.length} edges=${edges.length}`);

  console.log("\n=== STEP 2: fix directly — enable workflow + action node, re-point action to funded testnet transfer ===");
  for (const n of nodes) {
    const d = (n.data ?? {}) as Record<string, unknown>;
    d.enabled = true;
    if ((n.type as string) === "action") {
      d.config = {
        amount: "0.0001",
        network: "84532",
        actionType: "web3/transfer-funds",
        recipientAddress: ORG_WALLET,
        gasLimitMultiplier: "1.5",
      };
      console.log(`action node ${n.id} re-configured -> ${JSON.stringify(d.config)}`);
    } else {
      console.log(`node ${n.id} type=${n.type} enabled=true`);
    }
  }
  const u = await rpc("tools/call", { name: "update_workflow", arguments: { workflowId: WID, enabled: true, name: wf.name, description: wf.description ?? "", nodes, edges } });
  console.log(`update_workflow HTTP ${u.status} -> ${innerText(u.raw).slice(0, 400)}`);

  console.log("\n=== STEP 3: re-inspect ===");
  const g2 = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: WID } });
  const wf2 = JSON.parse(innerText(g2.raw));
  console.log(`workflow.enabled: ${wf2.enabled}`);
  for (const n of wf2.nodes ?? []) {
    const d = (n.data ?? {}) as Record<string, unknown>;
    console.log(`node ${n.id} type=${n.type} enabled=${d.enabled} config=${JSON.stringify(d.config ?? null).slice(0, 160)}`);
  }

  console.log("\n=== STEP 4: execute_workflow (same workflow, same input) ===");
  const ex = await rpc("tools/call", { name: "execute_workflow", arguments: { workflowId: WID, input: { address: "0x3c52D0AAB5BfE5A1A3FBB365A2b7B04C5B8d1A8c" } } });
  console.log(`HTTP ${ex.status} -> ${innerText(ex.raw).slice(0, 400)}`);
  const execId = (JSON.parse(innerText(ex.raw)) as { executionId?: string }).executionId ?? "";
  if (!execId) throw new Error("no execution id");

  console.log(`\n=== STEP 5: poll with FIXED parser — raw response each poll ===`);
  for (let i = 1; i <= 20; i += 1) {
    const rawCall = await rpc("tools/call", { name: "get_execution", arguments: { executionId: execId } });
    const rawText = innerText(rawCall.raw);
    const rawObj = JSON.parse(rawText);
    const st = rawObj.result?.status ?? rawObj.status ?? null;
    const logsExec = rawObj.result?.logs?.execution ?? rawObj.logs?.execution ?? null;
    console.log(`poll#${i} raw: status.status=${st?.status} nodeStatuses=${st?.nodeStatuses?.length} txHashes=${st?.transactionHashes?.length}`);
    if (logsExec) console.log(`  raw logs.execution: status=${logsExec.status} trace=${JSON.stringify(logsExec.executionTrace)} completedAt=${logsExec.completedAt} txHashes=${JSON.stringify(logsExec.transactionHashes ?? [])}`);
    const parsed = await client.getExecution(execId);
    console.log(`  parsed: status=${parsed.status} completed=${parsed.completed} failed=${parsed.failed} txHashes=${JSON.stringify(parsed.transactionHashes)} error=${parsed.error ?? "null"}`);
    if (parsed.completed || parsed.failed) break;
    await sleep(2000);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });