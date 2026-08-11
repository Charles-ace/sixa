import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const TOKEN = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";
const RUNNER = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
const ZERO = "0x0000000000000000000000000000000000000001";

async function main() {
  const pc = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
  const mintAbi = [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }] as const;
  try {
    const r = await pc.simulateContract({ address: TOKEN, abi: mintAbi, functionName: "mint", args: [RUNNER, 1000000000n], account: ZERO });
    console.log("mint OPEN — simulated ok:", r.request ? "yes" : "?");
  } catch (e: any) {
    console.log("mint simulated:", e?.shortMessage ?? e?.message);
  }
  const ownerAbi = [{ type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;
  try {
    const o = await pc.readContract({ address: TOKEN, abi: ownerAbi, functionName: "owner" });
    console.log("owner:", o);
  } catch { console.log("owner: n/a (no owner fn or not ownable)"); }
}
main().catch(console.error);
