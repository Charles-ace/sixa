import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const RPC = process.env.BROKER_PAYER_RPC_URL ?? "https://sepolia.base.org";
const TX = "0xb9f950525b49b0a133308aaff4e97efb084eebad3cc69b27bfacb83c0b2d290a";
const ORG = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
async function call(method: string, params: unknown[]) {
  const res = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
  return (await res.json()) as { result?: unknown; error?: unknown };
}
async function main() {
  const tx = await call("eth_getTransactionByHash", [TX]);
  console.log("tx:", JSON.stringify(tx.result, null, 1));
  const balance = await call("eth_getBalance", [ORG, "latest"]);
  console.log(`\norg balance latest: ${JSON.stringify(balance.result)}`);
  const balance2 = await call("eth_getBalance", [ORG, "0x2B2CD70"]);
  console.log(`org balance @45281647 (0x2B2CD70): ${JSON.stringify(balance2.result)}`);
}
main().catch(console.error);
