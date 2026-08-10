import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const RPC = "https://sepolia.base.org";
const TX = "0x9c59a1f9e87d41d6ef0adceb85487f54647b1c2e75e7256c6f853f23e04a0a6c";
async function call(method: string, params: unknown[]) {
  const res = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
  return (await res.json()) as { result?: unknown; error?: unknown };
}
async function main() {
  const tx = await call("eth_getTransactionByHash", [TX]);
  const txObj = tx.result as Record<string, string> | null;
  console.log("tx exists:", Boolean(txObj));
  if (txObj) {
    console.log("from:", txObj.from);
    console.log("to:", txObj.to);
    console.log("value:", BigInt(txObj.value).toString(), "wei (", (Number(BigInt(txObj.value)) / 1e18).toFixed(6), "BASE )");
    console.log("chainId:", Number(txObj.chainId), "(84532 = Base Sepolia)");
    console.log("blockNumber:", Number(txObj.blockNumber));
    console.log("input:", txObj.input);
  }
  const receipt = await call("eth_getTransactionReceipt", [TX]);
  const r = receipt.result as Record<string, unknown> | null;
  console.log("receipt exists:", Boolean(r));
  if (r) {
    console.log("receipt.status:", Number(r.status) === 1 ? "success (1)" : `FAILED (${r.status})`);
    console.log("receipt.blockNumber:", Number(r.blockNumber));
    console.log("receipt.gasUsed:", String(r.gasUsed));
  }
  const bal = await call("eth_getBalance", ["0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61", "latest"]);
  console.log("org wallet balance now:", (Number(BigInt(String(bal.result))) / 1e18).toFixed(8), "BASE");
}
main().catch(console.error);
