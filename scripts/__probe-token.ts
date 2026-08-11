import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

const TOKEN = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";
const RUNNER = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
const PAYER = "0xa8ee74b6E4F84Df415112A004758675407659a94";

async function main() {
  const pc = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
  const code = await pc.getCode({ address: TOKEN });
  console.log("contract code exists:", Boolean(code && code.length > 2));
  const tryCall = async (fn: string) => {
    try {
      const r = await pc.readContract({ address: TOKEN, abi: [{ type: "function", name: fn, stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }], functionName: fn });
      return String(r);
    } catch { return "n/a"; }
  };
  console.log("name:", await tryCall("name"));
  console.log("symbol:", await tryCall("symbol"));
  try {
    const dec = await pc.readContract({ address: TOKEN, abi: [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }], functionName: "decimals" });
    console.log("decimals:", dec);
    const bal = await pc.readContract({ address: TOKEN, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "balanceOf", args: [RUNNER] });
    console.log("runner balance:", formatUnits(bal, Number(dec)));
    const balP = await pc.readContract({ address: TOKEN, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "balanceOf", args: [PAYER] });
    console.log("payer balance:", formatUnits(balP, Number(dec)));
  } catch (e: any) {
    console.log("balanceOf error:", e?.shortMessage ?? e?.message);
  }
}
main().catch(console.error);
