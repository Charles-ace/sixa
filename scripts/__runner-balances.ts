import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { createPublicClient, http, formatEther } from "viem";
import { base, baseSepolia, sepolia } from "viem/chains";

const ORG = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
const PAYER = "0xa8ee74b6E4F84Df415112A004758675407659a94";

const rpcs = {
  "base mainnet (8453)": { chain: base, url: "https://mainnet.base.org" },
  "base sepolia (84532)": { chain: baseSepolia, url: "https://sepolia.base.org" },
  "eth sepolia (11155111)": { chain: sepolia, url: "https://ethereum-sepolia-rpc.publicnode.com" },
};

async function main() {
  for (const [name, { chain, url }] of Object.entries(rpcs)) {
    try {
      const pc = createPublicClient({ chain, transport: http(url) });
      const org = await pc.getBalance({ address: ORG });
      const payer = await pc.getBalance({ address: PAYER });
      console.log(`${name}: org=${formatEther(org)} ETH  payer=${formatEther(payer)} ETH`);
    } catch (e: any) {
      console.log(`${name}: ERROR ${e?.shortMessage ?? e?.message ?? e}`);
    }
  }
}
main().catch(console.error);
