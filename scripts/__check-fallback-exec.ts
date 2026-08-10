import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
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
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-check-fallback", version: "1.0.0" } });
  if (init.status !== 200) throw new Error(`init HTTP ${init.status}`);
  await rpc("notifications/initialized", {});

  const execId = "v46z1ork1e1rosg9szpe4";
  console.log(`=== get_execution ${execId} — fallback workflow zke3blhm0e4mdnd3ys1if ===`);
  const r = await rpc("tools/call", { name: "get_execution", arguments: { executionId: execId } });
  console.log(`HTTP ${r.status}`);
  const text = innerText(r.raw);
  console.log(text.slice(0, 4500));
}
main().catch(console.error);