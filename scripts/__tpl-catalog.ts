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
function parseList(text: string): Array<{ id: string; name: string }> {
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : Array.isArray(data?.templates) ? data.templates : [];
    return arr.map((t: Record<string, unknown>) => ({ id: String(t.id ?? ""), name: String(t.name ?? "?") })).filter((t: Record<string, unknown>) => t.id);
  } catch {
    return [];
  }
}
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-tpl-catalog", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  const queries = ["base sepolia", "testnet", "aave", "transfer usdc", "swap", "send eth", "health check", "sepolia", "demo", "write contract", "anchor"];
  const seen = new Map<string, string>();
  for (const q of queries) {
    const r = await rpc("tools/call", { name: "search_templates", arguments: { query: q, limit: 20 } });
    const list = parseList(innerText(r.raw));
    console.log(`search "${q}" (HTTP ${r.status}) -> ${list.length} templates`);
    for (const t of list) if (!seen.has(t.id)) seen.set(t.id, t.name);
  }
  console.log(`\nTOTAL UNIQUE TEMPLATES: ${seen.size}`);
  let i = 0;
  for (const [id, name] of seen) {
    i += 1;
    const dep = await rpc("tools/call", { name: "deploy_template", arguments: { templateId: id } });
    const depText = innerText(dep.raw);
    let wfId = "";
    try {
      const p = JSON.parse(depText);
      wfId = String(p?.id ?? p?.workflowId ?? "");
    } catch {}
    let networks = "?";
    if (wfId) {
      const g = await rpc("tools/call", { name: "get_workflow", arguments: { workflowId: wfId } });
      const gText = innerText(g.raw);
      try {
        const gp = JSON.parse(gText);
        const wf = gp?.workflow ?? gp?.result ?? gp;
        const nets = (wf?.nodes ?? []).map((n: any) => n?.data?.config?.network).filter(Boolean);
        networks = [...new Set(nets)].join(",") || "none";
      } catch {}
    }
    console.log(`[${i}] ${id} | ${name} | networks=${networks} | workflowId=${wfId || "?"}`);
  }
}
main().catch(console.error);
