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
    const envelope = JSON.parse(raw) as { result?: { content?: Array<{ type: string; text?: string }> } };
    if (envelope.result && Array.isArray(envelope.result.content)) {
      const t = envelope.result.content.filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n");
      if (t.trim()) return t.trim();
    }
  } catch {}
  return raw.trim();
}
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-inspect-fallback", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  const wfId = process.argv[2] ?? "l322dq29uy1onf7u7b3a6";
  console.log(`=== get_workflow ${wfId} ===`);
  const g = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: wfId } });
  const text = innerText(g.raw);
  try {
    const parsed = JSON.parse(text);
    const wf = parsed.workflow ?? parsed.result ?? parsed;
    console.log(`name: ${wf.name ?? "?"}  enabled: ${wf.enabled ?? "?"}`);
    const nodes = wf.nodes ?? [];
    console.log(`nodes: ${nodes.length}`);
    for (const n of nodes) {
      console.log(`- id=${n.id} type=${n.type} enabled=${n.data?.enabled} label=${n.data?.label ?? ""}`);
      console.log(`  config=${JSON.stringify(n.data ?? {})}`);
    }
  } catch {
    console.log(text.slice(0, 4000));
  }
}
main().catch(console.error);
