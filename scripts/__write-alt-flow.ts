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
  } catch {
    const start = text.indexOf("{");
    if (start === -1) return null;
    try { return JSON.parse(text.slice(start)) as Record<string, unknown>; } catch { return null; }
  }
}
function findString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  for (const k of keys) { const v = r[k]; if (typeof v === "string" && v.length > 0) return v; }
  return null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function trySlug(slug: string, inputs: Record<string, unknown>) {
  console.log(`\n========== callWorkflow (slug="${slug}") ==========`);
  const call = await rpc("tools/call", { name: "call_workflow", arguments: { slug, inputs } });
  console.log(`HTTP ${call.status}`);
  console.log(call.raw);
  const inner = parseJson(innerText(call.raw));
  if (inner && "x402Version" in inner) return { executionId: null, status: "x402_quote" };
  if (call.status === 402) return { executionId: null, status: "402_payment_required" };
  return { executionId: findString(inner, ["executionId", "id"]), status: "ok" };
}
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-write-verify", version: "1.0.0" } });
  if (init.status !== 200) { console.log(init.raw); return; }
  await rpc("notifications/initialized", {});

  let executionId: string | null = null;
  const attempts = [
    { slug: "keepersense-demo-transfer", inputs: {} },
    { slug: "tempo-swap-pathusd-to-alphausd", inputs: {} },
  ];
  for (const a of attempts) {
    const res = await trySlug(a.slug, a.inputs);
    if (res.executionId) { executionId = res.executionId; break; }
    console.log(`(no executionId — ${res.status})`);
  }

  if (!executionId) {
    console.log("\nRESULT: no available workflow yielded an executionId. Nothing to poll. No transactionHash.");
    return;
  }

  console.log(`\n========== waitForExecution (get_execution every 3s, max 40) ==========`);
  let terminal = false;
  for (let poll = 1; poll <= 40; poll += 1) {
    await sleep(3000);
    const s = await rpc("tools/call", { name: "get_execution", arguments: { executionId } });
    console.log(`--- poll ${poll} (HTTP ${s.status}) ---`);
    console.log(s.raw);
    if (s.status !== 200) continue;
    const inner = parseJson(innerText(s.raw));
    const done = inner?.completed === true || ["completed", "success"].includes(String(inner?.status));
    const failed = inner?.failed === true || ["failed", "error"].includes(String(inner?.status));
    if (done || failed) { terminal = true; break; }
  }
  if (!terminal) { console.log("\nRESULT: not terminal within budget."); return; }

  console.log("\n========== STEP 3: final get_execution raw response ==========");
  const finalRes = await rpc("tools/call", { name: "get_execution", arguments: { executionId } });
  console.log(`HTTP ${finalRes.status}`);
  console.log(finalRes.raw);
  const finalInner = parseJson(innerText(finalRes.raw));
  const hash = findString(finalInner, ["transactionHash", "txHash"]);
  console.log(`\ntransactionHash field in final raw response: ${hash === null ? "NULL/ABSENT" : hash}`);
  if (hash) console.log(`Explorer: https://sepolia.etherscan.io/tx/${hash}`);
  else console.log("\nMEANING: terminal without transactionHash — read-only or no on-chain tx. NOT proven.");
}
main().catch(console.error);
