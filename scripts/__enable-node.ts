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
const WID = "9ddjdvhrqouokxzmf42xn";
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-node-enable2", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  console.log("\n=== STEP 1: get_workflow ===");
  const g = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: WID } });
  const wf = JSON.parse(innerText(g.raw));
  const nodes = (wf.nodes ?? []) as Array<Record<string, unknown>>;
  const edges = (wf.edges ?? []) as Array<Record<string, unknown>>;
  let flipped = false;
  for (const n of nodes) {
    const d = (n.data ?? {}) as Record<string, unknown>;
    if (d.enabled === false) { d.enabled = true; flipped = true; }
  }
  console.log(`workflow.enabled: ${wf.enabled}, node(s) with enabled=false found and flipped: ${flipped}`);
  console.log(`nodes: ${nodes.length}, edges: ${edges.length}`);

  console.log("\n=== STEP 2: update_workflow (enabled=true + full nodes/edges with action node enabled) ===");
  const u = await rpc("tools/call", { name: "update_workflow", arguments: { workflowId: WID, enabled: true, name: wf.name, description: wf.description ?? "", nodes, edges } });
  console.log(`HTTP ${u.status}`);
  console.log(u.raw);

  console.log("\n=== STEP 3: re-inspect ===");
  const g2 = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: WID } });
  const wf2 = JSON.parse(innerText(g2.raw));
  console.log(`workflow.enabled: ${wf2.enabled}`);
  for (const n of wf2.nodes ?? []) {
    console.log(`node ${n.id} type=${n.type} nodeData.enabled=${n.data?.enabled} label=${n.data?.label ?? ""}`);
  }

  console.log("\n=== STEP 4: execute_workflow ===");
  const ex = await rpc("tools/call", { name: "execute_workflow", arguments: { workflowId: WID } });
  console.log(`HTTP ${ex.status}`);
  console.log(ex.raw);
  const exInner = parseJson(innerText(ex.raw));
  const executionId = findString(exInner, ["executionId", "id"]);
  if (!executionId) { console.log("\nABORT: no executionId returned."); return; }
  console.log(`\nexecutionId: ${executionId}`);

  console.log("\n=== STEP 5: waitForExecution (get_execution every 3s, max 40) ===");
  let terminal = false;
  for (let poll = 1; poll <= 40; poll += 1) {
    await sleep(3000);
    const s = await rpc("tools/call", { name: "get_execution", arguments: { executionId } });
    console.log(`--- poll ${poll} (HTTP ${s.status}) ---`);
    if (poll === 1 || poll % 10 === 0) console.log(innerText(s.raw).slice(0, 1500));
    if (s.status !== 200) continue;
    const inner = parseJson(innerText(s.raw));
    const st = String(inner?.status ?? "");
    const done = ["completed", "success", "succeeded"].includes(st);
    const failed = ["failed", "error", "cancelled"].includes(st);
    if (done || failed) { terminal = true; break; }
  }
  if (!terminal) { console.log("\nRESULT: not terminal within budget."); return; }

  console.log("\n=== STEP 6: final get_execution raw response ===");
  const finalRes = await rpc("tools/call", { name: "get_execution", arguments: { executionId } });
  console.log(`HTTP ${finalRes.status}`);
  console.log(finalRes.raw);
  const finalInner = parseJson(innerText(finalRes.raw));
  const hash = findString(finalInner, ["transactionHash", "txHash"]);
  console.log(`\ntransactionHash field in final raw response: ${hash === null ? "NULL/ABSENT" : hash}`);
  if (hash) console.log(`Explorer (Base mainnet): https://basescan.org/tx/${hash}`);
  else console.log("\nMEANING: terminal state without a transactionHash — write did NOT produce an on-chain tx. NOT proven.");
}
main().catch(console.error);
