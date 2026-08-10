import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const API_KEY = process.env.KEEPERHUB_API_KEY ?? "";
const URL = "https://app.keeperhub.com/mcp";
async function main() {
  // 1) initialize, capture headers + session
  const init = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sixa-diag2", version: "1.0.0" } } }),
    cache: "no-store",
  });
  console.log(`init HTTP ${init.status}`);
  console.log("init headers:", JSON.stringify(Object.fromEntries(init.headers.entries())));
  const sid = init.headers.get("Mcp-Session-Id");
  console.log("sessionId:", sid);

  // 2) notifications/initialized
  const n = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${API_KEY}`, ...(sid ? { "Mcp-Session-Id": sid } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store",
  });
  console.log(`\nnotifications/initialized HTTP ${n.status}: ${(await n.text()).slice(0, 200)}`);

  // 3) tools/call WITH session
  const t1 = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${API_KEY}`, ...(sid ? { "Mcp-Session-Id": sid } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_integrations", arguments: {} } }),
    cache: "no-store",
  });
  console.log(`\ntools/call list_integrations WITH session HTTP ${t1.status}`);
  console.log((await t1.text()).slice(0, 500));

  // 4) tools/call WITHOUT session
  const t2 = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_integrations", arguments: {} } }),
    cache: "no-store",
  });
  console.log(`\ntools/call list_integrations NO session HTTP ${t2.status}`);
  console.log((await t2.text()).slice(0, 500));

  // 5) REST workflows list
  const w = await fetch("https://app.keeperhub.com/api/workflows", {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  console.log(`\nREST GET /api/workflows HTTP ${w.status}`);
  console.log((await w.text()).slice(0, 500));
}
main().catch(console.error);
