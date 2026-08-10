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
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-call-listing", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  for (const [slug, inputs] of [
    ["quorum-aegis-settle-v2", { jobId: "sixa-demo-nonexistent-job" }],
    ["test-sepolia-weth-deposit-issue2", {}],
  ] as const) {
    console.log(`\n=== call_workflow slug="${slug}" inputs=${JSON.stringify(inputs)} ===`);
    const r = await rpc("tools/call", { name: "call_workflow", arguments: { slug, inputs } });
    console.log(`HTTP ${r.status}`);
    const text = innerText(r.raw);
    console.log(text.slice(0, 2000));
    const lines = r.raw.split("\n");
    for (const l of lines) {
      if (/x402|payment|price|402|require|upgrade|plan/i.test(l) && l.includes("error")) console.log("PAYMENT-RELATED:", l.slice(0, 300));
    }
  }
}
main().catch(console.error);
