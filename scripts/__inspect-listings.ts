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
async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-listing-inspect", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  const slugs = [
    "test-sepolia-weth-deposit-issue2",
    "quorum-aegis-settle-v1",
    "quorum-aegis-settle-v2",
    "quorum-aegis-settle-v3",
  ];
  for (const slug of slugs) {
    console.log(`\n=== get_workflow_listing slug="${slug}" ===`);
    const r = await rpc("tools/call", { name: "get_workflow_listing", arguments: { slug } });
    console.log(`HTTP ${r.status}`);
    const text = innerText(r.raw);
    try {
      const l = JSON.parse(text);
      console.log(`name: ${l.name}`);
      console.log(`workflowType: ${l.workflowType}`);
      console.log(`isListed: ${l.isListed} | listedSlug: ${l.listedSlug}`);
      console.log(`priceUsdcPerCall: ${l.priceUsdcPerCall}`);
      console.log(`organizationId: ${l.organizationId}`);
      console.log(`chain: ${l.chain} | category: ${l.category} | callCount: ${l.callCount}`);
      console.log(`deactivatedAt: ${l.deactivatedAt ?? "null"} | deletedAt: ${l.deletedAt ?? "null"}`);
      console.log(`description: ${String(l.description ?? "").slice(0, 300)}`);
      const nodes = l.nodes ?? [];
      console.log(`nodes (${nodes.length}):`);
      for (const n of nodes) {
        const d = n.data ?? {};
        const cfg = d.config ?? {};
        console.log(`  - node ${n.id} type=${n.type} nodeEnabled=${d.enabled ?? "undefined"} label=${d.label ?? ""} actionType=${cfg.actionType ?? cfg.triggerType ?? ""} network=${cfg.network ?? "-"} fn=${cfg.abiFunction ?? ""} contract=${cfg.contractAddress ?? ""}`);
      }
      if (!nodes.length) console.log(`  RAW: ${text.slice(0, 1200)}`);
    } catch {
      console.log(text.slice(0, 1500));
    }
  }
}
main().catch(console.error);
