import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const API_KEY = process.env.KEEPERHUB_API_KEY ?? "";
const REST = "https://app.keeperhub.com";
async function main() {
  console.log(`key loaded: ${API_KEY.length > 0}, prefix: ${API_KEY.slice(0, 12)}..., length: ${API_KEY.length}`);

  const rest = await fetch(`${REST}/api/keys?limit=1`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  console.log(`\nREST GET /api/keys -> HTTP ${rest.status}`);
  console.log((await rest.text()).slice(0, 800));

  const mcp = await fetch(`${REST}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-diag", version: "1.0.0" } } }),
    cache: "no-store",
  });
  console.log(`\nMCP initialize -> HTTP ${mcp.status}`);
  console.log((await mcp.text()).slice(0, 800));
}
main().catch(console.error);
