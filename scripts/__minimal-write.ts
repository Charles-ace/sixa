import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const API_KEY = process.env.KEEPERHUB_API_KEY ?? "";
const URL = process.env.KEEPERHUB_MCP_ENDPOINT ?? "https://app.keeperhub.com/mcp";
let sessionId: string | null = null;
let rpcId = 1;
async function rpc(method: string, params?: Record<string, unknown>) {
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
    const envelope = JSON.parse(raw) as { result?: { content?: Array<{ type: string; text?: string }> } };
    if (envelope.result && Array.isArray(envelope.result.content)) {
      const t = envelope.result.content.filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n");
      if (t.trim()) return t.trim();
    }
  } catch {}
  return raw.trim();
}
function parseJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text.trim());
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
  } catch { return null; }
}
function findString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  for (const k of keys) { const v = r[k]; if (typeof v === "string" && v.length > 0) return v; }
  return null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-minimal-write", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  const wallet = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
  const nodes = [
    { id: "trig-1", type: "trigger", position: { x: 0, y: 0 }, data: { type: "trigger", config: { triggerType: "Manual" } } },
    { id: "act-1", type: "action", position: { x: 272, y: 0 }, data: {
      type: "action",
      config: {
        actionType: "web3/transfer-funds",
        network: "84532",
        amount: "0.0001",
        recipientAddress: wallet,
        gasLimitMultiplier: "1.5",
      },
    } },
  ];
  const edges = [{ id: "edge-1", source: "trig-1", target: "act-1" }];

  console.log("\n=== STEP 1: create_workflow (enabled=true, no Code-action nodes) ===");
  const create = await rpc("tools/call", {
    name: "create_workflow",
    arguments: {
      name: "Sixa Minimal Write Proof (Base Sepolia)",
      description: "Minimal on-chain write for verification: web3/transfer-funds on Base Sepolia (84532). No Code-action nodes.",
      nodes, edges, enabled: true,
    },
  });
  console.log(`HTTP ${create.status}`);
  console.log(create.raw);

  const createInner = parseJson(innerText(create.raw));
  const workflowId = findString(createInner, ["workflowId", "id"]);
  if (!workflowId) { console.log("\nABORT: no workflowId returned."); return; }
  console.log(`\nworkflowId: ${workflowId}`);

  console.log("\n=== STEP 2: get_workflow — explicit enabled check ===");
  const get = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId } });
  console.log(`HTTP ${get.status}`);
  console.log(get.raw);
  const getInner = parseJson(innerText(get.raw));
  const enabled = getInner?.enabled;
  console.log(`\nenabled field as returned: ${String(enabled)}`);
  if (enabled !== true) {
    console.log("\nWorkflow is NOT enabled. Attempting update_workflow(enabled=true)...");
    const upd = await rpc("tools/call", { name: "update_workflow", arguments: { workflowId, enabled: true } });
    console.log(`HTTP ${upd.status}`);
    console.log(upd.raw);
    const get2 = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId } });
    console.log("--- get_workflow after update ---");
    console.log(get2.raw);
  }

  console.log("\n=== STEP 3: execute_workflow (org write path) ===");
  const exec = await rpc("tools/call", { name: "execute_workflow", arguments: { workflowId } });
  console.log(`HTTP ${exec.status}`);
  console.log(exec.raw);
  const execInner = parseJson(innerText(exec.raw));
  const executionId = findString(execInner, ["executionId", "id"]);
  if (!executionId) { console.log("\nABORT: no executionId returned."); return; }
  console.log(`\nexecutionId: ${executionId}`);

  console.log("\n=== STEP 4: waitForExecution (get_execution every 3s, max 40) ===");
  let terminal = false;
  for (let poll = 1; poll <= 40; poll += 1) {
    await sleep(3000);
    const s = await rpc("tools/call", { name: "get_execution", arguments: { executionId } });
    console.log(`--- poll ${poll} (HTTP ${s.status}) ---`);
    console.log(s.raw);
    if (s.status !== 200) continue;
    const inner = parseJson(innerText(s.raw));
    const st = String(inner?.status ?? "");
    const done = ["completed", "success", "succeeded"].includes(st);
    const failed = ["failed", "error", "cancelled"].includes(st);
    if (done || failed) { terminal = true; break; }
  }
  if (!terminal) { console.log("\nRESULT: not terminal within budget. No transactionHash reported."); return; }

  console.log("\n=== STEP 5: final get_execution raw response ===");
  const finalRes = await rpc("tools/call", { name: "get_execution", arguments: { executionId } });
  console.log(`HTTP ${finalRes.status}`);
  console.log(finalRes.raw);
  const finalInner = parseJson(innerText(finalRes.raw));
  const hash = findString(finalInner, ["transactionHash", "txHash"]);
  console.log(`\ntransactionHash field in final raw response: ${hash === null ? "NULL/ABSENT" : hash}`);
  if (hash) console.log(`Explorer (Base Sepolia): https://sepolia.basescan.org/tx/${hash}`);
  else console.log("\nMEANING: terminal state without a transactionHash — write did NOT produce an on-chain tx. NOT proven.");
}
main().catch(console.error);
