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
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-catalog-search", version: "1.0.0" } });
  console.log(`init HTTP ${init.status}`);
  if (init.status !== 200) return;
  await rpc("notifications/initialized", {});

  const queries: Array<{ q: string; type?: string }> = [
    { q: "" },
    { q: "transfer", type: "write" },
    { q: "send", type: "write" },
    { q: "swap", type: "write" },
    { q: "deposit", type: "write" },
    { q: "withdraw", type: "write" },
    { q: "mint", type: "write" },
    { q: "claim", type: "write" },
    { q: "stake", type: "write" },
    { q: "pause", type: "write" },
    { q: "settle", type: "write" },
    { q: "usdc", type: "write" },
    { q: "sepolia", type: "write" },
    { q: "base", type: "write" },
    { q: "pay", type: "write" },
    { q: "refuel", type: "write" },
  ];

  const seen = new Map<string, string>(); // id -> name
  const bySlug = new Map<string, { name: string; raw: string }>();
  for (const { q, type } of queries) {
    const args: Record<string, unknown> = {};
    if (q) args.query = q;
    if (type) args.workflowType = type;
    args.sort = "popular";
    const r = await rpc("tools/call", { name: "search_workflows", arguments: args });
    const text = innerText(r.raw);
    let parsed: { items?: Array<Record<string, unknown>> } | null = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const items = parsed?.items ?? [];
    console.log(`query="${q || "(empty)"}" type=${type ?? "-"} HTTP ${r.status} items=${items.length}`);
    for (const it of items) {
      const id = String(it.id ?? "");
      const slug = String(it.listedSlug ?? "");
      const name = String(it.name ?? "?");
      const wt = String(it.workflowType ?? "?");
      const listed = String(it.isListed ?? "?");
      const price = String(it.priceUsdcPerCall ?? "?");
      const key = slug || id;
      if (key && !seen.has(key)) {
        seen.set(key, name);
        bySlug.set(key, { name, raw: text });
      }
      console.log(`  - [${wt}] listed=${listed} price=${price} slug=${slug || "(none)"} id=${id} name=${name}`);
    }
  }
  console.log(`\nTOTAL UNIQUE LISTINGS SEEN: ${seen.size}`);
  for (const [k, v] of bySlug) { console.log(`  ${k} :: ${v.name}`); }
}
main().catch(console.error);
