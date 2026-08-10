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
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-inspect", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  await rpc("notifications/initialized", {});
  const tools = await rpc("tools/list", {});
  console.log(`tools/list HTTP ${tools.status}`);
  try {
    const parsed = JSON.parse(tools.raw);
    const list = parsed.result?.tools ?? [];
    for (const t of list) {
      console.log(`\n=== ${t.name} ===`);
      if (t.description) console.log(t.description.slice(0, 300));
      if (t.inputSchema) console.log("inputSchema:", JSON.stringify(t.inputSchema).slice(0, 1500));
    }
  } catch (e) { console.log(tools.raw); }
  for (const q of ["transfer", "send eth", "sepolia write", "deposit"]) {
    const r = await rpc("tools/call", { name: "search_templates", arguments: { query: q, limit: 5 } });
    console.log(`\n=== search_templates "${q}" HTTP ${r.status} ===`);
    console.log(r.raw);
  }
}
main().catch(console.error);
